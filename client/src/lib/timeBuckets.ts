// client/src/lib/timeBuckets.ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import isoWeek from "dayjs/plugin/isoWeek";
import localizedFormat from "dayjs/plugin/localizedFormat";
dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(isoWeek);
dayjs.extend(localizedFormat);

export type BucketMode = "month" | "week";

export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Range helpers (returned as UTC ISO for Supabase filtering)
// We add a small buffer to be safe around boundaries.
export function getRangeFor(mode: BucketMode, tzName = getUserTimeZone()) {
  const nowTz = dayjs().tz(tzName);

  if (mode === "week") {
    const start = nowTz.startOf("isoWeek").subtract(12, "week"); // last ~12 weeks incl current
    const end = nowTz.endOf("isoWeek").add(1, "day");
    return { startUtcISO: start.utc().toISOString(), endUtcISO: end.utc().toISOString() };
  }

  // month
  const start = nowTz.startOf("month").subtract(6, "month"); // last ~6 months incl current
  const end = nowTz.endOf("month").add(1, "day");
  return { startUtcISO: start.utc().toISOString(), endUtcISO: end.utc().toISOString() };
}

// Create ordered bucket keys in local TZ
export function makeEmptyBuckets(mode: BucketMode, tzName = getUserTimeZone()) {
  const labels: string[] = [];
  const nowTz = dayjs().tz(tzName);

  if (mode === "week") {
    // last 12 weeks, oldest → newest
    for (let i = 11; i >= 0; i--) {
      const wStart = nowTz.startOf("isoWeek").subtract(i, "week");
      const key = wStart.format("[W]WW YYYY"); // e.g., W39 2025
      labels.push(key);
    }
  } else {
    // last 6 months, oldest → newest
    for (let i = 5; i >= 0; i--) {
      const mStart = nowTz.startOf("month").subtract(i, "month");
      const key = mStart.format("MMM YYYY"); // e.g., Sep 2025
      labels.push(key);
    }
  }

  return labels.map((label) => ({
    label,        // display label
    earnings: 0,  // currency total
    hours: 0,     // total hours
    sessions: 0,  // count
    partial: false, // mark current period to style differently
  }));
}

// Decide the bucket label for a given UTC start time, in local TZ
export function labelFor(mode: BucketMode, utcISO: string, tzName = getUserTimeZone()) {
  const t = dayjs(utcISO).tz(tzName);
  return mode === "week" ? t.startOf("isoWeek").format("[W]WW YYYY") : t.startOf("month").format("MMM YYYY");
}

// Is this the current active bucket? Used to mark partial period
export function isCurrentBucket(mode: BucketMode, label: string, tzName = getUserTimeZone()) {
  const nowTz = dayjs().tz(tzName);
  const currentLabel =
    mode === "week"
      ? nowTz.startOf("isoWeek").format("[W]WW YYYY")
      : nowTz.startOf("month").format("MMM YYYY");
  return label === currentLabel;
}