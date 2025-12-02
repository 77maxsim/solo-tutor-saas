import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import type { CancellationStats } from "@shared/schema";

interface CancellationStatsOptions {
  studentId?: string;
  minSessions?: number;
}

const MIN_SESSIONS_FOR_RATE = 5;

export function useCancellationStats(options: CancellationStatsOptions = {}) {
  const { studentId, minSessions = MIN_SESSIONS_FOR_RATE } = options;

  return useQuery({
    queryKey: ["cancellation-stats", studentId || "all"],
    queryFn: async (): Promise<CancellationStats & { hasEnoughData: boolean; rawCounts: { cancelled: number; completed: number } }> => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error("User not authenticated or tutor record not found");
      }

      let query = supabase
        .from("sessions")
        .select("id, status, cancellation_reason, bulk_excluded, session_end")
        .eq("tutor_id", tutorId);

      if (studentId) {
        query = query.eq("student_id", studentId);
      }

      const { data: sessions, error } = await query;

      if (error) {
        console.error("Error fetching cancellation stats:", error);
        throw error;
      }

      const now = new Date();
      
      const cancelledSessions = sessions?.filter(
        (s) => s.status === "cancelled" && !s.bulk_excluded
      ) || [];
      
      const completedSessions = sessions?.filter(
        (s) => s.status === "completed" || (s.session_end && new Date(s.session_end) < now)
      ) || [];

      const totalCancelled = cancelledSessions.length;
      const totalCompleted = completedSessions.length;
      const totalRelevant = totalCancelled + totalCompleted;

      const tutorCancelled = cancelledSessions.filter(
        (s) => s.cancellation_reason === "tutor"
      ).length;
      
      const studentCancelled = cancelledSessions.filter(
        (s) => s.cancellation_reason === "student"
      ).length;

      const cancellationRate = totalRelevant > 0
        ? (totalCancelled / totalRelevant) * 100
        : 0;

      const tutorCancellationRate = totalRelevant > 0
        ? (tutorCancelled / totalRelevant) * 100
        : 0;

      const studentCancellationRate = totalRelevant > 0
        ? (studentCancelled / totalRelevant) * 100
        : 0;

      const hasEnoughData = totalRelevant >= minSessions;

      return {
        totalCancelled,
        totalCompleted,
        tutorCancelled,
        studentCancelled,
        cancellationRate,
        tutorCancellationRate,
        studentCancellationRate,
        hasEnoughData,
        rawCounts: {
          cancelled: totalCancelled,
          completed: totalCompleted,
        },
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function formatCancellationRate(
  rate: number,
  hasEnoughData: boolean,
  rawCounts?: { cancelled: number; completed: number }
): string {
  if (!hasEnoughData && rawCounts) {
    return `${rawCounts.cancelled} of ${rawCounts.cancelled + rawCounts.completed}`;
  }
  return `${rate.toFixed(1)}%`;
}
