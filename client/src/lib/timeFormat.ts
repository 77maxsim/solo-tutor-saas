// Utility functions for time formatting based on user preference

export function formatTimeDisplay(time: string, format: '24h' | '12h'): string {
  if (format === '24h') {
    return time;
  }

  // Convert 24h format to 12h format
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function parseTimeInput(timeString: string): string {
  // If it's already in 24h format, return as is
  if (timeString.match(/^\d{1,2}:\d{2}$/)) {
    return timeString;
  }

  // Parse 12h format to 24h format
  const match = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return timeString; // Return original if can't parse
  }

  const [, hoursStr, minutesStr, period] = match;
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (period.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  } else if (period.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function generateTimeOptions(format: '24h' | '12h'): Array<{ value: string; label: string }> {
  const options = [];
  
  // Generate options from 6:00 AM to 10:00 PM in 30-minute increments
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const timeLabel = formatTimeDisplay(timeValue, format);
      options.push({ value: timeValue, label: timeLabel });
    }
  }

  return options;
}