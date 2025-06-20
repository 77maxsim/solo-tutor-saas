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
        .select('id')
        .eq('tutor_id', tutorId)
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching pending sessions:', error);
        return 0;
      }

      return data.length;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}