import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import type { CancellationStats } from "@shared/schema";

interface CancellationStatsOptions {
  studentId?: string;
  minSessions?: number;
  daysBack?: number; // Number of days to look back (default 90)
}

const MIN_SESSIONS_FOR_RATE = 5;
const DEFAULT_DAYS_BACK = 90;

export function useCancellationStats(options: CancellationStatsOptions = {}) {
  const { studentId, minSessions = MIN_SESSIONS_FOR_RATE, daysBack = DEFAULT_DAYS_BACK } = options;

  return useQuery({
    queryKey: ["cancellation-stats", studentId || "all", daysBack],
    queryFn: async (): Promise<CancellationStats & { hasEnoughData: boolean; rawCounts: { cancelled: number; completed: number }; daysBack: number }> => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error("User not authenticated or tutor record not found");
      }

      // Calculate the date cutoff for the time window
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      const cutoffIso = cutoffDate.toISOString();

      let query = supabase
        .from("sessions")
        .select("id, status, cancellation_reason, bulk_excluded, session_end, session_start")
        .eq("tutor_id", tutorId)
        .gte("session_start", cutoffIso);

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
        daysBack,
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

// Detailed cancellation data for the modal
export interface CancelledSession {
  id: string;
  student_id: string;
  student_name: string;
  session_start: string;
  cancellation_reason: string | null;
}

export interface CancellationDetails {
  cancelledSessions: CancelledSession[];
  topStudents: { studentId: string; studentName: string; count: number }[];
  reasonBreakdown: { reason: string; count: number }[];
}

export function useCancellationDetails(options: { daysBack?: number; enabled?: boolean } = {}) {
  const { daysBack = DEFAULT_DAYS_BACK, enabled = true } = options;

  return useQuery({
    queryKey: ["cancellation-details", daysBack],
    queryFn: async (): Promise<CancellationDetails> => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error("User not authenticated or tutor record not found");
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      const cutoffIso = cutoffDate.toISOString();

      const { data: sessions, error } = await supabase
        .from("sessions")
        .select("id, student_id, session_start, cancellation_reason, bulk_excluded, status")
        .eq("tutor_id", tutorId)
        .eq("status", "cancelled")
        .gte("session_start", cutoffIso)
        .order("session_start", { ascending: false });

      if (error) {
        console.error("Error fetching cancellation details:", error);
        throw error;
      }

      const cancelledSessions = sessions?.filter(s => !s.bulk_excluded) || [];

      // Get unique student IDs
      const studentIds = Array.from(new Set(cancelledSessions.map(s => s.student_id)));

      // Fetch student names (guard against empty array)
      let students: { id: string; name: string }[] = [];
      if (studentIds.length > 0) {
        const { data } = await supabase
          .from("students")
          .select("id, name")
          .in("id", studentIds);
        students = data || [];
      }

      const studentMap = new Map(students?.map(s => [s.id, s.name]) || []);

      // Map sessions with student names
      const sessionsWithNames: CancelledSession[] = cancelledSessions.map(s => ({
        id: s.id,
        student_id: s.student_id,
        student_name: studentMap.get(s.student_id) || "Unknown",
        session_start: s.session_start,
        cancellation_reason: s.cancellation_reason,
      }));

      // Calculate top students by cancellation count
      const studentCounts = new Map<string, { name: string; count: number }>();
      for (const session of sessionsWithNames) {
        const existing = studentCounts.get(session.student_id);
        if (existing) {
          existing.count++;
        } else {
          studentCounts.set(session.student_id, { name: session.student_name, count: 1 });
        }
      }
      const topStudents = Array.from(studentCounts.entries())
        .map(([studentId, data]) => ({ studentId, studentName: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate reason breakdown
      const reasonCounts = new Map<string, number>();
      for (const session of sessionsWithNames) {
        const reason = session.cancellation_reason || "unspecified";
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      }
      const reasonBreakdown = Array.from(reasonCounts.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      return {
        cancelledSessions: sessionsWithNames,
        topStudents,
        reasonBreakdown,
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
