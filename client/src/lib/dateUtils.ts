// Date and timezone utilities for consistent timestamp handling

/**
 * Standardized function to get local session display information
 * @param session - Session object with UTC timestamps
 * @returns Object with formatted local time display strings
 */
export function getLocalSessionDisplayInfo(session: {
  session_start: string;
  session_end: string;
}) {
  const start = new Date(session.session_start);
  const end = new Date(session.session_end);
  const duration = Math.round((end.getTime() - start.getTime()) / 60000);
  
  return {
    startTime: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    endTime: end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: start.toLocaleDateString(),
    duration,
    display: `${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${duration} min)`
  };
}

/**
 * Calculates duration in minutes between two UTC timestamps
 * @param startUtc - Start UTC timestamp
 * @param endUtc - End UTC timestamp
 * @returns Duration in minutes
 */
export function calculateDurationMinutes(startUtc: string, endUtc: string): number {
  if (!startUtc || !endUtc) return 0;
  
  try {
    const start = new Date(startUtc);
    const end = new Date(endUtc);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 0;
  }
}

/**
 * Formats a session time range from UTC timestamps
 * @param startUtc - Start UTC timestamp (automatically converted to local time by JS)
 * @param endUtc - End UTC timestamp (automatically converted to local time by JS)
 * @returns Formatted time range string (e.g., "2:00 PM - 3:00 PM")
 */
export function formatSessionTimeRange(startUtc: string, endUtc: string): string {
  if (!startUtc || !endUtc) return '';
  
  try {
    const startLocal = new Date(startUtc).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    const endLocal = new Date(endUtc).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    return `${startLocal} - ${endLocal}`;
  } catch (error) {
    console.error('Error formatting session time range:', error);
    return '';
  }
}

/**
 * Gets display time and duration from session data (supports both UTC timestamps and legacy fields)
 * @param session - Session object with either UTC timestamps or legacy date/time fields
 * @returns Object with displayTime and durationMinutes
 */
export function getSessionDisplayInfo(session: any): { displayTime: string; durationMinutes: number } {
  // Prefer UTC timestamps if available - JavaScript automatically converts to local time
  if (session.session_start && session.session_end) {
    return {
      displayTime: new Date(session.session_start).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      durationMinutes: calculateDurationMinutes(session.session_start, session.session_end)
    };
  }
  
  // Fallback to legacy fields
  if (session.time && session.duration) {
    return {
      displayTime: session.time.substring(0, 5), // Remove seconds if present
      durationMinutes: session.duration
    };
  }
  
  // Ultimate fallback
  return {
    displayTime: '',
    durationMinutes: 0
  };
}