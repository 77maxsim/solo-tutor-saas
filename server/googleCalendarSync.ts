import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Google Calendar Client Setup (from Replit connector blueprint)
let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

async function getGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

interface SessionData {
  id: number;
  session_start: string; // UTC timestamp
  session_end: string; // UTC timestamp
  tutor_id: number;
  student_id?: number;
  notes?: string;
  status: string;
  google_calendar_event_id?: string;
  student_name?: string;
  unassigned_name?: string;
}

interface TutorPreferences {
  timezone: string;
  sync_google_calendar: boolean;
}

/**
 * Check if a tutor has Google Calendar sync enabled
 */
export async function isSyncEnabled(tutorId: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('tutors')
      .select('sync_google_calendar')
      .eq('id', tutorId)
      .single();

    if (error || !data) {
      console.log('Could not fetch sync preference for tutor:', tutorId);
      return false;
    }

    return data.sync_google_calendar === true;
  } catch (error) {
    console.error('Error checking sync status:', error);
    return false;
  }
}

/**
 * Get tutor's timezone preference (reads existing data, no modifications)
 */
async function getTutorTimezone(tutorId: number): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('tutors')
      .select('timezone')
      .eq('id', tutorId)
      .single();

    if (error || !data?.timezone) {
      console.log('Could not fetch timezone for tutor:', tutorId, ', using UTC as fallback');
      return 'UTC';
    }

    return data.timezone;
  } catch (error) {
    console.error('Error fetching tutor timezone:', error);
    return 'UTC';
  }
}

/**
 * Create a Google Calendar event for a session
 * This function READS existing UTC timestamps - it doesn't modify them
 */
export async function createCalendarEvent(session: SessionData): Promise<string | null> {
  try {
    // Check if sync is enabled for this tutor
    const syncEnabled = await isSyncEnabled(session.tutor_id);
    if (!syncEnabled) {
      console.log('Google Calendar sync disabled for tutor:', session.tutor_id);
      return null;
    }

    // Don't sync cancelled or pending sessions
    if (session.status === 'cancelled' || session.status === 'pending') {
      console.log('Skipping sync for cancelled/pending session');
      return null;
    }

    const calendar = await getGoogleCalendarClient();
    const tutorTimezone = await getTutorTimezone(session.tutor_id);

    // Convert UTC timestamps to DateTime objects (using existing UTC data)
    const startDateTime = DateTime.fromISO(session.session_start, { zone: 'UTC' });
    const endDateTime = DateTime.fromISO(session.session_end, { zone: 'UTC' });

    // Prepare event details
    const studentName = session.student_name || session.unassigned_name || 'Unassigned';
    const eventTitle = `${studentName} - Tutoring Session`;
    const eventDescription = session.notes ? `Notes: ${session.notes}` : 'Tutoring session';

    // Create the event (Google Calendar API handles timezone conversion)
    const event = {
      summary: eventTitle,
      description: eventDescription,
      start: {
        dateTime: startDateTime.toISO(),
        timeZone: tutorTimezone,
      },
      end: {
        dateTime: endDateTime.toISO(),
        timeZone: tutorTimezone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    const eventId = response.data.id;
    console.log('✓ Created Google Calendar event:', eventId);

    // Store the event ID in the database
    if (eventId) {
      await supabase
        .from('sessions')
        .update({ google_calendar_event_id: eventId })
        .eq('id', session.id);
    }

    return eventId || null;
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    // Non-blocking: session creation should still succeed even if calendar sync fails
    return null;
  }
}

/**
 * Update an existing Google Calendar event
 */
export async function updateCalendarEvent(session: SessionData): Promise<boolean> {
  try {
    // Check if sync is enabled
    const syncEnabled = await isSyncEnabled(session.tutor_id);
    if (!syncEnabled) {
      return false;
    }

    // If session doesn't have a calendar event ID, create one
    if (!session.google_calendar_event_id) {
      const eventId = await createCalendarEvent(session);
      return eventId !== null;
    }

    // If session is now cancelled, delete the calendar event
    if (session.status === 'cancelled') {
      return await deleteCalendarEvent(session.google_calendar_event_id);
    }

    const calendar = await getGoogleCalendarClient();
    const tutorTimezone = await getTutorTimezone(session.tutor_id);

    // Convert UTC timestamps (reading existing data)
    const startDateTime = DateTime.fromISO(session.session_start, { zone: 'UTC' });
    const endDateTime = DateTime.fromISO(session.session_end, { zone: 'UTC' });

    const studentName = session.student_name || session.unassigned_name || 'Unassigned';
    const eventTitle = `${studentName} - Tutoring Session`;
    const eventDescription = session.notes ? `Notes: ${session.notes}` : 'Tutoring session';

    const event = {
      summary: eventTitle,
      description: eventDescription,
      start: {
        dateTime: startDateTime.toISO(),
        timeZone: tutorTimezone,
      },
      end: {
        dateTime: endDateTime.toISO(),
        timeZone: tutorTimezone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    await calendar.events.update({
      calendarId: 'primary',
      eventId: session.google_calendar_event_id,
      requestBody: event,
    });

    console.log('✓ Updated Google Calendar event:', session.google_calendar_event_id);
    return true;
  } catch (error) {
    console.error('Error updating Google Calendar event:', error);
    return false;
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    const calendar = await getGoogleCalendarClient();

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    console.log('✓ Deleted Google Calendar event:', eventId);
    return true;
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error);
    return false;
  }
}

/**
 * Sync all sessions for a tutor (bulk sync)
 */
export async function bulkSyncSessions(
  tutorId: number,
  onProgress?: (progress: { current: number; total: number; success: number; failed: number }) => void
): Promise<{ success: number; failed: number; total: number }> {
  try {
    const syncEnabled = await isSyncEnabled(tutorId);
    if (!syncEnabled) {
      return { success: 0, failed: 0, total: 0 };
    }

    // Get all sessions that don't have calendar event IDs
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        session_start,
        session_end,
        tutor_id,
        student_id,
        notes,
        status,
        google_calendar_event_id,
        unassigned_name,
        students (name)
      `)
      .eq('tutor_id', tutorId)
      .is('google_calendar_event_id', null);

    if (error || !sessions) {
      console.error('Error fetching sessions for bulk sync:', error);
      return { success: 0, failed: 0, total: 0 };
    }

    const total = sessions.length;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const sessionData: SessionData = {
        ...session,
        student_name: (session as any).students?.name,
      };

      const eventId = await createCalendarEvent(sessionData);
      if (eventId) {
        success++;
      } else {
        failed++;
      }

      // Send progress update
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          success,
          failed,
        });
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Bulk sync completed: ${success} synced, ${failed} failed out of ${total}`);
    return { success, failed, total };
  } catch (error) {
    console.error('Error in bulk sync:', error);
    return { success: 0, failed: 0, total: 0 };
  }
}
