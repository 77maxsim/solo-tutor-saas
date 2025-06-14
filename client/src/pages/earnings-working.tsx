import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

export default function EarningsWorking() {
  const [timeFilter, setTimeFilter] = useState('today');

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['earnings-working', timeFilter],
    queryFn: async () => {
      // Get current user directly from auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('tutor_id', user.id);

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6">Error: {error.message}</div>;

  // Calculate earnings based on time filter
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const getStartDate = () => {
    switch (timeFilter) {
      case 'today':
        return today;
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        return startOfWeek.toISOString().split('T')[0];
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return startOfMonth.toISOString().split('T')[0];
      default:
        return '2000-01-01'; // All time
    }
  };

  const filteredSessions = sessions?.filter(session => {
    if (!session.paid) return false;
    const startDate = getStartDate();
    return session.date >= startDate;
  }) || [];

  const totalEarnings = filteredSessions.reduce((sum, session) => {
    return sum + (session.duration / 60) * session.rate;
  }, 0);

  const paidSessionsCount = filteredSessions.length;
  const allPaidSessions = sessions?.filter(s => s.paid) || [];
  const allTimeEarnings = allPaidSessions.reduce((sum, session) => {
    return sum + (session.duration / 60) * session.rate;
  }, 0);

  console.log(`Earnings calculation: ${paidSessionsCount} paid sessions = ¥${totalEarnings}`);
  console.log(`All time: ${allPaidSessions.length} paid sessions = ¥${allTimeEarnings}`);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Earnings</h1>
        <div className="flex gap-2">
          {['today', 'week', 'month', 'all'].map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-3 py-1 rounded ${
                timeFilter === filter 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-lg text-white">
          <h3 className="text-lg font-medium opacity-90">
            {timeFilter === 'today' ? 'Today' : 
             timeFilter === 'week' ? 'This Week' :
             timeFilter === 'month' ? 'This Month' : 'All Time'} Earnings
          </h3>
          <div className="text-3xl font-bold mt-2">¥{totalEarnings.toLocaleString()}</div>
          <p className="text-sm opacity-75 mt-1">{paidSessionsCount} paid sessions</p>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-lg text-white">
          <h3 className="text-lg font-medium opacity-90">All Time Total</h3>
          <div className="text-3xl font-bold mt-2">¥{allTimeEarnings.toLocaleString()}</div>
          <p className="text-sm opacity-75 mt-1">{allPaidSessions.length} paid sessions</p>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-lg text-white">
          <h3 className="text-lg font-medium opacity-90">Total Sessions</h3>
          <div className="text-3xl font-bold mt-2">{sessions?.length || 0}</div>
          <p className="text-sm opacity-75 mt-1">
            {sessions?.filter(s => !s.paid).length || 0} unpaid
          </p>
        </div>
      </div>

      {/* Recent Paid Sessions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Paid Sessions</h3>
        <div className="space-y-3">
          {filteredSessions.slice(0, 10).map((session) => (
            <div key={session.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div>
                <div className="font-medium">Session on {session.date}</div>
                <div className="text-sm text-gray-600">{session.time} • {session.duration} minutes</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-600">
                  ¥{((session.duration / 60) * session.rate).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">¥{session.rate}/hour</div>
              </div>
            </div>
          ))}
          
          {filteredSessions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No paid sessions found for the selected time period
            </div>
          )}
        </div>
      </div>

      {/* Debug Info */}
      <div className="bg-gray-100 p-4 rounded text-sm">
        <h4 className="font-bold">Debug Information:</h4>
        <p>Total sessions: {sessions?.length || 0}</p>
        <p>Paid sessions (all time): {allPaidSessions.length}</p>
        <p>Paid sessions ({timeFilter}): {paidSessionsCount}</p>
        <p>Filter start date: {getStartDate()}</p>
      </div>
    </div>
  );
}