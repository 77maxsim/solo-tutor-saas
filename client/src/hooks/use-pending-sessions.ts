import { useQuery } from "@tanstack/react-query";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { supabase } from "@/lib/supabaseClient";

export function usePendingSessions() {
  return useQuery({
    queryKey: ['pending-sessions-count'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) return 0;

      const { data, error } = await supabase
        .from('sessions')
        .select('id, student_id, unassigned_name')
        .eq('tutor_id', tutorId)
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching pending sessions:', error);
        return 0;
      }

      // Only count sessions that are truly pending (status = 'pending' AND student_id IS NULL)
      const truePendingCount = data?.filter(session => 
        session.student_id === null
      ).length || 0;

      return truePendingCount;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}