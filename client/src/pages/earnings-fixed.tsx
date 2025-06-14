import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

interface SessionData {
  id: string;
  student_id: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  paid: boolean;
  created_at: string;
  students: { name: string } | null;
}

interface SessionWithStudent extends SessionData {
  student_name: string;
}

export default function EarningsFixed() {
  console.log("🧪 [EarningsFixed] Component mounted successfully");

  // Fetch tutor's currency preference
  const { data: tutorCurrency = 'USD', isLoading: isCurrencyLoading } = useQuery({
    queryKey: ['tutor-currency'],
    queryFn: async () => {
      console.log("🧪 [EarningsFixed] Fetching tutor currency...");
      const { data: { user } } = await supabase.auth.getUser();
      console.log("🧪 [EarningsFixed] Current user from auth:", user?.id, user?.email);
      
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('currency')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor currency:', error);
        return 'USD';
      }

      console.log("🧪 [EarningsFixed] Tutor currency fetched:", data?.currency);
      return data?.currency || 'USD';
    },
  });

  // Use the exact same query pattern as the working Dashboard
  const { data: sessions, isLoading, error } = useQuery<SessionWithStudent[]>({
    queryKey: ['earnings-sessions-fixed'],
    queryFn: async () => {
      console.log("🧪 [EarningsFixed] Sessions queryFn started executing");
      const tutorId = await getCurrentTutorId();
      console.log("🧪 [EarningsFixed] Current tutor ID:", tutorId);
      
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      // Copy the exact query from the working Dashboard Expected Earnings component
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
        .order('date', { ascending: false });

      console.log("🧪 [EarningsFixed] Raw fetched session data:", data);
      console.log("🧪 [EarningsFixed] Any errors from Supabase:", error);
      console.log("🧪 [EarningsFixed] Number of sessions fetched:", data?.length || 0);

      if (error) {
        console.error('Error fetching earnings data:', error);
        throw error;
      }

      // Transform the data to include student_name (same as Dashboard)
      const sessionsWithNames = data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];

      console.log("🧪 [EarningsFixed] Transformed sessions with names:", sessionsWithNames);
      return sessionsWithNames as SessionWithStudent[];
    },
  });

  // Calculate earnings using the same logic as Dashboard but for all paid sessions
  const calculateEarnings = (sessions: SessionWithStudent[]) => {
    console.log("🧪 [EarningsFixed] Calculating earnings for sessions:", sessions?.length);
    
    if (!sessions || sessions.length === 0) {
      console.log("🧪 [EarningsFixed] No sessions found, returning zero earnings");
      return {
        totalEarnings: 0,
        thisWeekEarnings: 0,
        thisMonthEarnings: 0,
        thisMonthSessions: 0,
        activeStudents: 0,
        studentEarnings: []
      };
    }

    const now = new Date();
    
    // Calculate total earnings from ALL paid sessions
    const totalEarnings = sessions.reduce((total, session) => {
      if (session.paid) {
        const earnings = (session.duration / 60) * session.rate; // duration in minutes, rate per hour
        console.log(`🧪 [EarningsFixed] Session ${session.id}: duration=${session.duration}min, rate=${session.rate}, earnings=${earnings}`);
        return total + earnings;
      }
      return total;
    }, 0);

    // Calculate this week's earnings
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const thisWeekEarnings = sessions.reduce((total, session) => {
      const sessionDate = new Date(session.date);
      if (session.paid && sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
        return total + (session.duration / 60) * session.rate;
      }
      return total;
    }, 0);

    // Calculate this month's earnings
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const thisMonthEarnings = sessions.reduce((total, session) => {
      const sessionDate = new Date(session.date);
      if (session.paid && sessionDate >= startOfMonth && sessionDate <= endOfMonth) {
        return total + (session.duration / 60) * session.rate;
      }
      return total;
    }, 0);

    const thisMonthSessions = sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startOfMonth && sessionDate <= endOfMonth;
    }).length;

    const activeStudents = new Set(sessions.map(s => s.student_id)).size;

    const result = {
      totalEarnings,
      thisWeekEarnings,
      thisMonthEarnings,
      thisMonthSessions,
      activeStudents,
      studentEarnings: []
    };

    console.log("🧪 [EarningsFixed] Final earnings calculation:", result);
    return result;
  };

  const earnings = sessions ? calculateEarnings(sessions) : null;

  if (isLoading || isCurrencyLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Earnings</h1>
          <p className="text-muted-foreground">Track your income and payment history.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[120px]" />
                <Skeleton className="h-3 w-[80px] mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Error loading earnings data</h2>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Earnings</h1>
        <p className="text-muted-foreground">Track your income and payment history.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Earnings Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Earnings Summary</CardTitle>
            <Coins className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(earnings?.thisWeekEarnings || 0, tutorCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">Earned This Week</p>
          </CardContent>
        </Card>

        {/* Total Earnings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(earnings?.totalEarnings || 0, tutorCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">From all sessions</p>
          </CardContent>
        </Card>

        {/* Sessions This Month */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions This Month</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {earnings?.thisMonthSessions || 0}
            </div>
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>

        {/* Active Students */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {earnings?.activeStudents || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Debug Information */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><strong>Total Sessions:</strong> {sessions?.length || 0}</div>
            <div><strong>Paid Sessions:</strong> {sessions?.filter(s => s.paid).length || 0}</div>
            <div><strong>This Month Earnings:</strong> {formatCurrency(earnings?.thisMonthEarnings || 0, tutorCurrency)}</div>
            <div><strong>Currency:</strong> {tutorCurrency}</div>
          </div>
        </CardContent>
      </Card>

      {/* Session Data Table */}
      {sessions && sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Student</th>
                    <th className="text-left p-2">Duration</th>
                    <th className="text-left p-2">Rate</th>
                    <th className="text-left p-2">Paid</th>
                    <th className="text-left p-2">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 10).map((session) => (
                    <tr key={session.id} className="border-b">
                      <td className="p-2">{session.date}</td>
                      <td className="p-2">{session.student_name}</td>
                      <td className="p-2">{session.duration} min</td>
                      <td className="p-2">{formatCurrency(session.rate, tutorCurrency)}/hr</td>
                      <td className="p-2">{session.paid ? '✅' : '❌'}</td>
                      <td className="p-2">
                        {session.paid ? formatCurrency((session.duration / 60) * session.rate, tutorCurrency) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}