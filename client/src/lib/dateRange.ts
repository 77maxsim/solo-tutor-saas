// src/lib/dateRange.ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// The app-wide setting for week start
export const WEEK_STARTS_ON: 0 | 1 = 1; // 1 = Monday, 0 = Sunday

// Helper to get a user's timezone (fallback to app default)
export const APP_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv";

export function weekRange(date = new Date(), tz = APP_TIMEZONE) {
  // Convert input date to the specified timezone
  const local = dayjs(date).tz(tz);
  
  // Get start and end of week in the local timezone
  // dayjs uses Sunday=0, Monday=1, so we need to set Monday as start
  const startLocal = local.startOf('week').add(1, 'day'); // Move from Sunday to Monday
  const endLocal = startLocal.add(6, 'day').endOf('day'); // Sunday end of week
  
  // Convert to UTC for querying the DB
  return {
    startUtc: startLocal.utc().toDate(),
    endUtc: endLocal.utc().toDate(),
  };
}

export function monthRange(date = new Date(), tz = APP_TIMEZONE) {
  // Convert input date to the specified timezone
  const local = dayjs(date).tz(tz);
  
  // Get start and end of month in the local timezone
  const startLocal = local.startOf('month');
  const endLocal = local.endOf('month');
  
  return {
    startUtc: startLocal.utc().toDate(),
    endUtc: endLocal.utc().toDate(),
  };
}