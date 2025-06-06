import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/dashboard/stats-card";
import { UpcomingSessions } from "@/components/dashboard/upcoming-sessions";
import { UnpaidPastSessions } from "@/components/dashboard/unpaid-past-sessions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { 
  BookOpen, 
  Coins, 
  Clock, 
  Users,
  Plus 
} from "lucide-react";

interface SessionWithStudent {
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





export default function Dashboard() {
  // Fetch tutor information for welcome message
  const { data: tutorInfo } = useQuery({
    queryKey: ['tutor-info'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('full_name, currency')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor info:', error);
        return { full_name: user.email?.split('@')[0] || 'Tutor', currency: 'USD' };
      }

      return data;
    },
  });

  // Fetch dashboard statistics from real session data
  const { data: dashboardStats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

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

      if (error) {
        console.error('Error fetching dashboard data:', error);
        throw error;
      }

      // Transform the data to include student_name
      const sessionsWithNames = data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];

      // Calculate statistics with correct business logic
      const now = new Date();
      
      // Current week boundaries (Sunday to Saturday)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      // Current month boundaries
      const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // Last month boundaries for comparison
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // 30 days ago for active students
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let sessionsThisWeek = 0;
      let currentMonthEarnings = 0;
      let lastMonthEarnings = 0;
      let pendingPayments = 0;
      let unpaidStudentsCount = 0;
      const activeStudentsSet = new Set<string>();
      const unpaidStudentsSet = new Set<string>();

      sessionsWithNames.forEach((session: SessionWithStudent) => {
        const sessionDate = new Date(session.date);
        const earnings = (session.duration / 60) * session.rate;
        const isPaid = session.paid === true;
        const isPastSession = sessionDate < now;

        // Sessions this week count (regardless of payment status, but only current week)
        if (sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
          sessionsThisWeek++;
        }

        // Current month earnings (only paid sessions in current month)
        if (sessionDate >= firstDayOfCurrentMonth && sessionDate <= lastDayOfCurrentMonth && isPaid) {
          currentMonthEarnings += earnings;
        }

        // Last month earnings (only paid sessions in last month)
        if (sessionDate >= firstDayOfLastMonth && sessionDate <= lastDayOfLastMonth && isPaid) {
          lastMonthEarnings += earnings;
        }

        // Active students (sessions in last 30 days, regardless of payment)
        if (sessionDate >= thirtyDaysAgo) {
          activeStudentsSet.add(session.student_name);
        }

        // Pending payments (unpaid sessions that are in the past only)
        if (!isPaid && isPastSession) {
          pendingPayments += earnings;
          unpaidStudentsSet.add(session.student_name);
        }
      });

      unpaidStudentsCount = unpaidStudentsSet.size;

      // Calculate percentage change
      let earningsChange = "N/A";
      let earningsChangeType: "positive" | "negative" | "neutral" = "neutral";

      if (lastMonthEarnings > 0) {
        const changePercent = ((currentMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100;
        earningsChange = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`;
        earningsChangeType = changePercent > 0 ? "positive" : changePercent < 0 ? "negative" : "neutral";
      } else if (currentMonthEarnings > 0) {
        earningsChange = "New";
        earningsChangeType = "positive";
      }

      return {
        sessionsThisWeek,
        totalEarnings: currentMonthEarnings,
        earningsChange,
        earningsChangeType,
        pendingPayments,
        unpaidStudentsCount,
        activeStudents: activeStudentsSet.size
      };
    },
  });

  const handleScheduleSession = () => {
    // Trigger the global schedule session modal
    window.dispatchEvent(new CustomEvent('openScheduleModal'));
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Welcome back, {tutorInfo?.full_name || 'Tutor'}!
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here's what's happening with your tutoring business today.
            </p>
          </div>
          <Button onClick={handleScheduleSession}>
            <Plus className="w-4 h-4 mr-2" />
            Schedule a Session
          </Button>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="p-6">
        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Sessions This Week"
            value={isLoading ? "..." : (dashboardStats?.sessionsThisWeek.toString() || "0")}
            change="+3 from last week"
            changeType="positive"
            icon={BookOpen}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
          />
          <StatsCard
            title="This Month Earnings"
            value={isLoading ? "..." : formatCurrency(dashboardStats?.totalEarnings || 0, tutorInfo?.currency || 'USD')}
            change={isLoading ? "..." : (dashboardStats?.earningsChange || "N/A")}
            changeType={dashboardStats?.earningsChangeType || "neutral"}
            icon={Coins}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
          />
          <StatsCard
            title="Pending Payments"
            value={isLoading ? "..." : formatCurrency(dashboardStats?.pendingPayments || 0, tutorInfo?.currency || 'USD')}
            change={isLoading ? "..." : `${dashboardStats?.unpaidStudentsCount || 0} students with pending payments`}
            changeType="neutral"
            icon={Clock}
            iconColor="text-orange-600"
            iconBgColor="bg-orange-100"
          />
          <StatsCard
            title="Active Students"
            value={isLoading ? "..." : (dashboardStats?.activeStudents.toString() || "0")}
            change="+2 new this week"
            changeType="positive"
            icon={Users}
            iconColor="text-purple-600"
            iconBgColor="bg-purple-100"
          />
        </div>

        {/* Sessions and Activity Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <UpcomingSessions currency={tutorInfo?.currency || 'USD'} />
          <UnpaidPastSessions currency={tutorInfo?.currency || 'USD'} />
        </div>

        {/* Recent Activity */}
        <div className="max-w-2xl">
          <RecentActivity currency={tutorInfo?.currency || 'USD'} />
        </div>
      </div>
    </div>
  );
}
