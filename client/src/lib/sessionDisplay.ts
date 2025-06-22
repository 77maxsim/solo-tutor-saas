import { formatUtcToTutorTimezone, calculateDurationMinutes } from "@/lib/dateUtils";

interface SessionData {
  session_start: string;
  session_end: string;
  duration: number;
}

export function getSessionDisplayInfo(session: SessionData, tutorTimezone: string) {
  // Always use UTC timestamps with timezone conversion
  const startTime = formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'HH:mm');
  const endTime = formatUtcToTutorTimezone(session.session_end, tutorTimezone, 'HH:mm');
  const durationMinutes = calculateDurationMinutes(session.session_start, session.session_end);
  const displayTime = `${startTime} - ${endTime}`;

  return { displayTime, durationMinutes };
}