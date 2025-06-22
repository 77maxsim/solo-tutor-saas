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
import { shouldUseOptimizedQuery, getOptimizedSessions, getStandardSessions } from "@/lib/queryOptimizer";
import { calculateEarnings } from "@/lib/earningsCalculator";
import { ScheduleSessionModal } from "@/components/modals/schedule-session-modal";
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
  session_start: string;
  session_end: string;
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
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Force refresh dashboard stats after payment updates
  useEffect(() => {
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['earnings-sessions'] });
    }, 1000);
    return () => clearTimeout(timer);
  }, [queryClient]);
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

  // Fetch dashboard statistics using getCurrentTutorId helper (same as Earnings page)
  const { data: dashboardStats, isLoading, error: dashboardError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      try {
        const tutorId = await getCurrentTutorId();
        if (!tutorId) {
          throw new Error('User not authenticated or tutor record not found');
        }

      console.log('📦 Dashboard: Using tutor ID:', tutorId);

      // Use optimized query system for large datasets (like Oliver's 1000+ sessions)
      const useOptimized = await shouldUseOptimizedQuery(tutorId);
      let sessionsWithNames;
      
      if (useOptimized) {
        console.log('📦 Dashboard: Using optimized query for large dataset');
        sessionsWithNames = await getOptimizedSessions(tutorId);
      } else {
        console.log('📦 Dashboard: Using standard query');
        sessionsWithNames = await getStandardSessions(tutorId);
      }

      console.log('📦 Dashboard: Sessions fetched:', sessionsWithNames.length);

      // Get tutor timezone for timezone-aware calculations
      const { data: tutorInfo } = await supabase
        .from('tutors')
        .select('timezone')
        .eq('id', tutorId)
        .single();
      
      const tutorTimezone = tutorInfo?.timezone;
      console.log('📦 Dashboard: Using tutor timezone:', tutorTimezone);
      console.log('📦 Dashboard: About to call calculateEarnings with', sessionsWithNames.length, 'sessions');

      // Use shared earnings calculator with timezone awareness
      const earningsData = calculateEarnings(sessionsWithNames, tutorTimezone);
      
      console.log('📦 Dashboard: Earnings data returned:', earningsData);
      
      const result = {
        sessionsThisWeek: earningsData.thisMonthSessions,
        todayEarnings: earningsData.todayEarnings,
        currentWeekEarnings: earningsData.thisWeekEarnings,
        currentMonthEarnings: earningsData.thisMonthEarnings,
        lastMonthEarnings: 0,
        pendingPayments: 0,
        unpaidStudentsCount: 0,
        activeStudents: earningsData.activeStudentsCount
      };

      console.log('📦 Dashboard: Final result:', result);
      return result;
      } catch (error) {
        console.error('📦 Dashboard: Query function error:', error);
        throw error;
      }
    },
  });

  // Debug the query state
  console.log('🔍 Dashboard query state:', { 
    isLoading, 
    hasData: !!dashboardStats, 
    dashboardStats: dashboardStats ? JSON.stringify(dashboardStats) : 'null',
    error: dashboardError 
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
          <Card className="hover-lift cursor-pointer transition-all duration-300 group hover:shadow-lg hover:shadow-green-100/50 dark:hover:shadow-green-900/20 border-2 hover:border-green-200 dark:hover:border-green-700 dark:bg-card dark:shadow-md dark:border-gray-700">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <CardTitle className="text-sm font-medium group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-200 dark:text-gray-200">Earnings</CardTitle>
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-green-600 dark:text-green-400 group-hover:scale-110 group-hover:animate-bounce-subtle transition-all duration-300" />
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-1">
                    <button
                      onClick={() => setEarningsView('today')}
                      className={`px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                        earningsView === 'today'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      <span className="hidden sm:inline">Today</span>
                      <span className="sm:hidden">T</span>
                    </button>
                    <button
                      onClick={() => setEarningsView('week')}
                      className={`px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                        earningsView === 'week'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      <span className="hidden sm:inline">Week</span>
                      <span className="sm:hidden">W</span>
                    </button>
                    <button
                      onClick={() => setEarningsView('month')}
                      className={`px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                        earningsView === 'month'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
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
              <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 group-hover:scale-105 transition-transform duration-200">
                {isLoading ? "..." : formatCurrency(
                  earningsView === 'today' 
                    ? dashboardStats?.todayEarnings || 0
                    : earningsView === 'week' 
                    ? dashboardStats?.currentWeekEarnings || 0
                    : dashboardStats?.currentMonthEarnings || 0, 
                  tutorInfo?.currency || 'USD'
                )}
              </div>
              <p className="text-xs text-muted-foreground dark:text-gray-400 group-hover:text-green-600/70 dark:group-hover:text-green-400/70 transition-colors duration-200">
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
    console.log('✅ Opening single schedule modal from dashboard');
    setShowScheduleModal(prev => {
      if (prev) {
        console.log('⚠️ Modal already open, ignoring duplicate request');
        return prev;
      }
      return true;
    });
  };

  return (
    <div className="flex-1 overflow-auto w-full">
      {/* Header with Micro-interactions - Hidden on mobile since we have MobileHeader */}
      <header className="hidden md:block bg-white dark:bg-card border-b border-border px-4 sm:px-6 py-4 animate-fade-in">
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
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground dark:text-gray-100 hover:text-primary dark:hover:text-blue-400 transition-colors duration-200">
                Welcome back, {tutorInfo?.full_name || 'Tutor'}!
              </h1>
              <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1 animate-slide-up" style={{animationDelay: '0.1s'}}>
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

      {/* Schedule Session Modal */}
      <ScheduleSessionModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        editSession={null}
        editMode={false}
      />
    </div>
  );
}
