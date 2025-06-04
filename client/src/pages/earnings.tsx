import { useEffect } from "react";
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
  DollarSign, 
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
        throw error;
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

  // Calculate earnings metrics
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
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalEarnings = 0;
    let thisWeekEarnings = 0;
    let thisMonthSessions = 0;
    const studentEarningsMap = new Map<string, { total: number; count: number }>();
    const activeStudentsSet = new Set<string>();

    sessions.forEach(session => {
      const sessionDate = new Date(session.date);
      const earnings = (session.duration / 60) * session.rate;
      
      // Total earnings
      totalEarnings += earnings;
      
      // This week earnings
      if (sessionDate >= oneWeekAgo) {
        thisWeekEarnings += earnings;
      }
      
      // This month sessions
      if (sessionDate >= firstDayOfMonth) {
        thisMonthSessions++;
      }
      
      // Active students (sessions in last 30 days)
      if (sessionDate >= thirtyDaysAgo) {
        activeStudentsSet.add(session.student_name);
      }
      
      // Student earnings
      const existing = studentEarningsMap.get(session.student_name) || { total: 0, count: 0 };
      studentEarningsMap.set(session.student_name, {
        total: existing.total + earnings,
        count: existing.count + 1
      });
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
            <h1 className="text-2xl font-semibold text-foreground">Earnings</h1>
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
            <h1 className="text-2xl font-semibold text-foreground">Earnings</h1>
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
          <h1 className="text-2xl font-semibold text-foreground">Earnings</h1>
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
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(earnings?.totalEarnings || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                From all sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(earnings?.thisWeekEarnings || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Last 7 days
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
            <CardTitle>Earnings by Student</CardTitle>
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
                        {formatCurrency(student.total_earnings)}
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
