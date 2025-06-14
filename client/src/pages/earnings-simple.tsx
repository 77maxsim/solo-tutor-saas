import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { formatCurrency } from "@/lib/utils";
import { Coins, TrendingUp, Calendar, Users } from "lucide-react";

export default function EarningsSimple() {
  console.log("🧪 [EarningsSimple] Component mounted");

  // Fetch tutor currency
  const { data: tutorCurrency = 'USD' } = useQuery({
    queryKey: ['tutor-currency'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('currency')
        .eq('user_id', user.id)
        .single();

      return data?.currency || 'USD';
    },
  });

  // Fetch sessions using exact Dashboard pattern
  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['earnings-sessions-simple'],
    queryFn: async () => {
      console.log("🧪 [EarningsSimple] Fetching sessions");
      const tutorId = await getCurrentTutorId();
      console.log("🧪 [EarningsSimple] Tutor ID:", tutorId);
      
      if (!tutorId) throw new Error('No tutor found');

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
          students (name)
        `)
        .eq('tutor_id', tutorId)
        .order('date', { ascending: false });

      if (error) throw error;

      console.log("🧪 [EarningsSimple] Sessions fetched:", data?.length);
      
      // Log detailed session data to check time format issues
      data?.forEach((session: any, index: number) => {
        if (index < 3) { // Log first 3 sessions for debugging
          console.log(`🧪 [EarningsSimple] Session ${index + 1}:`, {
            id: session.id,
            date: session.date,
            time: session.time,
            duration: session.duration,
            rate: session.rate,
            paid: session.paid,
            student_name: session.students?.name
          });
        }
      });

      return data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];
    },
  });

  // Calculate earnings
  const calculateEarnings = () => {
    if (!sessions || sessions.length === 0) return { total: 0, thisWeek: 0, thisMonth: 0 };

    console.log("🧪 [EarningsSimple] Calculating earnings for", sessions.length, "sessions");

    const now = new Date();
    
    // Total earnings from all paid sessions
    const totalEarnings = sessions.reduce((sum: number, session: any) => {
      if (session.paid) {
        const earnings = (session.duration / 60) * session.rate;
        console.log(`🧪 [EarningsSimple] Paid Session ${session.id}: date=${session.date}, time=${session.time}, duration=${session.duration}min, rate=${session.rate}/hr, earnings=${earnings}`);
        return sum + earnings;
      } else {
        console.log(`🧪 [EarningsSimple] Unpaid Session ${session.id}: date=${session.date}, time=${session.time}, paid=${session.paid}`);
      }
      return sum;
    }, 0);

    console.log(`🧪 [EarningsSimple] Total paid sessions: ${sessions.filter((s: any) => s.paid).length}`);
    console.log(`🧪 [EarningsSimple] Total calculated earnings: ${totalEarnings}`);

    // This week's earnings
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const thisWeekEarnings = sessions.reduce((sum: number, session: any) => {
      const sessionDate = new Date(session.date);
      if (session.paid && sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
        return sum + (session.duration / 60) * session.rate;
      }
      return sum;
    }, 0);

    // This month's earnings
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const thisMonthEarnings = sessions.reduce((sum: number, session: any) => {
      const sessionDate = new Date(session.date);
      if (session.paid && sessionDate >= startOfMonth && sessionDate <= endOfMonth) {
        return sum + (session.duration / 60) * session.rate;
      }
      return sum;
    }, 0);

    const result = { total: totalEarnings, thisWeek: thisWeekEarnings, thisMonth: thisMonthEarnings };
    console.log("🧪 [EarningsSimple] Final calculations:", result);
    return result;
  };

  const earnings = calculateEarnings();
  const paidSessions = sessions?.filter((s: any) => s.paid) || [];
  const thisMonthSessions = sessions?.filter((s: any) => {
    const sessionDate = new Date(s.date);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return sessionDate >= startOfMonth && sessionDate <= endOfMonth;
  }).length || 0;

  const activeStudents = sessions ? new Set(sessions.map((s: any) => s.student_id)).size : 0;

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Earnings</h1>
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Earnings</h1>
        <div className="text-red-600">Error: {error.message}</div>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Earnings Summary</CardTitle>
            <Coins className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(earnings.thisWeek, tutorCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">Earned This Week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(earnings.total, tutorCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">From all sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions This Month</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{thisMonthSessions}</div>
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{activeStudents}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div><strong>Total Sessions:</strong> {sessions?.length || 0}</div>
            <div><strong>Paid Sessions:</strong> {paidSessions.length}</div>
            <div><strong>This Month Earnings:</strong> {formatCurrency(earnings.thisMonth, tutorCurrency)}</div>
            <div><strong>Currency:</strong> {tutorCurrency}</div>
          </div>
        </CardContent>
      </Card>

      {paidSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Paid Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {paidSessions.slice(0, 5).map((session: any) => (
                <div key={session.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <div className="font-medium">{session.student_name}</div>
                    <div className="text-sm text-gray-600">{session.date} • {session.duration} min</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency((session.duration / 60) * session.rate, tutorCurrency)}</div>
                    <div className="text-sm text-gray-600">{formatCurrency(session.rate, tutorCurrency)}/hr</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}