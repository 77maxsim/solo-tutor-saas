import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export function usePendingSessions() {
  const { toast } = useToast();
  const previousCountRef = useRef<number>(0);

  const query = useQuery({
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

  // Show toast notification when new pending requests arrive
  useEffect(() => {
    const currentCount = query.data || 0;
    const previousCount = previousCountRef.current;

    if (currentCount > previousCount && previousCount > 0) {
      const newRequestsCount = currentCount - previousCount;
      toast({
        title: "New Booking Request",
        description: `You have ${newRequestsCount} new pending booking request${newRequestsCount > 1 ? 's' : ''}`,
        duration: 5000,
      });
    }

    previousCountRef.current = currentCount;
  }, [query.data, toast]);

  return query;
}