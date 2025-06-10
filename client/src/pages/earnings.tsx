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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { formatCurrency } from "@/lib/utils";
import { 
  Coins, 
  TrendingUp, 
  Calendar,
  Users
} from "lucide-react";

interface Session {
  id: string;
  student_id: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  created_at: string;
}

interface SessionWithStudent {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  created_at: string;
}

interface StudentEarnings {
  student_name: string;
  total_earnings: number;
  session_count: number;
}

export default function Earnings() {
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
  const queryClient = useQueryClient();

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
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          students (
            name
          )
        `)
        .eq('tutor_id', tutorId)
        .order('date', { ascending: false });

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

    const now = new Date();
    
    // Current week boundaries (Sunday to Saturday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    // Current month boundaries
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // 30 days ago for active students
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalEarnings = 0;
    let thisWeekEarnings = 0;
    let thisMonthEarnings = 0;
    let thisMonthSessions = 0;
    const studentEarningsMap = new Map<string, { total: number; count: number }>();
    const activeStudentsSet = new Set<string>();

    sessions.forEach(session => {
      const sessionDate = new Date(session.date);
      const earnings = (session.duration / 60) * session.rate;
      const isPaid = (session as any).paid === true;
      
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

  const earnings = sessions ? calculateEarnings(sessions) : null;

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
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">💰 Earnings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your income and payment history.
          </p>
        </div>
      </header>

      {/* Earnings Content */}
      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

          {/* Earnings Summary Card with Toggle */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Earnings Summary</CardTitle>
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-green-600" />
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  <button
                    onClick={() => setEarningsView('week')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      earningsView === 'week'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setEarningsView('month')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      earningsView === 'month'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Month
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  earningsView === 'week' 
                    ? earnings?.thisWeekEarnings || 0
                    : earnings?.thisMonthEarnings || 0, 
                  tutorCurrency
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {earningsView === 'week' ? 'Earned This Week' : 'Earned This Month'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions This Month</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {earnings?.thisMonthSessions || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Current month
              </p>
            </CardContent>
          </Card>

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
        </div>

        {/* Earnings by Student Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">🧑‍🎓 Earnings by Student</CardTitle>
          </CardHeader>
          <CardContent>
            {earnings?.studentEarnings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No session data available yet.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-center">Sessions</TableHead>
                    <TableHead className="text-right">Total Earnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings?.studentEarnings.map((student) => (
                    <TableRow key={student.student_name}>
                      <TableCell className="font-medium">
                        {student.student_name}
                      </TableCell>
                      <TableCell className="text-center">
                        {student.session_count}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(student.total_earnings, tutorCurrency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
