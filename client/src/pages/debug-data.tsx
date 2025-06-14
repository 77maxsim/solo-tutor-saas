import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DebugData() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDebugData() {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        console.log("Debug: Current user:", user?.email);

        // Get tutor record for current user
        const { data: tutor } = await supabase
          .from('tutors')
          .select('*')
          .eq('user_id', user?.id)
          .single();

        console.log("Debug: Tutor record:", tutor);

        // Get all sessions for this tutor
        const { data: sessions } = await supabase
          .from('sessions')
          .select(`
            *,
            students (*)
          `)
          .eq('tutor_id', tutor?.id);

        console.log("Debug: Sessions:", sessions);

        // Get all tutors for comparison
        const { data: allTutors } = await supabase
          .from('tutors')
          .select('id, full_name, email, user_id');

        console.log("Debug: All tutors:", allTutors);

        setData({
          currentUser: user,
          currentTutor: tutor,
          sessions: sessions,
          allTutors: allTutors
        });
      } catch (error) {
        console.error("Debug error:", error);
        setData({ error: error.message });
      } finally {
        setLoading(false);
      }
    }

    fetchDebugData();
  }, []);

  if (loading) return <div>Loading debug data...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug Data Inspector</h1>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Current User</h2>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(data?.currentUser, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Current Tutor Record</h2>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(data?.currentTutor, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Sessions for Current Tutor</h2>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-96">
            {JSON.stringify(data?.sessions, null, 2)}
          </pre>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">All Tutors (for comparison)</h2>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(data?.allTutors, null, 2)}
          </pre>
        </div>

        {data?.error && (
          <div>
            <h2 className="text-lg font-semibold mb-2 text-red-600">Error</h2>
            <div className="bg-red-100 p-3 rounded text-sm">
              {data.error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}