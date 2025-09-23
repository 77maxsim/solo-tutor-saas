import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { DateTime } from 'luxon';

export type TimeframeType = 'week' | 'month';
export type MetricType = 'sessions' | 'hours';

interface SessionStatsResult {
  completed: number;
  upcoming: number;
  total: number;
  isLoading: boolean;
  error: Error | null;
}

interface SessionData {
  id: string;
  session_start: string;
  session_end: string;
  duration: number;
  status: string;
}

export function useSessionStats(timeframe: TimeframeType, metric: MetricType): SessionStatsResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['session-stats', timeframe, metric],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      // Calculate timeframe boundaries
      const now = DateTime.utc();
      let startOfPeriod: DateTime;
      let endOfPeriod: DateTime;

      if (timeframe === 'week') {
        // Start of current week (Monday)
        startOfPeriod = now.startOf('week');
        endOfPeriod = now.endOf('week');
      } else {
        // Start of current month
        startOfPeriod = now.startOf('month');
        endOfPeriod = now.endOf('month');
      }

      // Query sessions in the selected timeframe
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('id, session_start, session_end, duration, status')
        .eq('tutor_id', tutorId)
        .gte('session_start', startOfPeriod.toISO())
        .lte('session_end', endOfPeriod.toISO())
        .order('session_start', { ascending: true });

      if (error) {
        console.error('Error fetching session stats:', error);
        throw error;
      }

      const sessionData = sessions || [];
      
      // Calculate completed and upcoming based on current time
      const currentTime = now.toISO();
      let completedValue = 0;
      let upcomingValue = 0;
      let totalValue = 0;

      sessionData.forEach((session: SessionData) => {
        const isCompleted = session.session_end < currentTime;
        const isUpcoming = session.session_start >= currentTime;
        
        if (metric === 'sessions') {
          totalValue += 1;
          if (isCompleted) {
            completedValue += 1;
          } else if (isUpcoming) {
            upcomingValue += 1;
          }
        } else {
          // metric === 'hours'
          const sessionHours = session.duration / 60; // Convert minutes to hours
          totalValue += sessionHours;
          if (isCompleted) {
            completedValue += sessionHours;
          } else if (isUpcoming) {
            upcomingValue += sessionHours;
          }
        }
      });

      return {
        completed: metric === 'hours' ? Math.round(completedValue * 10) / 10 : Math.round(completedValue), // Round hours to 1 decimal
        upcoming: metric === 'hours' ? Math.round(upcomingValue * 10) / 10 : Math.round(upcomingValue),
        total: metric === 'hours' ? Math.round(totalValue * 10) / 10 : Math.round(totalValue),
      };
    },
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 60000, // Refetch every minute to update completed/upcoming status
  });

  return {
    completed: data?.completed || 0,
    upcoming: data?.upcoming || 0,
    total: data?.total || 0,
    isLoading,
    error: error as Error | null,
  };
}