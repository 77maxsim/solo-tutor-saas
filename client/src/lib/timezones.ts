// Timezone utilities and data for TutorTrack
export interface TimezoneOption {
  value: string;
  label: string;
  region: string;
}

// Common timezones grouped by region for better UX
export const TIMEZONE_GROUPS = {
  'North America': [
    { value: 'America/New_York', label: 'New York (EST/EDT)' },
    { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
    { value: 'America/Denver', label: 'Denver (MST/MDT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
    { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
    { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)' },
    { value: 'America/Mexico_City', label: 'Mexico City (CST/CDT)' },
  ],
  'Europe': [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
    { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
    { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)' },
    { value: 'Europe/Vienna', label: 'Vienna (CET/CEST)' },
    { value: 'Europe/Warsaw', label: 'Warsaw (CET/CEST)' },
    { value: 'Europe/Prague', label: 'Prague (CET/CEST)' },
    { value: 'Europe/Budapest', label: 'Budapest (CET/CEST)' },
    { value: 'Europe/Bucharest', label: 'Bucharest (EET/EEST)' },
    { value: 'Europe/Athens', label: 'Athens (EET/EEST)' },
    { value: 'Europe/Helsinki', label: 'Helsinki (EET/EEST)' },
    { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)' },
    { value: 'Europe/Oslo', label: 'Oslo (CET/CEST)' },
    { value: 'Europe/Copenhagen', label: 'Copenhagen (CET/CEST)' },
    { value: 'Europe/Kyiv', label: 'Kyiv (EET/EEST)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    { value: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
  ],
  'Asia': [
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Taipei', label: 'Taipei (CST)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
    { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (ICT)' },
    { value: 'Asia/Jakarta', label: 'Jakarta (WIB)' },
    { value: 'Asia/Manila', label: 'Manila (PHT)' },
    { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (MYT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Mumbai', label: 'Mumbai (IST)' },
    { value: 'Asia/Kolkata', label: 'Kolkata (IST)' },
    { value: 'Asia/Dhaka', label: 'Dhaka (BST)' },
    { value: 'Asia/Karachi', label: 'Karachi (PKT)' },
    { value: 'Asia/Tashkent', label: 'Tashkent (UZT)' },
    { value: 'Asia/Almaty', label: 'Almaty (ALMT)' },
  ],
  'Australia & Pacific': [
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
    { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
    { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
    { value: 'Pacific/Fiji', label: 'Fiji (FJT)' },
    { value: 'Pacific/Honolulu', label: 'Honolulu (HST)' },
  ],
  'South America': [
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT/BRST)' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)' },
    { value: 'America/Santiago', label: 'Santiago (CLT/CLST)' },
    { value: 'America/Lima', label: 'Lima (PET)' },
    { value: 'America/Bogota', label: 'Bogotá (COT)' },
    { value: 'America/Caracas', label: 'Caracas (VET)' },
  ],
  'Africa': [
    { value: 'Africa/Cairo', label: 'Cairo (EET)' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
    { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
    { value: 'Africa/Casablanca', label: 'Casablanca (WET/WEST)' },
  ],
};

// Flatten all timezones into a single array
export const ALL_TIMEZONES: TimezoneOption[] = Object.entries(TIMEZONE_GROUPS).flatMap(
  ([region, timezones]) => 
    timezones.map(tz => ({ ...tz, region }))
).sort((a, b) => a.label.localeCompare(b.label));

// Get browser's detected timezone
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Could not detect browser timezone, falling back to UTC');
    return 'UTC';
  }
}

// Validate if a timezone string is valid
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

// Get display name for a timezone
export function getTimezoneDisplayName(timezone: string): string {
  const found = ALL_TIMEZONES.find(tz => tz.value === timezone);
  return found ? found.label : timezone;
}