
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { TrendingUp } from "lucide-react";

// Import dayjs for timezone handling
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

interface UpcomingSession {
  id: string;
  student_id: string;
  student_name: string;
  session_start: string;
  session_end: string;
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

      // Get tutor timezone for accurate calculations
      const { data: tutorInfo } = await supabase
        .from('tutors')
        .select('timezone')
        .eq('id', tutorId)
        .single();
      
      const tutorTimezone = tutorInfo?.timezone;
      console.log('📦 ExpectedEarnings: Using tutor timezone:', tutorTimezone);

      const now = new Date();

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          student_id,
          session_start,
          session_end,
          duration,
          rate,
          paid,
          created_at,
          students (
            name
          )
        `)
        .eq('tutor_id', tutorId)
        .gte('session_start', now.toISOString())
        .order('session_start', { ascending: true });

      if (error) {
        console.error('Error fetching upcoming sessions:', error);
        throw error;
      }

      // Transform the data to include student_name and store timezone
      const sessions = data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];
      
      // Attach timezone info for calculations
      return { sessions, tutorTimezone };
    },
  });

  // Calculate expected earnings based on timeframe
  const getExpectedEarnings = () => {
    if (!upcomingSessions) return { total: 0, sessions: [], count: 0 };

    const { sessions, tutorTimezone } = upcomingSessions;
    let filteredSessions: UpcomingSession[] = [];

    switch (expectedTimeframe) {
      case 'next30days':
        const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        filteredSessions = sessions.filter(session => {
          const sessionDate = new Date(session.session_start);
          return sessionDate <= next30Days;
        });
        break;
      case 'nextMonth':
        // Use timezone-aware calculation for "next calendar month" (1st to last day of next month only)
        let startOfNextMonth: Date;
        let endOfNextMonth: Date;
        
        if (tutorTimezone) {
          // Get start and end of next month in tutor's timezone
          const nowInTimezone = dayjs().tz(tutorTimezone);
          startOfNextMonth = nowInTimezone.add(1, 'month').startOf('month').toDate();
          endOfNextMonth = nowInTimezone.add(1, 'month').endOf('month').toDate();
          console.log('📦 ExpectedEarnings: Next month range in', tutorTimezone, ':', 
            startOfNextMonth.toISOString(), 'to', endOfNextMonth.toISOString());
        } else {
          // Fallback to local time
          const now = new Date();
          startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
          endOfNextMonth.setHours(23, 59, 59, 999);
        }
        
        filteredSessions = sessions.filter(session => {
          const sessionDate = new Date(session.session_start);
          return sessionDate >= startOfNextMonth && sessionDate <= endOfNextMonth;
        });
        break;
      case 'allFuture':
        filteredSessions = sessions;
        break;
    }

    const total = filteredSessions.reduce((sum, session) => {
      return sum + (session.duration / 60) * session.rate;
    }, 0);

    console.log('📦 ExpectedEarnings:', expectedTimeframe, 'total:', total, 'from', filteredSessions.length, 'sessions');

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
    <Card className="hover-lift cursor-pointer transition-all duration-300 group hover:shadow-lg hover:shadow-green-100/50 border-2 hover:border-green-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium group-hover:text-green-600 transition-colors duration-200">Expected Earnings</CardTitle>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600 group-hover:scale-110 group-hover:animate-bounce-subtle transition-all duration-300" />
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
        <div className="text-2xl font-bold text-green-600 group-hover:scale-105 transition-transform duration-200">
          {isLoadingUpcoming ? "..." : formatCurrency(expectedEarnings.total, currency)}
        </div>
        <p className="text-xs text-muted-foreground group-hover:text-green-600/70 transition-colors duration-200">
          from {expectedEarnings.count} upcoming sessions • {getTimeframeLabel()}
        </p>
      </CardContent>
    </Card>
  );
}
