import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { shouldUseOptimizedQuery, getOptimizedSessions, getStandardSessions, invalidateSessionCountCache } from "@/lib/queryOptimizer";
import { formatCurrency } from "@/lib/utils";
import { formatUtcToTutorTimezone, calculateDurationMinutes } from "@/lib/dateUtils";
import { useTimezone } from "@/contexts/TimezoneContext";
import { weekRange, monthRange, APP_TIMEZONE } from "@/lib/dateRange";
import { 
  Coins, 
  TrendingUp, 
  Calendar,
  Users,
  Download,
  Target,
  Settings,
  CalendarIcon,
  Info
} from "lucide-react";
import { SessionStatCompact } from "@/components/stats/SessionStatCompact";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

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

  // Get tutorId for cache key - this ensures each tutor has their own cache
  const { data: currentTutorId } = useQuery({
    queryKey: ['current-tutor-id'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      console.log('📊 CURRENT TUTOR ID:', tutorId?.substring(0, 8) + '...');
      return tutorId;
    },
    staleTime: 60000, // 1 minute
  });

  const { data: sessions, isLoading, error } = useQuery<SessionWithStudent[]>({
    queryKey: ['earnings-sessions', currentTutorId],
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
    enabled: !!currentTutorId,
    queryFn: async () => {
      console.log('📊 EARNINGS PAGE: Starting session fetch at', new Date().toISOString());
      const tutorId = currentTutorId;
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      // Clear any stale optimization cache for this tutor
      invalidateSessionCountCache(tutorId);
      
      // Use Dataset optimization system for tutors with large datasets (500+ sessions)
      // This ensures we get ALL sessions without Supabase's default 1000-row limit
      const useOptimized = await shouldUseOptimizedQuery(tutorId);
      
      let sessionsData;
      if (useOptimized) {
        console.log('📊 Earnings page: Using OPTIMIZED query for large dataset');
        sessionsData = await getOptimizedSessions(tutorId);
      } else {
        console.log('📊 Earnings page: Using STANDARD query');
        sessionsData = await getStandardSessions(tutorId);
      }

      // Transform the data to match SessionWithStudent interface
      // CRITICAL: Ensure paid is coerced to boolean to avoid 'true' string comparison issues
      const sessionsWithNames = sessionsData?.map((session: any) => ({
        id: session.id,
        student_id: session.student_id,
        student_name: session.student_name || 'Unknown Student',
        session_start: session.session_start,
        session_end: session.session_end,
        duration: session.duration,
        rate: parseFloat(session.rate) || 0,
        paid: session.paid === true || session.paid === 'true',
        created_at: session.created_at
      })) || [];

      const paidCount = sessionsWithNames.filter((s: any) => s.paid === true).length;
      
      // Calculate date range for debugging large dataset issues
      let dateRangeInfo = 'No sessions';
      if (sessionsWithNames.length > 0) {
        const dates = sessionsWithNames.map((s: any) => new Date(s.session_start).getTime());
        const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
        const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
        dateRangeInfo = `${minDate} to ${maxDate}`;
      }
      
      console.log(`📊 EARNINGS PAGE RESULT: Fetched ${sessionsWithNames.length} total sessions, ${paidCount} paid for tutor ${tutorId.substring(0, 8)}...`);
      console.log(`📊 EARNINGS DATE RANGE: ${dateRangeInfo}`);
      
      if (paidCount < 100 && sessionsWithNames.length > 500) {
        console.warn(`⚠️ LOW PAID COUNT: Only ${paidCount} paid sessions out of ${sessionsWithNames.length}. If this seems wrong, check optimization path.`);
      }

      return sessionsWithNames as SessionWithStudent[];
    },
  });

  // Set up Supabase realtime subscription
  useEffect(() => {
    if (!currentTutorId) return;
    
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
          // Invalidate tutor-specific cache
          invalidateSessionCountCache(currentTutorId);
          queryClient.invalidateQueries({ queryKey: ['earnings-sessions', currentTutorId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, currentTutorId]);

  // Calculate monthly earnings for the last 24 months (supports 12m filter + period comparison)
  const calculateMonthlyEarnings = (sessions: SessionWithStudent[]): MonthlyEarnings[] => {
    if (!sessions || sessions.length === 0) {
      return [];
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Generate last 24 months to support 12-month view + 12-month comparison
    const months: MonthlyEarnings[] = [];
    for (let i = 23; i >= 0; i--) {
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

  // Enhanced MonthlyEarningsChart component with all features
  const MonthlyEarningsChart = ({ monthlyData, currency, sessions: allSessions }: { monthlyData: MonthlyEarnings[], currency: string, sessions?: SessionWithStudent[] }) => {
    // State for filters and settings
    const [dateRange, setDateRange] = useState<'3m' | '6m' | '12m' | 'custom'>('6m');
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
    const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
      const saved = localStorage.getItem('monthly-earnings-goal');
      return saved ? parseFloat(saved) : 0;
    });
    const [showGoalDialog, setShowGoalDialog] = useState(false);
    const [tempGoal, setTempGoal] = useState(monthlyGoal.toString());
    const [selectedMonthData, setSelectedMonthData] = useState<MonthlyEarnings | null>(null);
    const [showBreakdownDialog, setShowBreakdownDialog] = useState(false);

    // Query upcoming sessions for projection
    const { data: upcomingSessions } = useQuery({
      queryKey: ['upcoming-sessions-projection'],
      queryFn: async () => {
        const tutorId = await getCurrentTutorId();
        if (!tutorId) return [];

        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const { data, error } = await supabase
          .from('sessions')
          .select('id, session_start, duration, rate, paid')
          .eq('tutor_id', tutorId)
          .gte('session_start', now.toISOString())
          .lte('session_start', endOfMonth.toISOString());

        if (error) {
          console.error('Error fetching upcoming sessions:', error);
          return [];
        }
        return data || [];
      },
    });

    // Save goal to localStorage
    useEffect(() => {
      localStorage.setItem('monthly-earnings-goal', monthlyGoal.toString());
    }, [monthlyGoal]);

    if (!monthlyData || monthlyData.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No earnings data available for the chart
        </div>
      );
    }

    // Check if custom date range is selected
    const isCustomRange = dateRange === 'custom' && customDateRange?.from && customDateRange?.to;
    
    // For custom ranges, calculate directly from sessions
    const customRangeData = isCustomRange && allSessions ? (() => {
      // Set end date to end of day (23:59:59.999) to include all sessions on that day
      const endOfDay = new Date(customDateRange.to!);
      endOfDay.setHours(23, 59, 59, 999);
      
      const filteredSessions = allSessions.filter(s => {
        const sessionDate = new Date(s.session_start);
        return sessionDate >= customDateRange.from! && sessionDate <= endOfDay && s.paid;
      });
      
      const totalEarnings = filteredSessions.reduce((sum, s) => sum + (s.duration / 60) * s.rate, 0);
      const sessionCount = filteredSessions.length;
      
      return {
        totalEarnings,
        sessionCount,
        filteredSessions
      };
    })() : null;
    
    // Filter data based on selected range (for non-custom ranges)
    const getFilteredData = () => {
      const now = new Date();
      let monthsToShow = 6;
      
      if (dateRange === '3m') monthsToShow = 3;
      else if (dateRange === '12m') monthsToShow = 12;

      return monthlyData.slice(-monthsToShow);
    };

    const filteredData = isCustomRange ? [] : getFilteredData();

    // Calculate projection for current month
    const calculateProjection = () => {
      const currentMonth = filteredData.find(m => m.isCurrentMonth);
      if (!currentMonth || !upcomingSessions || upcomingSessions.length === 0) return null;

      const projectedEarnings = upcomingSessions.reduce((sum, session) => {
        return sum + ((session.duration / 60) * session.rate);
      }, 0);

      return {
        ...currentMonth,
        projectedEarnings: currentMonth.earnings + projectedEarnings,
        isProjection: true
      };
    };

    const projection = calculateProjection();
    const chartData = projection 
      ? filteredData.map((m, index) => {
          // Add projection line from previous month to current month
          if (m.isCurrentMonth) {
            return { ...m, projectedEarnings: projection.projectedEarnings };
          } else if (index === filteredData.findIndex(d => d.isCurrentMonth) - 1) {
            // Previous month - start the projection line from its actual earnings
            return { ...m, projectedEarnings: m.earnings };
          }
          return m;
        })
      : filteredData;

    // Calculate analytics
    const totalEarnings = filteredData.reduce((sum, m) => sum + m.earnings, 0);
    const avgEarnings = filteredData.length > 0 ? totalEarnings / filteredData.length : 0;
    const bestMonth = filteredData.length > 0 ? [...filteredData].sort((a, b) => b.earnings - a.earnings)[0] : null;
    const worstMonth = filteredData.length > 0 ? [...filteredData].sort((a, b) => a.earnings - b.earnings)[0] : null;
    
    // Calculate month-over-month growth (current month vs previous month)
    const calculateMonthOverMonthGrowth = () => {
      const currentMonthIndex = filteredData.findIndex(m => m.isCurrentMonth);
      if (currentMonthIndex <= 0) return null; // No previous month to compare
      
      const currentEarnings = filteredData[currentMonthIndex].earnings;
      const previousEarnings = filteredData[currentMonthIndex - 1].earnings;
      
      // If previous month has no earnings, can't calculate meaningful comparison
      if (previousEarnings === 0) {
        return currentEarnings > 0 ? null : 0; // null means "N/A"
      }
      
      return ((currentEarnings - previousEarnings) / previousEarnings) * 100;
    };
    const monthOverMonthGrowth = calculateMonthOverMonthGrowth();

    // Period comparison - properly handle missing baseline data and custom ranges
    const currentPeriodEarnings = totalEarnings;
    
    const calculatePeriodChange = () => {
      // Find the chronological position of the filtered data in the full dataset
      if (filteredData.length === 0) return null;
      
      const firstFilteredMonth = filteredData[0];
      const firstFilteredIndex = monthlyData.findIndex(
        m => m.year === firstFilteredMonth.year && m.monthNum === firstFilteredMonth.monthNum
      );
      
      // Calculate the previous period based on the filtered data's position
      const periodLength = filteredData.length;
      const previousPeriodEndIndex = firstFilteredIndex;
      const previousPeriodStartIndex = Math.max(0, previousPeriodEndIndex - periodLength);
      
      // If we don't have enough previous data (e.g., selecting the earliest months), return N/A
      if (previousPeriodStartIndex === 0 && previousPeriodEndIndex - previousPeriodStartIndex < periodLength) {
        return null;
      }
      
      const previousPeriodData = monthlyData.slice(previousPeriodStartIndex, previousPeriodEndIndex);
      const previousPeriodEarnings = previousPeriodData.reduce((sum, m) => sum + m.earnings, 0);
      
      // If previous period has no earnings but current does, can't calculate meaningful comparison
      if (previousPeriodEarnings === 0) {
        return currentPeriodEarnings > 0 ? null : 0;
      }
      
      return ((currentPeriodEarnings - previousPeriodEarnings) / previousPeriodEarnings) * 100;
    };
    const periodChange = calculatePeriodChange();

    // Export to CSV
    const exportToCSV = () => {
      const headers = ['Month', 'Year', 'Earnings', 'Sessions'];
      const rows = filteredData.map(m => {
        const monthSessions = allSessions?.filter(s => {
          const sessionDate = new Date(s.session_start);
          return sessionDate.getFullYear() === m.year && 
                 sessionDate.getMonth() + 1 === m.monthNum &&
                 s.paid === true;
        }) || [];
        
        return [m.month, m.year, m.earnings.toFixed(2), monthSessions.length];
      });

      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `earnings-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    // Export to PDF (simple text format)
    const exportToPDF = () => {
      const content = `
EARNINGS REPORT
Generated: ${new Date().toLocaleDateString()}
Period: ${dateRange === 'custom' ? 'Custom Range' : `Last ${dateRange}`}

SUMMARY
Total Earnings: ${formatCurrency(totalEarnings, currency)}
Average per Month: ${formatCurrency(avgEarnings, currency)}
Month-over-Month Growth: ${monthOverMonthGrowth !== null ? monthOverMonthGrowth.toFixed(1) + '%' : 'N/A'}
Period vs Previous: ${periodChange !== null ? (periodChange >= 0 ? '+' : '') + periodChange.toFixed(1) + '%' : 'N/A'}
Best Month: ${bestMonth ? `${bestMonth.month} ${bestMonth.year} (${formatCurrency(bestMonth.earnings, currency)})` : 'N/A'}
Worst Month: ${worstMonth ? `${worstMonth.month} ${worstMonth.year} (${formatCurrency(worstMonth.earnings, currency)})` : 'N/A'}

MONTHLY BREAKDOWN
${filteredData.map(m => `${m.month} ${m.year}: ${formatCurrency(m.earnings, currency)}`).join('\n')}
      `.trim();

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `earnings-report-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    };

    // Custom Tooltip with session count and average rate
    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload;
        const monthSessions = allSessions?.filter(s => {
          const sessionDate = new Date(s.session_start);
          return sessionDate.getFullYear() === data.year && 
                 sessionDate.getMonth() + 1 === data.monthNum &&
                 s.paid === true;
        }) || [];

        const avgRate = monthSessions.length > 0
          ? monthSessions.reduce((sum, s) => sum + s.rate, 0) / monthSessions.length
          : 0;

        return (
          <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
            <p className="font-medium text-sm mb-2">{`${label} ${data.year}`}</p>
            <div className="space-y-1 text-xs">
              <p className="text-green-600 dark:text-green-400 font-semibold">
                Earnings: {formatCurrency(payload[0].value, currency)}
              </p>
              {data.projectedEarnings && (
                <p className="text-blue-600 dark:text-blue-400">
                  Projected: {formatCurrency(data.projectedEarnings, currency)}
                </p>
              )}
              <p className="text-muted-foreground">
                Sessions: {monthSessions.length}
              </p>
              {avgRate > 0 && (
                <p className="text-muted-foreground">
                  Avg Rate: {formatCurrency(avgRate, currency)}/hr
                </p>
              )}
            </div>
          </div>
        );
      }
      return null;
    };

    // Custom Dot with color coding based on goal
    const CustomDot = (props: any) => {
      const { cx, cy, payload } = props;
      let color = "#16a34a"; // green
      
      if (monthlyGoal > 0) {
        if (payload.earnings >= monthlyGoal) {
          color = "#16a34a"; // green - met goal
        } else if (payload.earnings >= monthlyGoal * 0.7) {
          color = "#f59e0b"; // amber - 70-99% of goal
        } else {
          color = "#ef4444"; // red - below 70% of goal
        }
      }
      
      if (payload.isCurrentMonth) {
        return (
          <circle 
            cx={cx} 
            cy={cy} 
            r={6} 
            fill={color} 
            stroke="#ffffff" 
            strokeWidth={2}
            className="animate-pulse"
          />
        );
      }
      return <circle cx={cx} cy={cy} r={3} fill={color} />;
    };

    // Handle month click for breakdown
    const handleMonthClick = (data: any) => {
      if (data && data.activePayload && data.activePayload[0]) {
        setSelectedMonthData(data.activePayload[0].payload);
        setShowBreakdownDialog(true);
      }
    };

    return (
      <div className="space-y-4">
        {/* Header with controls */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Monthly Earnings Trend</h3>
              <p className="text-sm text-muted-foreground">
                {dateRange === 'custom' ? 'Custom date range' : `Last ${dateRange}`} • Click on any month for details
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Goal Setting */}
              <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-set-goal">
                    <Target className="h-4 w-4 mr-2" />
                    {monthlyGoal > 0 ? formatCurrency(monthlyGoal, currency) : 'Set Goal'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Set Monthly Earnings Goal</DialogTitle>
                    <DialogDescription>
                      Set a target for your monthly earnings. The chart will color-code months based on goal achievement.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="goal-amount">Monthly Goal ({currency})</Label>
                    <Input
                      id="goal-amount"
                      type="number"
                      value={tempGoal}
                      onChange={(e) => setTempGoal(e.target.value)}
                      placeholder="0.00"
                      data-testid="input-goal-amount"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowGoalDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => {
                      setMonthlyGoal(parseFloat(tempGoal) || 0);
                      setShowGoalDialog(false);
                    }} data-testid="button-save-goal">
                      Save Goal
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Export buttons */}
              <Button variant="outline" size="sm" onClick={exportToCSV} data-testid="button-export-csv">
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} data-testid="button-export-pdf">
                <Download className="h-4 w-4 mr-2" />
                Report
              </Button>
            </div>
          </div>

          {/* Date range filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={dateRange === '3m' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('3m')}
              data-testid="button-range-3m"
            >
              3 Months
            </Button>
            <Button
              variant={dateRange === '6m' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('6m')}
              data-testid="button-range-6m"
            >
              6 Months
            </Button>
            <Button
              variant={dateRange === '12m' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange('12m')}
              data-testid="button-range-12m"
            >
              12 Months
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={dateRange === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  data-testid="button-range-custom"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Custom Range
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="start">
                <div className="space-y-2">
                  <Label className="text-xs">Select Date Range</Label>
                  <CalendarComponent
                    mode="range"
                    selected={customDateRange}
                    onSelect={(range) => {
                      if (range) {
                        setCustomDateRange(range);
                        if (range.from && range.to) {
                          setDateRange('custom');
                        }
                      }
                    }}
                    numberOfMonths={1}
                  />
                  {customDateRange?.from && customDateRange?.to && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      {format(customDateRange.from, 'MMM dd, yyyy')} - {format(customDateRange.to, 'MMM dd, yyyy')}
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Custom Range Summary or Analytics */}
          {isCustomRange && customRangeData ? (
            <div className="space-y-4 p-6 bg-gradient-to-br from-muted/30 to-muted/50 rounded-xl border border-border/50">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  {format(customDateRange!.from!, 'MMM dd, yyyy')} - {format(customDateRange!.to!, 'MMM dd, yyyy')}
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Total Earnings</p>
                    <p className="text-4xl font-bold text-green-600" data-testid="text-custom-earnings">
                      {formatCurrency(customRangeData.totalEarnings, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Total Sessions</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-custom-sessions">
                      {customRangeData.sessionCount}
                    </p>
                  </div>
                  {customRangeData.sessionCount > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Average per Session</p>
                      <p className="text-xl font-semibold text-muted-foreground">
                        {formatCurrency(customRangeData.totalEarnings / customRangeData.sessionCount, currency)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-gradient-to-br from-muted/30 to-muted/50 rounded-xl border border-border/50">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Total Period</p>
                <p className="text-base font-bold text-foreground" data-testid="text-total-period">
                  {formatCurrency(totalEarnings, currency)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Avg/Month</p>
                <p className="text-base font-bold text-foreground" data-testid="text-avg-month">
                  {formatCurrency(avgEarnings, currency)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Growth</p>
                <div className="flex items-center gap-1">
                  {monthOverMonthGrowth !== null ? (
                    <>
                      <TrendingUp className={`h-3.5 w-3.5 ${monthOverMonthGrowth >= 0 ? 'text-green-600' : 'text-red-600 rotate-180'}`} />
                      <p className={`text-base font-bold ${monthOverMonthGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-growth-rate">
                        {monthOverMonthGrowth.toFixed(1)}%
                      </p>
                    </>
                  ) : (
                    <p className="text-base font-bold text-muted-foreground" data-testid="text-growth-rate">
                      N/A
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Best</p>
                {bestMonth ? (
                  <>
                    <p className="text-sm font-bold text-green-600" data-testid="text-best-month">
                      {bestMonth.month}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(bestMonth.earnings, currency)}
                    </p>
                  </>
                ) : (
                  <p className="text-base font-bold text-muted-foreground" data-testid="text-best-month">
                    N/A
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">vs Previous</p>
                <div className="flex items-center gap-1">
                  {periodChange !== null ? (
                    <>
                      <TrendingUp className={`h-3.5 w-3.5 ${periodChange >= 0 ? 'text-green-600' : 'text-red-600 rotate-180'}`} />
                      <p className={`text-base font-bold ${periodChange >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-period-change">
                        {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(1)}%
                      </p>
                    </>
                  ) : (
                    <p className="text-base font-bold text-muted-foreground" data-testid="text-period-change">
                      N/A
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Chart and Legend - Hide for custom range */}
        {!isCustomRange && (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={chartData} 
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  onClick={handleMonthClick}
                >
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
                      if (value >= 1000) {
                        return `${currency === 'USD' ? '$' : currency}${(value / 1000).toFixed(1)}k`;
                      }
                      return formatCurrency(value, currency);
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Goal line */}
                  {monthlyGoal > 0 && (
                    <ReferenceLine 
                      y={monthlyGoal} 
                      stroke="#ef4444" 
                      strokeDasharray="5 5"
                      label={{ value: 'Goal', position: 'right', fill: '#ef4444', fontSize: 12 }}
                    />
                  )}
                  
                  {/* Main earnings line */}
                  <Line 
                    type="monotone" 
                    dataKey="earnings" 
                    stroke="#16a34a" 
                    strokeWidth={3}
                    dot={<CustomDot />}
                    activeDot={{ r: 8, stroke: "#16a34a", strokeWidth: 2, fill: "#ffffff", cursor: "pointer" }}
                  />
                  
                  {/* Projection line (dashed) */}
                  {projection && (
                    <Line 
                      type="monotone" 
                      dataKey="projectedEarnings" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Simplified Legend */}
            <div className="flex items-center justify-center gap-4 text-xs flex-wrap p-3 bg-muted/20 rounded-lg border border-border/30">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-1 bg-green-600 rounded-full"></div>
                <span className="text-muted-foreground">Actual</span>
              </div>
              {projection && (
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-1 bg-blue-600 rounded-full opacity-50"></div>
                  <span className="text-muted-foreground">Projected</span>
                </div>
              )}
              {monthlyGoal > 0 && (
                <>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-1 bg-red-500 rounded-full border-t border-dashed"></div>
                    <span className="text-muted-foreground">Goal</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground/80">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-600"></div>
                      <span className="text-[10px]">Met</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      <span className="text-[10px]">70%+</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-[10px]">&lt;70%</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Month Breakdown Dialog */}
        <Dialog open={showBreakdownDialog} onOpenChange={setShowBreakdownDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedMonthData?.month} {selectedMonthData?.year} Breakdown
              </DialogTitle>
            </DialogHeader>
            {selectedMonthData && allSessions && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Earnings</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(selectedMonthData.earnings, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sessions</p>
                    <p className="text-lg font-bold">
                      {allSessions.filter(s => {
                        const sessionDate = new Date(s.session_start);
                        return sessionDate.getFullYear() === selectedMonthData.year && 
                               sessionDate.getMonth() + 1 === selectedMonthData.monthNum &&
                               s.paid === true;
                      }).length}
                    </p>
                  </div>
                </div>
                
                {monthlyGoal > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Goal Achievement</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          selectedMonthData.earnings >= monthlyGoal ? 'bg-green-600' :
                          selectedMonthData.earnings >= monthlyGoal * 0.7 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((selectedMonthData.earnings / monthlyGoal) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {((selectedMonthData.earnings / monthlyGoal) * 100).toFixed(1)}% of goal
                    </p>
                  </div>
                )}

                {selectedMonthData.isCurrentMonth && projection && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                      Month in Progress
                    </p>
                    <p className="text-sm">
                      Projected: {formatCurrency(projection.projectedEarnings, currency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on {upcomingSessions?.length || 0} scheduled sessions
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
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
      // Resilient paid session check - handle both boolean and string values from different query paths
      // This matches earningsCalculator.ts for consistency across Dashboard and Earnings pages
      const isPaid = session.paid === true || (session as any).paid === 'true';
      
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
              sessions={sessions}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
