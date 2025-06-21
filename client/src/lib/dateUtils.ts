// Date and timezone utilities for consistent timestamp handling

/**
 * Converts a UTC timestamp to local time string
 * @param utcTimestamp - UTC timestamp string from database
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted local time string
 */
export function utcToLocalTime(utcTimestamp: string, options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }): string {
  if (!utcTimestamp) return '';
  
  try {
    // Create Date object from UTC timestamp
    const utcDate = new Date(utcTimestamp);
    
    // Convert to local time using toLocaleTimeString
    return utcDate.toLocaleTimeString('en-US', {
      hour12: false,
      ...options
    });
  } catch (error) {
    console.error('Error converting UTC to local time:', error);
    return '';
  }
}

/**
 * Converts a UTC timestamp to local date string
 * @param utcTimestamp - UTC timestamp string from database
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted local date string
 */
export function utcToLocalDate(utcTimestamp: string, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }): string {
  if (!utcTimestamp) return '';
  
  try {
    const utcDate = new Date(utcTimestamp);
    return utcDate.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error converting UTC to local date:', error);
    return '';
  }
}

/**
 * Converts a UTC timestamp to a local Date object for calendar use
 * @param utcTimestamp - UTC timestamp string from database
 * @returns Date object in local timezone
 */
export function utcToLocalDateObject(utcTimestamp: string): Date {
  if (!utcTimestamp) return new Date();
  
  try {
    // The Date constructor automatically converts UTC to local timezone
    return new Date(utcTimestamp);
  } catch (error) {
    console.error('Error converting UTC to local Date object:', error);
    return new Date();
  }
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
 * @param startUtc - Start UTC timestamp
 * @param endUtc - End UTC timestamp
 * @returns Formatted time range string (e.g., "2:00 PM - 3:00 PM")
 */
export function formatSessionTimeRange(startUtc: string, endUtc: string): string {
  if (!startUtc || !endUtc) return '';
  
  try {
    const startLocal = utcToLocalTime(startUtc, { hour: 'numeric', minute: '2-digit', hour12: true });
    const endLocal = utcToLocalTime(endUtc, { hour: 'numeric', minute: '2-digit', hour12: true });
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
  // Prefer UTC timestamps if available
  if (session.session_start && session.session_end) {
    return {
      displayTime: utcToLocalTime(session.session_start),
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