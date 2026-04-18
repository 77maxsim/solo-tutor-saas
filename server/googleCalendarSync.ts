import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import type { Tutor } from '@shared/schema';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Determine the correct redirect URI based on environment
function getRedirectUri(): string {
  // Explicit override always wins
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }
  // For Replit deployments (production): REPLIT_DEPLOYMENT is a flag ("1"),
  // the actual domain(s) live in REPLIT_DOMAINS (comma-separated).
  if (process.env.REPLIT_DEPLOYMENT === '1' && process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(',')[0].trim();
    if (domain) {
      return `https://${domain}/api/auth/google/callback`;
    }
  }
  // For Replit development environment
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`;
  }
  // Fallback: first entry of REPLIT_DOMAINS if available (covers dev too)
  if (process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(',')[0].trim();
    if (domain) {
      return `https://${domain}/api/auth/google/callback`;
    }
  }
  // Fallback for local development
  return 'http://localhost:5000/api/auth/google/callback';
}

const REDIRECT_URI = getRedirectUri();
console.log(`[GoogleCalendar] OAuth redirect URI: ${REDIRECT_URI}`);

// OAuth state management - stores cryptographically secure state tokens
interface OAuthState {
  tutorId: number;
  expiresAt: number;
}

const oauthStates = new Map<string, OAuthState>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  const tokensToDelete: string[] = [];
  
  oauthStates.forEach((state, token) => {
    if (state.expiresAt < now) {
      tokensToDelete.push(token);
    }
  });
  
  tokensToDelete.forEach(token => oauthStates.delete(token));
}, 10 * 60 * 1000);

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

/**
 * Get tutor's Google Calendar credentials from database
 */
async function getTutorCredentials(tutorId: number): Promise<Tutor | null> {
  try {
    const { data, error } = await supabase
      .from('tutors')
      .select('*')
      .eq('id', tutorId)
      .single();

    if (error || !data) {
      console.log('Could not fetch credentials for tutor:', tutorId);
      return null;
    }

    return data as Tutor;
  } catch (error) {
    console.error('Error fetching tutor credentials:', error);
    return null;
  }
}

/**
 * Refresh an expired access token using the refresh token
 */
async function refreshAccessToken(tutorId: number, refreshToken: string): Promise<string | null> {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth credentials not configured');
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    const newAccessToken = credentials.access_token;
    const expiresAt = credentials.expiry_date 
      ? new Date(credentials.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(); // Default 1 hour

    if (!newAccessToken) {
      throw new Error('Failed to refresh access token');
    }

    // Update the database with new token
    await supabase
      .from('tutors')
      .update({
        google_access_token: newAccessToken,
        google_token_expires_at: expiresAt,
      })
      .eq('id', tutorId);

    console.log('✓ Refreshed access token for tutor:', tutorId);
    return newAccessToken;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    
    // Token refresh failed - disconnect calendar
    await supabase
      .from('tutors')
      .update({
        google_calendar_connected: false,
        sync_google_calendar: false,
      })
      .eq('id', tutorId);
    
    return null;
  }
}

/**
 * Get a valid access token for a tutor (refreshes if expired)
 */
async function getAccessToken(tutorId: number): Promise<string | null> {
  const tutor = await getTutorCredentials(tutorId);

  if (!tutor || !tutor.google_calendar_connected) {
    console.log('Google Calendar not connected for tutor:', tutorId);
    return null;
  }

  // Check if token is expired or about to expire (within 5 minutes)
  const expiresAt = tutor.google_token_expires_at 
    ? new Date(tutor.google_token_expires_at).getTime()
    : 0;
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt > now + fiveMinutes && tutor.google_access_token) {
    // Token is still valid
    return tutor.google_access_token;
  }

  // Token expired or about to expire - refresh it
  if (tutor.google_refresh_token) {
    return await refreshAccessToken(tutorId, tutor.google_refresh_token);
  }

  console.log('No refresh token available for tutor:', tutorId);
  return null;
}

/**
 * Get Google Calendar client for a specific tutor
 */
async function getGoogleCalendarClient(tutorId: number) {
  const accessToken = await getAccessToken(tutorId);

  if (!accessToken) {
    throw new Error(`Google Calendar not connected for tutor ${tutorId}`);
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Check if a tutor has Google Calendar sync enabled and connected
 */
export async function isSyncEnabled(tutorId: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('tutors')
      .select('sync_google_calendar, google_calendar_connected')
      .eq('id', tutorId)
      .single();

    if (error || !data) {
      console.log('Could not fetch sync preference for tutor:', tutorId);
      return false;
    }

    return data.sync_google_calendar === true && data.google_calendar_connected === true;
  } catch (error) {
    console.error('Error checking sync status:', error);
    return false;
  }
}

/**
 * Get tutor's timezone preference
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
 */
export async function createCalendarEvent(session: SessionData): Promise<string | null> {
  try {
    // Check if sync is enabled for this tutor
    const syncEnabled = await isSyncEnabled(session.tutor_id);
    if (!syncEnabled) {
      console.log('Google Calendar sync disabled or not connected for tutor:', session.tutor_id);
      return null;
    }

    // Don't sync cancelled or pending sessions
    if (session.status === 'cancelled' || session.status === 'pending') {
      console.log('Skipping sync for cancelled/pending session');
      return null;
    }

    const calendar = await getGoogleCalendarClient(session.tutor_id);
    const tutorTimezone = await getTutorTimezone(session.tutor_id);

    // Convert UTC timestamps to DateTime objects
    const startDateTime = DateTime.fromISO(session.session_start, { zone: 'UTC' });
    const endDateTime = DateTime.fromISO(session.session_end, { zone: 'UTC' });

    // Prepare event details
    const studentName = session.student_name || session.unassigned_name || 'Unassigned';
    const eventTitle = `${studentName} - Tutoring Session`;
    const eventDescription = session.notes ? `Notes: ${session.notes}` : 'Tutoring session';

    // Create the event
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
    console.log('✓ Created Google Calendar event for tutor', session.tutor_id, ':', eventId);

    // Store the event ID in the database
    if (eventId) {
      await supabase
        .from('sessions')
        .update({ google_calendar_event_id: eventId })
        .eq('id', session.id);
    }

    return eventId || null;
  } catch (error) {
    console.error('Error creating Google Calendar event for tutor', session.tutor_id, ':', error);
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
      return await deleteCalendarEvent(session.tutor_id, session.google_calendar_event_id);
    }

    const calendar = await getGoogleCalendarClient(session.tutor_id);
    const tutorTimezone = await getTutorTimezone(session.tutor_id);

    // Convert UTC timestamps
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

    console.log('✓ Updated Google Calendar event for tutor', session.tutor_id, ':', session.google_calendar_event_id);
    return true;
  } catch (error) {
    console.error('Error updating Google Calendar event for tutor', session.tutor_id, ':', error);
    return false;
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(tutorId: number, eventId: string): Promise<boolean> {
  try {
    const calendar = await getGoogleCalendarClient(tutorId);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    console.log('✓ Deleted Google Calendar event for tutor', tutorId, ':', eventId);
    return true;
  } catch (error) {
    console.error('Error deleting Google Calendar event for tutor', tutorId, ':', error);
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

    // Get all scheduled/completed sessions
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
      .not('status', 'in', '(cancelled,pending)');

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

      let result: boolean | string | null = false;
      
      // If session has an event ID, update it; otherwise create new
      if (session.google_calendar_event_id) {
        result = await updateCalendarEvent(sessionData);
      } else {
        result = await createCalendarEvent(sessionData);
      }

      if (result) {
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

    console.log(`Bulk sync completed for tutor ${tutorId}: ${success} synced, ${failed} failed out of ${total}`);
    return { success, failed, total };
  } catch (error) {
    console.error('Error in bulk sync for tutor', tutorId, ':', error);
    return { success: 0, failed: 0, total: 0 };
  }
}

/**
 * Generate a cryptographically secure state token for OAuth
 */
function generateStateToken(tutorId: number): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
  
  oauthStates.set(token, { tutorId, expiresAt });
  
  console.log(`Generated OAuth state token for tutor ${tutorId}, expires at ${new Date(expiresAt).toISOString()}`);
  return token;
}

/**
 * Validate and consume an OAuth state token
 */
function validateStateToken(token: string): number | null {
  const state = oauthStates.get(token);
  
  if (!state) {
    console.log('OAuth state token not found:', token);
    return null;
  }
  
  if (state.expiresAt < Date.now()) {
    console.log('OAuth state token expired for tutor:', state.tutorId);
    oauthStates.delete(token);
    return null;
  }
  
  // Remove token after use (one-time use only)
  oauthStates.delete(token);
  
  console.log(`Validated OAuth state token for tutor ${state.tutorId}`);
  return state.tutorId;
}

/**
 * Generate Google OAuth authorization URL for a tutor
 */
export function getAuthorizationUrl(tutorId: number): string {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
  ];

  const stateToken = generateStateToken(tutorId);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: stateToken, // Use cryptographically secure state token
    prompt: 'consent', // Force consent screen to get refresh token
  });

  return authUrl;
}

/**
 * Exchange authorization code for tokens and store in database
 * @param code - Authorization code from Google
 * @param stateToken - State token to validate
 */
export async function handleOAuthCallback(code: string, stateToken: string): Promise<boolean> {
  try {
    // Validate state token and get tutor ID
    const tutorId = validateStateToken(stateToken);
    
    if (!tutorId) {
      console.error('Invalid or expired OAuth state token');
      return false;
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing tokens from OAuth response');
    }

    const expiresAt = tokens.expiry_date 
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    // Store tokens in database
    const { error } = await supabase
      .from('tutors')
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expires_at: expiresAt,
        google_calendar_connected: true,
        sync_google_calendar: true,
      })
      .eq('id', tutorId);

    if (error) {
      console.error('Error storing OAuth tokens:', error);
      return false;
    }

    console.log('✓ Successfully connected Google Calendar for tutor:', tutorId);
    return true;
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    return false;
  }
}

/**
 * Disconnect Google Calendar for a tutor
 */
export async function disconnectGoogleCalendar(tutorId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tutors')
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null,
        google_calendar_connected: false,
        sync_google_calendar: false,
      })
      .eq('id', tutorId);

    if (error) {
      console.error('Error disconnecting Google Calendar:', error);
      return false;
    }

    console.log('✓ Disconnected Google Calendar for tutor:', tutorId);
    return true;
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    return false;
  }
}
