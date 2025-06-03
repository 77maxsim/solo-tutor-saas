import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/dashboard/stats-card";
import { UpcomingSessions } from "@/components/dashboard/upcoming-sessions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { ScheduleSessionModal } from "@/components/modals/schedule-session-modal";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { 
  BookOpen, 
  DollarSign, 
  Clock, 
  Users,
  Plus 
} from "lucide-react";

// Mock data for demonstration
const mockUpcomingSessions = [
  {
    id: 1,
    title: "Spanish Conversation",
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
    rate: 45,
    studentName: "Maria Garcia"
  },
  {
    id: 2,
    title: "Business English",
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
    endTime: new Date(Date.now() + 25.5 * 60 * 60 * 1000).toISOString(),
    rate: 65,
    studentName: "David Chen"
  },
  {
    id: 3,
    title: "IELTS Preparation",
    startTime: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 29 * 60 * 60 * 1000).toISOString(),
    rate: 55,
    studentName: "Lisa Park"
  }
];

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
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // In a real app, this would fetch actual data
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats/1"],
    enabled: false, // Disable for now since we're using mock data
  });

  // Mock stats data
  const mockStats = {
    sessionsThisWeek: 12,
    totalEarnings: 2840,
    pendingPayments: 320,
    activeStudents: 28
  };

  const handleScheduleSession = () => {
    setIsScheduleModalOpen(true);
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
            value={mockStats.sessionsThisWeek.toString()}
            change="+3 from last week"
            changeType="positive"
            icon={BookOpen}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
          />
          <StatsCard
            title="Total Earnings"
            value={formatCurrency(mockStats.totalEarnings)}
            change="+12% this month"
            changeType="positive"
            icon={DollarSign}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
          />
          <StatsCard
            title="Pending Payments"
            value={formatCurrency(mockStats.pendingPayments)}
            change="4 students"
            changeType="neutral"
            icon={Clock}
            iconColor="text-orange-600"
            iconBgColor="bg-orange-100"
          />
          <StatsCard
            title="Active Students"
            value={mockStats.activeStudents.toString()}
            change="+2 new this week"
            changeType="positive"
            icon={Users}
            iconColor="text-purple-600"
            iconBgColor="bg-purple-100"
          />
        </div>

        {/* Recent Activity and Upcoming Sessions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UpcomingSessions sessions={mockUpcomingSessions} />
          <RecentActivity activities={mockRecentActivity} />
        </div>
      </div>

      {/* Schedule Session Modal */}
      <ScheduleSessionModal 
        open={isScheduleModalOpen} 
        onOpenChange={setIsScheduleModalOpen} 
      />
    </div>
  );
}
