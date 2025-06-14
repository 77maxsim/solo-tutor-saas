import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { formatCurrency } from "@/lib/utils";

export default function EarningsTest() {
  console.log("🧪 [EarningsTest] Component mounted successfully");

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['test-earnings-sessions'],
    queryFn: async () => {
      console.log("🧪 [EarningsTest] Starting session fetch");
      const tutorId = await getCurrentTutorId();
      console.log("🧪 [EarningsTest] Tutor ID:", tutorId);
      
      if (!tutorId) {
        throw new Error('No tutor ID found');
      }

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          student_id,
          start_time,
          end_time,
          rate,
          is_paid,
          tutor_id,
          students (
            name
          )
        `)
        .eq('tutor_id', tutorId);

      if (error) {
        console.error("🧪 [EarningsTest] Session fetch error:", error);
        throw error;
      }

      console.log("🧪 [EarningsTest] Raw sessions data:", data);
      return data;
    },
  });

  console.log("🧪 [EarningsTest] Component state - loading:", isLoading, "error:", error, "sessions:", sessions?.length);

  if (isLoading) {
    return <div>Loading test...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  // Calculate earnings from sessions
  const totalEarnings = sessions?.reduce((total, session) => {
    if (session.is_paid) {
      const startTime = new Date(session.start_time);
      const endTime = new Date(session.end_time);
      const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      return total + (parseFloat(session.rate) * durationHours);
    }
    return total;
  }, 0) || 0;

  console.log("🧪 [EarningsTest] Calculated total earnings:", totalEarnings);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Earnings Test Page</h1>
      <div className="space-y-4">
        <div>
          <strong>Total Sessions:</strong> {sessions?.length || 0}
        </div>
        <div>
          <strong>Paid Sessions:</strong> {sessions?.filter(s => s.is_paid).length || 0}
        </div>
        <div>
          <strong>Total Earnings:</strong> {formatCurrency(totalEarnings, 'JPY')}
        </div>
        <div>
          <strong>Raw Session Data:</strong>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
            {JSON.stringify(sessions, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}