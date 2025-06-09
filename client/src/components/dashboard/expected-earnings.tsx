
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { TrendingUp } from "lucide-react";

interface UpcomingSession {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  paid: boolean;
  created_at: string;
}

interface ExpectedEarningsProps {
  currency?: string;
}

type ExpectedTimeframe = 'next30days' | 'nextMonth' | 'allFuture';

export function ExpectedEarnings({ currency = 'USD' }: ExpectedEarningsProps) {
  // Toggle state for expected earnings timeframe
  const [expectedTimeframe, setExpectedTimeframe] = useState<ExpectedTimeframe>(() => {
    // Persist toggle state in localStorage
    const saved = localStorage.getItem('expected-earnings-timeframe');
    return (saved as ExpectedTimeframe) || 'next30days';
  });

  // Save toggle state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('expected-earnings-timeframe', expectedTimeframe);
  }, [expectedTimeframe]);

  // Fetch upcoming sessions for expected earnings
  const { data: upcomingSessions, isLoading: isLoadingUpcoming } = useQuery({
    queryKey: ['upcoming-sessions-expected'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          student_id,
          date,
          time,
          duration,
          rate,
          paid,
          created_at,
          students (
            name
          )
        `)
        .eq('tutor_id', tutorId)
        .or(`date.gt.${currentDate},and(date.eq.${currentDate},time.gt.${currentTime})`)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) {
        console.error('Error fetching upcoming sessions:', error);
        throw error;
      }

      // Transform the data to include student_name
      return data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];
    },
  });

  // Calculate expected earnings based on timeframe
  const getExpectedEarnings = () => {
    if (!upcomingSessions) return { total: 0, sessions: [], count: 0 };

    const now = new Date();
    let filteredSessions: UpcomingSession[] = [];

    switch (expectedTimeframe) {
      case 'next30days':
        const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        filteredSessions = upcomingSessions.filter(session => {
          const sessionDate = new Date(session.date);
          return sessionDate <= next30Days;
        });
        break;
      case 'nextMonth':
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filteredSessions = upcomingSessions.filter(session => {
          const sessionDate = new Date(session.date);
          return sessionDate <= nextMonth;
        });
        break;
      case 'allFuture':
        filteredSessions = upcomingSessions;
        break;
    }

    const total = filteredSessions.reduce((sum, session) => {
      return sum + (session.duration / 60) * session.rate;
    }, 0);

    return { 
      total, 
      sessions: filteredSessions, 
      count: filteredSessions.length 
    };
  };

  const getTimeframeLabel = () => {
    switch (expectedTimeframe) {
      case 'next30days':
        return 'Next 30 days';
      case 'nextMonth':
        return 'Next calendar month';
      case 'allFuture':
        return 'All future sessions';
      default:
        return 'Next 30 days';
    }
  };

  const expectedEarnings = getExpectedEarnings();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Expected Earnings</CardTitle>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              onClick={() => setExpectedTimeframe('next30days')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                expectedTimeframe === 'next30days'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              30d
            </button>
            <button
              onClick={() => setExpectedTimeframe('nextMonth')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                expectedTimeframe === 'nextMonth'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setExpectedTimeframe('allFuture')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                expectedTimeframe === 'allFuture'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-green-600">
          {isLoadingUpcoming ? "..." : formatCurrency(expectedEarnings.total, currency)}
        </div>
        <p className="text-xs text-muted-foreground">
          from {expectedEarnings.count} upcoming sessions • {getTimeframeLabel()}
        </p>
      </CardContent>
    </Card>
  );
}
