// Date and timezone utilities for consistent timestamp handling
import { DateTime } from 'luxon';

export function formatUtcToTutorTimezone(utcString: string, timezone: string, format: string = 'HH:mm') {
  return DateTime.fromISO(utcString, { zone: 'utc' }).setZone(timezone).toFormat(format);
}

export function formatUtcToTutorDate(utcString: string, timezone: string, format: string = 'MM/dd/yyyy') {
  return DateTime.fromISO(utcString, { zone: 'utc' }).setZone(timezone).toFormat(format);
}

export function formatUtcToTutorDateTime(utcString: string, timezone: string, format: string = 'MM/dd/yyyy HH:mm') {
  return DateTime.fromISO(utcString, { zone: 'utc' }).setZone(timezone).toFormat(format);
}

export function calculateDurationMinutes(startTimestamp: string, endTimestamp: string): number {
  if (!startTimestamp || !endTimestamp) return 0;
  
  try {
    const start = DateTime.fromISO(startTimestamp, { zone: 'utc' });
    const end = DateTime.fromISO(endTimestamp, { zone: 'utc' });
    return Math.round(end.diff(start, 'minutes').minutes);
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 0;
  }
}

