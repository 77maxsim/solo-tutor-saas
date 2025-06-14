import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export default function EarningsFixed() {
  console.log("🧪 [EarningsFixed] Component mounting");

  // Direct authentication and session fetch without getCurrentTutorId
  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['earnings-fixed'],
    queryFn: async () => {
      console.log("🧪 [EarningsFixed] Starting direct session fetch");
      
      // Get current user directly
      const { data: { user } } = await supabase.auth.getUser();
      console.log("🧪 [EarningsFixed] Auth user:", user?.id);
      
      if (!user) {
        console.log("🧪 [EarningsFixed] No authenticated user - redirecting to auth");
        window.location.href = '/auth';
        return [];
      }

      // Query sessions directly with user.id - try different field names
      console.log("🧪 [EarningsFixed] Fetching sessions for user:", user.id);
      
      // First try with tutor_id field
      let { data, error } = await supabase
        .from('sessions')
        .select('id, student_id, date, time, duration, rate, paid, students(name)')
        .eq('tutor_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        console.log("🧪 [EarningsFixed] tutor_id query failed, trying user_id:", error.message);
        
        // If that fails, try with user_id field
        const result = await supabase
          .from('sessions')
          .select('id, student_id, date, time, duration, rate, paid, students(name)')
          .eq('user_id', user.id)
          .order('date', { ascending: false });
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.log("🧪 [EarningsFixed] Sessions query error:", error);
        throw error;
      }
      
      console.log("🧪 [EarningsFixed] Raw sessions found:", data?.length || 0);
      
      // Log session details
      data?.forEach((session: any, index: number) => {
        if (index < 5) {
          console.log(`🧪 [EarningsFixed] Session ${index + 1}:`, {
            id: session.id,
            date: session.date,
            time: session.time,
            duration: session.duration,
            rate: session.rate,
            paid: session.paid,
            student: session.students?.name
          });
        }
      });

      return data || [];
    },
  });

  if (isLoading) {
    console.log("🧪 [EarningsFixed] Loading sessions...");
    return <div className="p-6">Loading earnings...</div>;
  }
  
  if (error) {
    console.log("🧪 [EarningsFixed] Error:", error);
    return <div className="p-6">Error loading earnings: {error.message}</div>;
  }

  // Calculate earnings
  console.log("🧪 [EarningsFixed] Calculating earnings for", sessions?.length || 0, "sessions");
  
  const totalEarnings = sessions?.reduce((sum: number, session: any) => {
    if (session.paid) {
      const earnings = (session.duration / 60) * session.rate;
      console.log(`🧪 [EarningsFixed] Paid session ${session.id}: ${session.duration}min × ¥${session.rate}/hr = ¥${earnings}`);
      return sum + earnings;
    }
    return sum;
  }, 0) || 0;

  const paidSessions = sessions?.filter((s: any) => s.paid) || [];
  const unpaidSessions = sessions?.filter((s: any) => !s.paid) || [];
  
  console.log("🧪 [EarningsFixed] Final calculations:", {
    totalSessions: sessions?.length || 0,
    paidSessions: paidSessions.length,
    unpaidSessions: unpaidSessions.length,
    totalEarnings
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">💰 Earnings</h1>
        <p className="text-sm text-gray-500">Track your income and payment history</p>
      </div>

      {/* Earnings Summary */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-lg text-white">
          <h3 className="text-lg font-medium opacity-90">Total Earnings</h3>
          <div className="text-3xl font-bold mt-2">¥{totalEarnings.toLocaleString()}</div>
          <p className="text-sm opacity-80 mt-1">From all sessions</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-700">Paid Sessions</h3>
          <div className="text-3xl font-bold text-green-600 mt-2">{paidSessions.length}</div>
          <p className="text-sm text-gray-500 mt-1">Completed payments</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-700">Pending Sessions</h3>
          <div className="text-3xl font-bold text-orange-500 mt-2">{unpaidSessions.length}</div>
          <p className="text-sm text-gray-500 mt-1">Awaiting payment</p>
        </div>
      </div>

      {/* Session Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Paid Sessions */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">✅ Paid Sessions</h2>
            <p className="text-sm text-gray-500">Recent completed payments</p>
          </div>
          <div className="p-6">
            {paidSessions.length > 0 ? (
              <div className="space-y-4">
                {paidSessions.slice(0, 10).map((session: any) => (
                  <div key={session.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="font-medium text-gray-900">
                        {session.students?.name || 'Unknown Student'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {session.date} at {session.time} • {session.duration} min
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        ¥{((session.duration / 60) * session.rate).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        ¥{session.rate}/hr
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">💸</div>
                <p>No paid sessions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Unpaid Sessions */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">⏳ Pending Sessions</h2>
            <p className="text-sm text-gray-500">Sessions awaiting payment</p>
          </div>
          <div className="p-6">
            {unpaidSessions.length > 0 ? (
              <div className="space-y-4">
                {unpaidSessions.slice(0, 10).map((session: any) => (
                  <div key={session.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="font-medium text-gray-900">
                        {session.students?.name || 'Unknown Student'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {session.date} at {session.time} • {session.duration} min
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-orange-500">
                        ¥{((session.duration / 60) * session.rate).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        ¥{session.rate}/hr
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">✨</div>
                <p>All sessions are paid!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Debug Info */}
      <div className="bg-gray-50 p-4 rounded border text-xs text-gray-600">
        <strong>Debug Info:</strong> Found {sessions?.length || 0} total sessions, 
        {paidSessions.length} paid, {unpaidSessions.length} unpaid. 
        Total earnings: ¥{totalEarnings.toLocaleString()}
      </div>
    </div>
  );
}