import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Convert session data to FullCalendar event with proper timezone handling
 * Ensures all timestamps are treated as UTC and converted exactly once to tutor timezone
 */
export function convertSessionToCalendarEvent(
  session: any, 
  tutorTimezone: string = 'Europe/Kyiv'
) {
  // Validate required fields
  if (!session.session_start || !session.session_end) {
    throw new Error(`Session ${session.id} missing timestamps`);
  }

  // Parse timestamps as UTC and convert to tutor timezone
  const sessionStartUTC = dayjs.utc(session.session_start);
  const sessionEndUTC = dayjs.utc(session.session_end);
  
  // Convert to local timezone for FullCalendar (returns JS Date objects)
  const startDate = sessionStartUTC.tz(tutorTimezone).toDate();
  const endDate = sessionEndUTC.tz(tutorTimezone).toDate();

  // Determine display styling
  let title = session.student_name || session.unassigned_name || 'Unknown Student';
  let backgroundColor = session.color || '#3b82f6'; // Use user's selected color or default blue
  let textColor = '#ffffff';
  
  // Only override user's color choice for critical status indicators
  if (session.status === 'pending') {
    backgroundColor = '#f59e0b'; // Amber for pending requests (critical status)
    title = `⏳ ${session.unassigned_name || 'Pending Request'}`;
  } else if (session.status === 'confirmed' && !session.student_id) {
    backgroundColor = '#10b981'; // Green for unassigned confirmed sessions (critical status)
    title = `📝 ${session.unassigned_name || 'Unassigned Session'}`;
  } 
  // For regular sessions, respect user's color choice and only add visual indicators in title
  else if (!session.paid) {
    title = `💰 ${title}`; // Add unpaid indicator to title but keep user's color
  }

  // Check if session is in the past
  const now = dayjs.utc();
  const sessionEnd = dayjs.utc(session.session_end);
  const isPastSession = sessionEnd.isBefore(now);

  return {
    id: session.id,
    title,
    start: startDate,
    end: endDate,
    backgroundColor,
    borderColor: backgroundColor,
    textColor,
    extendedProps: { 
      ...session, 
      isPastSession
    }
  };
}

/**
 * Debug helper to verify timezone conversion
 */
export function debugSessionConversion(session: any, tutorTimezone: string = 'UTC') {
  const sessionStartUTC = dayjs.utc(session.session_start);
  
  return {
    sessionId: session.id?.substring(0, 8) + '...',
    studentName: session.student_name,
    originalTimestamp: session.session_start,
    parsedAsUTC: sessionStartUTC.format('YYYY-MM-DD HH:mm [UTC]'),
    convertedToLocal: sessionStartUTC.tz(tutorTimezone).format('YYYY-MM-DD HH:mm [' + tutorTimezone + ']'),
    finalJSDate: sessionStartUTC.tz(tutorTimezone).toDate().toISOString()
  };
}