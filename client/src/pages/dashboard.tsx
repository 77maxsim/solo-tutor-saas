import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { StatsCard } from "@/components/dashboard/stats-card";
import { UpcomingSessions } from "@/components/dashboard/upcoming-sessions";
import { PaymentOverview } from "@/components/dashboard/unpaid-past-sessions";
import { ExpectedEarnings } from "@/components/dashboard/expected-earnings";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { 
  BookOpen, 
  Coins, 
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

interface DashboardCard {
  id: string;
  title: string;
}

const defaultCardOrder: DashboardCard[] = [
  { id: 'sessions_this_week', title: 'Sessions This Week' },
  { id: 'active_students', title: 'Active Students' },
  { id: 'expected_earnings', title: 'Expected Earnings' },
  { id: 'earnings_summary', title: 'Earnings Summary' }
];





export default function Dashboard() {
  const queryClient = useQueryClient();
  const [cards, setCards] = useState<DashboardCard[]>(defaultCardOrder);
  
  // Toggle state for earnings summary (today/week/month)
  const [earningsView, setEarningsView] = useState<'today' | 'week' | 'month'>(() => {
    // Persist toggle state in localStorage
    const saved = localStorage.getItem('dashboard-earnings-view');
    return (saved as 'today' | 'week' | 'month') || 'week';
  });

  // Save toggle state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('dashboard-earnings-view', earningsView);
  }, [earningsView]);

  // Fetch dashboard card order from Supabase
  const { data: cardOrder } = useQuery({
    queryKey: ['dashboard-card-order'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('dashboard_card_order')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching dashboard card order:', error);
        return defaultCardOrder;
      }

      return data?.dashboard_card_order || defaultCardOrder;
    },
  });

  // Update cards state when data is fetched
  useEffect(() => {
    if (cardOrder) {
      setCards(cardOrder);
    }
  }, [cardOrder]);

  // Mutation to update dashboard card order
  const updateCardOrderMutation = useMutation({
    mutationFn: async (newOrder: DashboardCard[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('tutors')
        .update({ dashboard_card_order: newOrder })
        .eq('user_id', user.id);

      if (error) throw error;
      return newOrder;
    },
    onSuccess: (newOrder) => {
      queryClient.setQueryData(['dashboard-card-order'], newOrder);
    },
  });

  // Fetch tutor information for welcome message
  const { data: tutorInfo } = useQuery({
    queryKey: ['tutor-info'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('full_name, currency, avatar_url')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor info:', error);
        return { 
          full_name: user.email?.split('@')[0] || 'Tutor', 
          currency: 'USD', 
          avatar_url: null as string | null 
        };
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
      
      // Current month boundaries - set time to start and end of day
      const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      firstDayOfCurrentMonth.setHours(0, 0, 0, 0);
      
      const lastDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      lastDayOfCurrentMonth.setHours(23, 59, 59, 999);
      

      
      // Last month boundaries for comparison
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // 30 days ago for active students
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let sessionsThisWeek = 0;
      let todayEarnings = 0;
      let currentWeekEarnings = 0;
      let currentMonthEarnings = 0;
      let lastMonthEarnings = 0;
      let pendingPayments = 0;
      let unpaidStudentsCount = 0;
      const activeStudentsSet = new Set<string>();
      const unpaidStudentsSet = new Set<string>();





      sessionsWithNames.forEach((session: SessionWithStudent) => {
        // Parse session date ensuring consistent timezone handling
        const sessionDate = new Date(session.date);
        sessionDate.setHours(12, 0, 0, 0); // Set to midday to avoid timezone edge cases
        const earnings = (session.duration / 60) * session.rate;
        // Handle different paid field formats - more comprehensive check
        const paidValue = (session as any).paid;
        const isPaid = Boolean(paidValue) && paidValue !== false && paidValue !== 0 && paidValue !== "false";
        const isPastSession = sessionDate < now;

        // Sessions this week count (regardless of payment status, but only current week)
        if (sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
          sessionsThisWeek++;
        }

        // Today earnings (only paid sessions for today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
        
        if (sessionDate >= today && sessionDate <= endOfToday && isPaid) {
          todayEarnings += earnings;
        }

        // Current week earnings (only paid sessions in current week)
        if (sessionDate >= startOfWeek && sessionDate <= endOfWeek && isPaid) {
          currentWeekEarnings += earnings;
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

      return {
        sessionsThisWeek,
        todayEarnings,
        currentWeekEarnings,
        currentMonthEarnings,
        lastMonthEarnings,
        pendingPayments,
        unpaidStudentsCount,
        activeStudents: activeStudentsSet.size
      };
    },
  });

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

  // Render individual dashboard card based on card ID
  const renderCard = (card: DashboardCard, index: number) => {
    switch (card.id) {
      case 'sessions_this_week':
        return (
          <StatsCard
            title="Sessions This Week"
            value={isLoading ? "..." : (dashboardStats?.sessionsThisWeek.toString() || "0")}
            change="+3 from last week"
            changeType="positive"
            icon={BookOpen}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
          />
        );
      case 'active_students':
        return (
          <StatsCard
            title="Active Students"
            value={isLoading ? "..." : (dashboardStats?.activeStudents.toString() || "0")}
            change="+2 new this week"
            changeType="positive"
            icon={Users}
            iconColor="text-purple-600"
            iconBgColor="bg-purple-100"
          />
        );
      case 'expected_earnings':
        return <ExpectedEarnings currency={tutorInfo?.currency || 'USD'} />;
      case 'earnings_summary':
        return (
          <Card className="hover-lift cursor-pointer transition-all duration-300 group hover:shadow-lg hover:shadow-green-100/50 border-2 hover:border-green-200">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <CardTitle className="text-sm font-medium group-hover:text-green-600 transition-colors duration-200">Earnings</CardTitle>
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-green-600 group-hover:scale-110 group-hover:animate-bounce-subtle transition-all duration-300" />
                  <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                    <button
                      onClick={() => setEarningsView('today')}
                      className={`px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                        earningsView === 'today'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <span className="hidden sm:inline">Today</span>
                      <span className="sm:hidden">T</span>
                    </button>
                    <button
                      onClick={() => setEarningsView('week')}
                      className={`px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                        earningsView === 'week'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <span className="hidden sm:inline">Week</span>
                      <span className="sm:hidden">W</span>
                    </button>
                    <button
                      onClick={() => setEarningsView('month')}
                      className={`px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                        earningsView === 'month'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <span className="hidden sm:inline">Month</span>
                      <span className="sm:hidden">M</span>
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-green-600 group-hover:scale-105 transition-transform duration-200">
                {isLoading ? "..." : formatCurrency(
                  earningsView === 'today' 
                    ? dashboardStats?.todayEarnings || 0
                    : earningsView === 'week' 
                    ? dashboardStats?.currentWeekEarnings || 0
                    : dashboardStats?.currentMonthEarnings || 0, 
                  tutorInfo?.currency || 'USD'
                )}
              </div>
              <p className="text-xs text-muted-foreground group-hover:text-green-600/70 transition-colors duration-200">
                {earningsView === 'today' ? 'Earned Today' : earningsView === 'week' ? 'Earned This Week' : 'Earned This Month'}
              </p>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  const handleScheduleSession = () => {
    // Trigger the global schedule session modal
    window.dispatchEvent(new CustomEvent('openScheduleModal'));
  };

  return (
    <div className="flex-1 overflow-auto w-full">
      {/* Header with Micro-interactions - Hidden on mobile since we have MobileHeader */}
      <header className="hidden md:block bg-white border-b border-border px-4 sm:px-6 py-4 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 hover-scale cursor-pointer transition-all duration-300 hover:shadow-lg">
              {tutorInfo?.avatar_url ? (
                <AvatarImage 
                  src={tutorInfo.avatar_url} 
                  alt={tutorInfo.full_name || "Profile"} 
                  className="transition-all duration-300"
                />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                {tutorInfo?.full_name 
                  ? tutorInfo.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                  : 'TU'
                }
              </AvatarFallback>
            </Avatar>
            <div className="animate-slide-up">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground hover:text-primary transition-colors duration-200">
                Welcome back, {tutorInfo?.full_name || 'Tutor'}!
              </h1>
              <p className="text-sm text-muted-foreground mt-1 animate-slide-up" style={{animationDelay: '0.1s'}}>
                Here's what's happening with your tutoring business today.
              </p>
            </div>
          </div>
          <Button 
            onClick={handleScheduleSession} 
            size="sm"
            className="hover-lift click-scale bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2 animate-bounce-subtle" />
            Schedule a Session
          </Button>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="p-4 sm:p-6 w-full">
        {/* Draggable Quick Stats Cards */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="dashboard-cards" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8 w-full"
              >
                {cards.map((card, index) => (
                  <Draggable key={card.id} draggableId={card.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`transition-all duration-200 ${
                          snapshot.isDragging ? 'scale-105 rotate-2 shadow-lg' : ''
                        }`}
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

        {/* Sessions and Activity Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 w-full">
          <UpcomingSessions currency={tutorInfo?.currency || 'USD'} />
          <PaymentOverview currency={tutorInfo?.currency || 'USD'} limit={5} />
        </div>

        {/* Recent Activity - Hidden on small screens */}
        <div className="hidden sm:block w-full">
          <RecentActivity currency={tutorInfo?.currency || 'USD'} />
        </div>
      </div>
    </div>
  );
}
