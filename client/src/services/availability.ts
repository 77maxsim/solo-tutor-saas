import { supabase } from '@/lib/supabaseClient';
import { getCurrentTutorId } from '@/lib/tutorHelpers';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Enable dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

export interface AvailabilitySlotPayload {
  tutor_id: string;
  start_time: string; // UTC ISO string
  end_time: string;   // UTC ISO string
  is_active: boolean;
}

// Convert local Date to UTC ISO string (reusing existing conversion pattern)
export function localToUtc(localDate: Date, tutorTimezone: string): string {
  return dayjs.tz(localDate, tutorTimezone).utc().toISOString();
}

// Convert UTC ISO string to local Date (reusing existing conversion pattern)
export function utcToLocal(utcString: string, tutorTimezone: string): Date {
  return dayjs.utc(utcString).tz(tutorTimezone).toDate();
}

// Single slot creation (keeping existing function intact)
export async function createAvailabilitySlot(startLocal: Date, endLocal: Date, tutorTimezone: string) {
  try {
    const tutorId = await getCurrentTutorId();
    if (!tutorId) {
      throw new Error("User not authenticated or tutor record not found");
    }

    // Convert to UTC for storage (using same pattern as existing code)
    const startUtc = dayjs.tz(startLocal, tutorTimezone).utc().toISOString();
    const endUtc = dayjs.tz(endLocal, tutorTimezone).utc().toISOString();

    const { data, error } = await supabase
      .from("booking_slots")
      .insert({
        tutor_id: tutorId,
        start_time: startUtc,
        end_time: endUtc,
        is_active: true
      })
      .select()
      .single();

    return { data, error };
  } catch (error) {
    console.error('Error creating availability slot:', error);
    return { data: null, error };
  }
}

// Bulk slot creation helper
export async function createAvailabilitySlots(ranges: Array<{startLocal: Date, endLocal: Date}>, tutorTimezone: string) {
  try {
    const tutorId = await getCurrentTutorId();
    if (!tutorId) {
      throw new Error("User not authenticated or tutor record not found");
    }

    // Convert all ranges to UTC payloads using the same conversion pipeline
    const payloads: AvailabilitySlotPayload[] = ranges.map(range => ({
      tutor_id: tutorId,
      start_time: dayjs.tz(range.startLocal, tutorTimezone).utc().toISOString(),
      end_time: dayjs.tz(range.endLocal, tutorTimezone).utc().toISOString(),
      is_active: true
    }));

    // Insert all slots in a single operation
    const { data, error } = await supabase
      .from("booking_slots")
      .insert(payloads)
      .select();

    return { data, error };
  } catch (error) {
    console.error('Error creating availability slots:', error);
    return { data: null, error };
  }
}

// Validate that ranges don't overlap with existing data
export function validateRangesNoOverlap(
  newRanges: Array<{startLocal: Date, endLocal: Date}>,
  existingRanges: Array<{startLocal: Date, endLocal: Date}>
): { valid: boolean; conflictingRange?: {startLocal: Date, endLocal: Date} } {
  for (const newRange of newRanges) {
    // Check against existing ranges
    for (const existing of existingRanges) {
      if (rangesOverlap(newRange, existing)) {
        return { valid: false, conflictingRange: existing };
      }
    }
    
    // Check against other new ranges (internal overlap)
    for (const otherNew of newRanges) {
      if (otherNew !== newRange && rangesOverlap(newRange, otherNew)) {
        return { valid: false, conflictingRange: otherNew };
      }
    }
  }
  
  return { valid: true };
}

// Check if two ranges overlap
function rangesOverlap(
  rangeA: {startLocal: Date, endLocal: Date},
  rangeB: {startLocal: Date, endLocal: Date}
): boolean {
  return rangeA.startLocal < rangeB.endLocal && rangeB.startLocal < rangeA.endLocal;
}

// Normalize range to slot granularity (30 minutes)
export function normalizeToSlotGranularity(range: {startLocal: Date, endLocal: Date}): {startLocal: Date, endLocal: Date} {
  const stepMin = 30;
  
  const floorToStep = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setSeconds(0, 0);
    const minutes = newDate.getMinutes();
    newDate.setMinutes(minutes - (minutes % stepMin));
    return newDate;
  };
  
  const ceilToStep = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setSeconds(0, 0);
    const minutes = newDate.getMinutes();
    const nextStep = minutes % stepMin === 0 ? minutes : minutes + (stepMin - (minutes % stepMin));
    newDate.setMinutes(nextStep);
    return newDate;
  };
  
  return {
    startLocal: floorToStep(range.startLocal),
    endLocal: ceilToStep(range.endLocal)
  };
}