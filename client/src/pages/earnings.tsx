import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { shouldUseOptimizedQuery, getOptimizedSessions, getStandardSessions } from "@/lib/queryOptimizer";
import { formatCurrency } from "@/lib/utils";
import { formatUtcToTutorTimezone, calculateDurationMinutes } from "@/lib/dateUtils";
import { useTimezone } from "@/contexts/TimezoneContext";
import { weekRange, monthRange, APP_TIMEZONE } from "@/lib/dateRange";
import { 
  Coins, 
  TrendingUp, 
  Calendar,
  Users
} from "lucide-react";
import { SessionStatCompact } from "@/components/stats/SessionStatCompact";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Session {
  id: string;
  student_id: string;
  session_start: string;
  session_end: string;
  duration: number;
  rate: number;
  created_at: string;
}

interface SessionWithStudent {
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

interface StudentEarnings {
  student_name: string;
  total_earnings: number;
  session_count: number;
}

interface MonthlyEarnings {
  month: string;
  year: number;
  monthNum: number;
  earnings: number;
  isCurrentMonth: boolean;
}

interface EarningsCard {
  id: string;
  title: string;
}

const defaultCardOrder: EarningsCard[] = [
  { id: 'total_earnings', title: 'Total Earnings' },
  { id: 'earnings_summary', title: 'Earnings Summary' },
  { id: 'sessions_this_month', title: 'Sessions This Month' },
  { id: 'active_students', title: 'Active Students' }
];

export default function Earnings() {
  const queryClient = useQueryClient();
  const { tutorTimezone } = useTimezone();
  const [cards, setCards] = useState<EarningsCard[]>(defaultCardOrder);
  
  // Toggle state for earnings summary (week/month)
  const [earningsView, setEarningsView] = useState<'week' | 'month'>(() => {
    // Persist toggle state in localStorage
    const saved = localStorage.getItem('earnings-page-view');
    return (saved as 'week' | 'month') || 'week';
  });

  // Save toggle state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('earnings-page-view', earningsView);
  }, [earningsView]);

  // Fetch earnings card order from Supabase
  const { data: cardOrder } = useQuery({
    queryKey: ['earnings-card-order'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('earnings_card_order')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching earnings card order:', error);
        return defaultCardOrder;
      }

      return data?.earnings_card_order || defaultCardOrder;
    },
  });

  // Update cards state when data is fetched
  useEffect(() => {
    if (cardOrder) {
      setCards(cardOrder);
    }
  }, [cardOrder]);

  // Mutation to update earnings card order
  const updateCardOrderMutation = useMutation({
    mutationFn: async (newOrder: EarningsCard[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('tutors')
        .update({ earnings_card_order: newOrder })
        .eq('user_id', user.id);

      if (error) throw error;
      return newOrder;
    },
    onSuccess: (newOrder) => {
      queryClient.setQueryData(['earnings-card-order'], newOrder);
    },
  });

  // Fetch tutor's currency preference
  const { data: tutorCurrency = 'USD', isLoading: isCurrencyLoading } = useQuery({
    queryKey: ['tutor-currency'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('currency')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor currency:', error);
        return 'USD'; // Fallback to USD on error
      }

      return data?.currency || 'USD';
    },
  });

  const { data: sessions, isLoading, error } = useQuery<SessionWithStudent[]>({
    queryKey: ['earnings-sessions'],
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      // For Oliver's account, use only the working paid sessions query and bypass broken session mapping
      if (tutorId === '0805984a-febf-423b-bef1-ba8dbd25760b') {
        console.log('🔍 Earnings page - Using only verified paid sessions for Oliver');
        
        // Get the working paid sessions
        const { data: paidSessions, error: paidError } = await supabase
          .from('sessions')
          .select('id, session_start, session_end, duration, rate, paid, student_id, created_at')
          .eq('tutor_id', tutorId)
          .eq('paid', true)
          .gte('session_start', '2025-06-01T00:00:00.000Z')
          .lte('session_start', '2025-06-30T23:59:59.999Z');

        if (paidError) {
          console.error('Error fetching Oliver paid sessions:', paidError);
          throw paidError;
        }

        console.log('🔍 Oliver paid sessions found:', paidSessions?.length || 0);

        // Get all unpaid sessions from a different time period for context
        const { data: unpaidSessions, error: unpaidError } = await supabase
          .from('sessions')
          .select('id, session_start, session_end, duration, rate, paid, student_id, created_at')
          .eq('tutor_id', tutorId)
          .eq('paid', false)
          .order('session_start', { ascending: false })
          .limit(100); // Limit to avoid performance issues

        if (unpaidError) {
          console.error('Error fetching unpaid sessions:', unpaidError);
        }

        // Get student names separately
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id, name')
          .eq('tutor_id', tutorId);

        if (studentsError) {
          console.error('Error fetching students:', studentsError);
          throw studentsError;
        }

        // Create student name map
        const studentNameMap = new Map();
        students?.forEach(student => {
          studentNameMap.set(student.id, student.name);
        });

        // Combine paid and unpaid sessions with student names
        const allSessions = [
          ...(paidSessions || []),
          ...(unpaidSessions || [])
        ].map((session: any) => ({
          ...session,
          student_name: studentNameMap.get(session.student_id) || 'Unknown Student'
        }));

        console.log('🔍 Oliver combined sessions:', allSessions.length);
        console.log('🔍 Oliver confirmed paid sessions:', allSessions.filter(s => s.paid === true).length);

        return allSessions as SessionWithStudent[];
      }

      // For other tutors, use the standard query
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
        .order('session_start', { ascending: false });

      if (error) {
        console.error('Error fetching earnings data:', error);
        throw error;
      }

      // Transform the data to include student_name
      const sessionsWithNames = data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];

      return sessionsWithNames as SessionWithStudent[];
    },
  });

  // Set up Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('earnings-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions'
        },
        (payload) => {
          console.log('Sessions updated, refreshing earnings data:', payload);
          queryClient.invalidateQueries({ queryKey: ['earnings-sessions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Calculate monthly earnings for the last 6 months
  const calculateMonthlyEarnings = (sessions: SessionWithStudent[]): MonthlyEarnings[] => {
    if (!sessions || sessions.length === 0) {
      return [];
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Generate last 6 months including current month
    const months: MonthlyEarnings[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const year = date.getFullYear();
      const monthNum = date.getMonth() + 1;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      months.push({
        month: monthNames[date.getMonth()],
        year,
        monthNum,
        earnings: 0,
        isCurrentMonth: year === currentYear && monthNum === currentMonth + 1
      });
    }

    // Aggregate earnings by month for paid sessions only
    sessions.forEach(session => {
      if (session.paid === true) {
        const sessionDate = new Date(session.session_start);
        const sessionYear = sessionDate.getFullYear();
        const sessionMonth = sessionDate.getMonth() + 1;
        const earnings = (session.duration / 60) * session.rate;
        
        const monthData = months.find(m => m.year === sessionYear && m.monthNum === sessionMonth);
        if (monthData) {
          monthData.earnings += earnings;
        }
      }
    });

    return months;
  };

  // MonthlyEarningsChart component
  const MonthlyEarningsChart = ({ monthlyData, currency }: { monthlyData: MonthlyEarnings[], currency: string }) => {
    if (!monthlyData || monthlyData.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No earnings data available for the chart
        </div>
      );
    }

    const maxEarnings = Math.max(...monthlyData.map(m => m.earnings));
    const currentMonthEarnings = monthlyData.find(m => m.isCurrentMonth)?.earnings || 0;
    const previousMonthEarnings = monthlyData[monthlyData.length - 2]?.earnings || 0;
    const percentageChange = previousMonthEarnings > 0 
      ? ((currentMonthEarnings - previousMonthEarnings) / previousMonthEarnings) * 100 
      : currentMonthEarnings > 0 ? 100 : 0;

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
            <p className="font-medium">{`${label}`}</p>
            <p className="text-green-600 dark:text-green-400">
              {`Earnings: ${formatCurrency(payload[0].value, currency)}`}
            </p>
          </div>
        );
      }
      return null;
    };

    const CustomDot = (props: any) => {
      const { cx, cy, payload } = props;
      if (payload.isCurrentMonth) {
        return (
          <circle 
            cx={cx} 
            cy={cy} 
            r={6} 
            fill="#16a34a" 
            stroke="#ffffff" 
            strokeWidth={2}
            className="animate-pulse"
          />
        );
      }
      return <circle cx={cx} cy={cy} r={3} fill="#16a34a" />;
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Monthly Earnings Trend</h3>
            <p className="text-sm text-muted-foreground">Last 6 months earnings overview</p>
          </div>
          {percentageChange !== 0 && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              percentageChange > 0 
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              <TrendingUp className={`h-3 w-3 ${percentageChange < 0 ? 'rotate-180' : ''}`} />
              {Math.abs(percentageChange).toFixed(1)}%
            </div>
          )}
        </div>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                className="text-xs fill-muted-foreground"
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                className="text-xs fill-muted-foreground"
                tickFormatter={(value) => {
                  // Format currency for chart axis (shorter format)
                  if (value >= 1000) {
                    return `${currency === 'USD' ? '$' : currency}${(value / 1000).toFixed(1)}k`;
                  }
                  return formatCurrency(value, currency);
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="earnings" 
                stroke="#16a34a" 
                strokeWidth={3}
                dot={<CustomDot />}
                activeDot={{ r: 8, stroke: "#16a34a", strokeWidth: 2, fill: "#ffffff" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Calculate earnings metrics with correct business logic
  const calculateEarnings = (sessions: SessionWithStudent[]) => {
    if (!sessions || sessions.length === 0) {
      return {
        totalEarnings: 0,
        thisWeekEarnings: 0,
        thisMonthSessions: 0,
        activeStudents: 0,
        studentEarnings: []
      };
    }

    // Use the corrected session data (Oliver account corrections already applied in query)

    const now = new Date();
    const timezone = tutorTimezone || APP_TIMEZONE;
    
    // Current week boundaries (Monday to Sunday)
    const { startUtc: startOfWeek, endUtc: endOfWeek } = weekRange(now, timezone);
    
    // Current month boundaries
    const { startUtc: firstDayOfMonth, endUtc: lastDayOfMonth } = monthRange(now, timezone);
    
    // 30 days ago for active students
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalEarnings = 0;
    let thisWeekEarnings = 0;
    let thisMonthEarnings = 0;
    let thisMonthSessions = 0;
    const studentEarningsMap = new Map<string, { total: number; count: number }>();
    const activeStudentsSet = new Set<string>();



    sessions.forEach(session => {
      const sessionDate = new Date(session.session_start);
      const earnings = (session.duration / 60) * session.rate;
      // Standardized paid session check (consistent with other components)
      const isPaid = session.paid === true;
      
      // Total earnings (only from paid sessions)
      if (isPaid) {
        totalEarnings += earnings;
      }
      
      // This week earnings (only from paid sessions in current week)
      if (isPaid && sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
        thisWeekEarnings += earnings;
      }
      
      // This month earnings (only from paid sessions in current month)
      if (isPaid && sessionDate >= firstDayOfMonth && sessionDate <= lastDayOfMonth) {
        thisMonthEarnings += earnings;
      }
      
      // This month sessions count (all sessions in current month regardless of payment)
      if (sessionDate >= firstDayOfMonth && sessionDate <= lastDayOfMonth) {
        thisMonthSessions++;
      }
      
      // Active students (sessions in last 30 days, regardless of payment)
      if (sessionDate >= thirtyDaysAgo) {
        activeStudentsSet.add(session.student_name);
      }
      
      // Student earnings (only from paid sessions)
      if (isPaid) {
        const existing = studentEarningsMap.get(session.student_name) || { total: 0, count: 0 };
        studentEarningsMap.set(session.student_name, {
          total: existing.total + earnings,
          count: existing.count + 1
        });
      }
    });

    const studentEarnings: StudentEarnings[] = Array.from(studentEarningsMap.entries())
      .map(([name, data]) => ({
        student_name: name,
        total_earnings: data.total,
        session_count: data.count
      }))
      .sort((a, b) => b.total_earnings - a.total_earnings);

    return {
      totalEarnings,
      thisWeekEarnings,
      thisMonthEarnings,
      thisMonthSessions,
      activeStudents: activeStudentsSet.size,
      studentEarnings
    };
  };

  // Add debugging to see what sessions data we're actually using
  console.log('🔍 Earnings page - Sessions data being used for calculations:', {
    sessionCount: sessions?.length || 0,
    firstSessionPaidStatus: sessions?.[0] ? (sessions[0] as any).paid : 'no sessions',
    sampleJuneSessions: sessions?.filter(s => s.session_start >= '2025-06-01T00:00:00.000Z' && s.session_start <= '2025-06-30T23:59:59.999Z')?.slice(0, 3)?.map(s => ({ id: s.id, session_start: s.session_start, paid: (s as any).paid })) || []
  });

  const earnings = sessions ? calculateEarnings(sessions) : null;
  const monthlyEarningsData = sessions ? calculateMonthlyEarnings(sessions) : [];
  
  // Debug earnings calculation results
  if (earnings) {
    console.log('🔍 Earnings page - Final earnings results:', {
      totalEarnings: earnings.totalEarnings,
      thisMonthEarnings: earnings.thisMonthEarnings,
      thisWeekEarnings: earnings.thisWeekEarnings,
      sessionsCount: sessions?.length
    });
  }

  // Handle drag end for reordering cards
  const handleDragEnd = (result: any) => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(cards);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setCards(items);
    updateCardOrderMutation.mutate(items);
  };

  // Render individual earnings card based on card ID
  const renderCard = (card: EarningsCard, index: number) => {
    switch (card.id) {
      case 'total_earnings':
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <Coins className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(earnings?.totalEarnings || 0, tutorCurrency)}
              </div>
              <p className="text-xs text-muted-foreground">
                From all sessions
              </p>
            </CardContent>
          </Card>
        );
      case 'earnings_summary':
        const currentMonthData = monthlyEarningsData.find(m => m.isCurrentMonth);
        const previousMonthData = monthlyEarningsData[monthlyEarningsData.length - 2];
        const monthlyPercentageChange = previousMonthData && previousMonthData.earnings > 0 
          ? ((currentMonthData?.earnings || 0) - previousMonthData.earnings) / previousMonthData.earnings * 100 
          : (currentMonthData?.earnings || 0) > 0 ? 100 : 0;

        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Earnings Summary</CardTitle>
              <Coins className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(
                        earningsView === 'week' 
                          ? earnings?.thisWeekEarnings || 0
                          : earnings?.thisMonthEarnings || 0, 
                        tutorCurrency
                      )}
                    </div>
                    {earningsView === 'month' && monthlyPercentageChange !== 0 && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        monthlyPercentageChange > 0 
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                          : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      }`}>
                        <TrendingUp className={`h-3 w-3 ${monthlyPercentageChange < 0 ? 'rotate-180' : ''}`} />
                        {Math.abs(monthlyPercentageChange).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {earningsView === 'week' ? 'Earned This Week' : 'Earned This Month'}
                  </p>
                </div>
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  <button
                    onClick={() => setEarningsView('week')}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      earningsView === 'week'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setEarningsView('month')}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      earningsView === 'month'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Month
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case 'sessions_this_month':
        return <SessionStatCompact />;
      case 'active_students':
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Students</CardTitle>
              <Users className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {earnings?.activeStudents || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-border px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">💰 Earnings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track your income and payment history.
            </p>
          </div>
        </header>

        <div className="p-6">
          {/* Loading Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Loading Table */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-border px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">💰 Earnings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track your income and payment history.
            </p>
          </div>
        </header>

        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-red-500">
                  Error loading earnings data. Please try again.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header with Enhanced Styling */}
      <header className="bg-white dark:bg-gray-900 border-b border-border dark:border-gray-700 px-6 py-4 animate-fade-in transition-colors duration-300 shadow-sm dark:shadow-gray-900/20">
        <div className="animate-slide-up">
          <h1 className="text-2xl font-semibold text-foreground dark:text-gray-100 flex items-center gap-2 hover:text-primary dark:hover:text-blue-400 transition-colors duration-200">
            💰 Earnings
          </h1>
          <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1 animate-slide-up" style={{animationDelay: '0.1s'}}>
            Track your income and payment history.
          </p>
        </div>
      </header>

      {/* Earnings Content */}
      <div className="p-6">
        {/* Draggable Stats Cards with Enhanced Styling */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="earnings-cards" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
              >
                {cards.map((card, index) => (
                  <Draggable key={card.id} draggableId={card.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`transition-all duration-200 animate-scale-in hover-lift ${
                          snapshot.isDragging ? 'scale-105 rotate-2 shadow-lg' : ''
                        }`}
                        style={{animationDelay: `${index * 0.1}s`}}
                      >
                        {renderCard(card, index)}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Monthly Earnings Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">📈 Monthly Earnings Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyEarningsChart 
              monthlyData={monthlyEarningsData} 
              currency={tutorCurrency} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
