import { formatUtcToTutorTimezone, calculateDurationMinutes } from "@/lib/dateUtils";

interface SessionData {
  session_start?: string;
  session_end?: string;
  date?: string;
  time?: string;
  duration: number;
}

export function getSessionDisplayInfo(session: SessionData, tutorTimezone?: string) {
  let displayTime: string;
  let durationMinutes: number;

  if (session.session_start && session.session_end && tutorTimezone) {
    // Use UTC timestamps with timezone conversion
    const startTime = formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'HH:mm');
    const endTime = formatUtcToTutorTimezone(session.session_end, tutorTimezone, 'HH:mm');
    durationMinutes = calculateDurationMinutes(session.session_start, session.session_end);
    displayTime = `${startTime} - ${endTime}`;
  } else {
    // Fallback to legacy fields
    displayTime = session.time || '';
    durationMinutes = session.duration;
  }

  return { displayTime, durationMinutes };
}