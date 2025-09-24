// client/src/hooks/useEarningsBuckets.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { BucketMode, getRangeFor, getUserTimeZone, makeEmptyBuckets, labelFor, isCurrentBucket } from "@/lib/timeBuckets";

type Row = {
  id: string;
  session_start: string; // UTC ISO
  session_end: string;   // UTC ISO
  duration: number;      // in minutes
  rate: number;          // hourly rate
  paid?: boolean;
};

// Hours from two ISO strings (timezone agnostic)
function hoursBetween(startISO: string, endISO: string) {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  const ms = Math.max(0, end - start);
  return ms / (1000 * 60 * 60);
}

function computeEarnings(row: Row) {
  // Calculate earnings using duration (in minutes) and hourly rate
  const earnings = (row.duration / 60) * row.rate;
  return Number(earnings.toFixed(2));
}

export function useEarningsBuckets(mode: BucketMode, tutorId?: string) {
  const tzName = getUserTimeZone();
  const { startUtcISO, endUtcISO } = getRangeFor(mode, tzName);

  return useQuery({
    queryKey: ["earnings-buckets", mode, tutorId, startUtcISO, endUtcISO, tzName],
    queryFn: async () => {
      let q = supabase
        .from("sessions")
        .select("id, session_start, session_end, duration, rate, tutor_id, paid")
        .gte("session_start", startUtcISO)
        .lte("session_start", endUtcISO);
      if (tutorId) q = q.eq("tutor_id", tutorId);

      const { data, error } = await q;
      if (error) throw error;

      const buckets = makeEmptyBuckets(mode, tzName);
      const index = new Map(buckets.map((b, i) => [b.label, i]));

      (data ?? []).forEach((row: Row) => {
        if (!row.session_start || !row.session_end) return;

        const bucketLabel = labelFor(mode, row.session_start, tzName);
        const idx = index.get(bucketLabel);
        if (idx === undefined) return;

        const h = hoursBetween(row.session_start, row.session_end);
        const earn = computeEarnings(row);

        // Only count earnings if session is paid
        if (row.paid === true) {
          buckets[idx].earnings += earn;
        }
        
        buckets[idx].hours += h;
        buckets[idx].sessions += 1;
      });

      // round for display and mark current period as partial (style)
      buckets.forEach((b) => {
        b.hours = Number(b.hours.toFixed(1));
        b.earnings = Number(b.earnings.toFixed(2));
        b.partial = isCurrentBucket(mode, b.label, tzName);
      });

      return buckets;
    },
  });
}