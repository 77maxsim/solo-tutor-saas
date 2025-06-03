import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/dashboard/stats-card";
import { UpcomingSessions } from "@/components/dashboard/upcoming-sessions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { 
  BookOpen, 
  DollarSign, 
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



const mockRecentActivity = [
  {
    id: 1,
    type: "payment" as const,
    description: "Payment received from Maria Garcia",
    time: "2 hours ago",
    amount: 45
  },
  {
    id: 2,
    type: "session_scheduled" as const,
    description: "New session scheduled with Tom Wilson",
    time: "5 hours ago"
  },
  {
    id: 3,
    type: "student_added" as const,
    description: "New student added: Emma Thompson",
    time: "Yesterday"
  }
];

export default function Dashboard() {
  // Fetch dashboard statistics from real session data
  const { data: dashboardStats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
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

      // Calculate statistics
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Current month boundaries
      const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

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
        
        // Check if session is paid using the actual paid column
        const isPaid = session.paid === true;

        // Sessions this week
        if (sessionDate >= oneWeekAgo) {
          sessionsThisWeek++;
        }

        // Current month earnings
        if (sessionDate >= firstDayOfCurrentMonth) {
          currentMonthEarnings += earnings;
        }

        // Last month earnings
        if (sessionDate >= firstDayOfLastMonth && sessionDate <= lastDayOfLastMonth) {
          lastMonthEarnings += earnings;
        }

        // Active students (sessions in last 30 days)
        if (sessionDate >= thirtyDaysAgo) {
          activeStudentsSet.add(session.student_name);
        }

        // Pending payments (unpaid sessions)
        if (!isPaid) {
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
              Welcome back, Sarah!
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
            value={isLoading ? "..." : formatCurrency(dashboardStats?.totalEarnings || 0)}
            change={isLoading ? "..." : (dashboardStats?.earningsChange || "N/A")}
            changeType={dashboardStats?.earningsChangeType || "neutral"}
            icon={DollarSign}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
          />
          <StatsCard
            title="Pending Payments"
            value={isLoading ? "..." : formatCurrency(dashboardStats?.pendingPayments || 0)}
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

        {/* Recent Activity and Upcoming Sessions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UpcomingSessions />
          <RecentActivity activities={mockRecentActivity} />
        </div>
      </div>
    </div>
  );
}
