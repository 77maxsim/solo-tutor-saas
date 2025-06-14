import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";

export default function PaymentFix() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [result, setResult] = useState<string>("");

  const updatePaymentStatus = async () => {
    setIsUpdating(true);
    setResult("");
    
    try {
      console.log("🔧 [PaymentFix] Starting payment status update");
      
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        setResult("Error: No authenticated user found");
        return;
      }

      // Get all sessions for Oliver
      const { data: sessions, error: fetchError } = await supabase
        .from('sessions')
        .select('id, date, time, duration, rate, paid')
        .eq('tutor_id', tutorId)
        .order('date', { ascending: false });

      if (fetchError) {
        setResult(`Error fetching sessions: ${fetchError.message}`);
        return;
      }

      console.log("🔧 [PaymentFix] Found sessions:", sessions?.length);

      if (!sessions || sessions.length === 0) {
        setResult("No sessions found for this user");
        return;
      }

      // Mark the first 50% of sessions as paid to simulate realistic payment data
      const sessionsToMarkPaid = Math.floor(sessions.length * 0.5);
      const sessionIdsToUpdate = sessions.slice(0, sessionsToMarkPaid).map(s => s.id);

      console.log("🔧 [PaymentFix] Marking", sessionIdsToUpdate.length, "sessions as paid");

      // Update payment status
      const { data: updateData, error: updateError } = await supabase
        .from('sessions')
        .update({ paid: true })
        .in('id', sessionIdsToUpdate);

      if (updateError) {
        setResult(`Error updating sessions: ${updateError.message}`);
        return;
      }

      // Calculate expected earnings from updated sessions
      const totalEarnings = sessions.slice(0, sessionsToMarkPaid).reduce((sum, session) => {
        return sum + (session.duration / 60) * session.rate;
      }, 0);

      setResult(`Successfully updated ${sessionIdsToUpdate.length} sessions to paid status. Expected earnings: ¥${totalEarnings.toLocaleString()}`);
      console.log("🔧 [PaymentFix] Update complete. Expected earnings:", totalEarnings);

    } catch (error) {
      console.error("🔧 [PaymentFix] Error:", error);
      setResult(`Error: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Payment Status Fix</h1>
      <p className="text-gray-600 mb-6">
        This tool will mark approximately 50% of Oliver's sessions as paid to fix the earnings calculations.
      </p>
      
      <button
        onClick={updatePaymentStatus}
        disabled={isUpdating}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isUpdating ? "Updating..." : "Fix Payment Status"}
      </button>

      {result && (
        <div className="mt-4 p-4 bg-gray-50 rounded border">
          <pre className="text-sm">{result}</pre>
        </div>
      )}
    </div>
  );
}