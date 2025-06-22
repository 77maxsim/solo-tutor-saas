import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  Coins, 
  Repeat, 
  X,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { formatUtcToTutorTimezone, calculateDurationMinutes } from "@/lib/dateUtils";
import { useTimezone } from "@/contexts/TimezoneContext";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Session {
  id: string;
  student_id: string;
  student_name: string;
  date?: string; // Legacy field
  time?: string; // Legacy field
  session_start?: string; // UTC timestamp
  session_end?: string; // UTC timestamp
  duration: number;
  rate: number;
  paid: boolean;
  created_at: string;
  recurrence_id?: string;
}

export default function UpcomingSessions() {
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tutorTimezone } = useTimezone();

  // Fetch tutor's currency preference
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

      if (error) {
        console.error('Error fetching tutor currency:', error);
        return 'USD';
      }

      return data?.currency || 'USD';
    },
  });

  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ['all-upcoming-sessions'],
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
          session_start,
          session_end,
          duration,
          rate,
          paid,
          created_at,
          recurrence_id,
          students (
            name
          )
        `)
        .eq('tutor_id', tutorId)
        .gte('session_start', new Date().toISOString())
        .order('session_start', { ascending: true });

      if (error) {
        console.error('Error fetching upcoming sessions:', error);
        throw error;
      }

      const sessionsWithNames = data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];

      return sessionsWithNames as Session[];
    },
  });

  // Cancel session mutation
  const cancelSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error('Error canceling session:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Session canceled",
        description: "The session has been successfully canceled.",
      });
      queryClient.invalidateQueries({ queryKey: ['all-upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
    },
    onError: (error) => {
      console.error('Error canceling session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel session. Please try again.",
      });
    },
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('sessions')
        .update({ paid: true })
        .eq('id', sessionId);

      if (error) {
        console.error('Error marking session as paid:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Payment recorded",
        description: "The session has been marked as paid.",
      });
      queryClient.invalidateQueries({ queryKey: ['all-upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error) => {
      console.error('Error marking session as paid:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update payment status. Please try again.",
      });
    },
  });

  const handleCancelSession = (sessionId: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to cancel the session with ${studentName}?`)) {
      cancelSessionMutation.mutate(sessionId);
    }
  };

  const handleMarkAsPaid = (sessionId: string, studentName: string) => {
    if (window.confirm(`Mark session with ${studentName} as paid?`)) {
      markAsPaidMutation.mutate(sessionId);
    }
  };

  const toggleDateGroup = (date: string) => {
    const newOpenDates = new Set(openDates);
    if (newOpenDates.has(date)) {
      newOpenDates.delete(date);
    } else {
      newOpenDates.add(date);
    }
    setOpenDates(newOpenDates);
  };

  const formatDateGroup = (date: string) => {
    const sessionDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    // Use date string comparison for more reliable matching
    const sessionDateStr = sessionDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (sessionDateStr === todayStr) {
      return "Today";
    } else if (sessionDateStr === tomorrowStr) {
      return "Tomorrow";
    } else if (sessionDate <= nextWeek) {
      return sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    } else {
      return sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  // Group sessions by date using session_start
  const groupedSessions = sessions.reduce((groups: { [key: string]: Session[] }, session) => {
    // Convert UTC session_start to local date for grouping
    const sessionDate = new Date(session.session_start || session.date);
    const date = sessionDate.toISOString().split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(session);
    return groups;
  }, {});

  // Calculate summary statistics
  const totalSessions = sessions.length;
  const next7DaysSessions = sessions.filter(session => {
    const sessionDate = new Date(session.session_start || session.date);
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);
    return sessionDate <= next7Days;
  }).length;

  const totalEarnings = sessions.reduce((total, session) => {
    return total + (session.duration / 60) * session.rate;
  }, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">All Upcoming Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-16 bg-gray-100 rounded-lg"></div>
                      <div className="h-16 bg-gray-100 rounded-lg"></div>
                    </div>
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">All Upcoming Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-red-500 py-12">
                Error loading upcoming sessions
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Upcoming</p>
                  <p className="text-xl font-bold">{totalSessions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next 7 Days</p>
                  <p className="text-xl font-bold">{next7DaysSessions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Coins className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Earnings</p>
                  <p className="text-xl font-bold">{formatCurrency(totalEarnings, tutorCurrency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">All Upcoming Sessions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sessions grouped by date, sorted chronologically
            </p>
          </CardHeader>

          <CardContent>
            {totalSessions === 0 ? (
              <div className="text-center py-12">
                <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-600 mb-2">No upcoming sessions</p>
                <p className="text-sm text-gray-500">
                  Schedule new sessions from the calendar or dashboard.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedSessions).map(([date, dateSessions]) => (
                  <Collapsible
                    key={date}
                    open={openDates.has(date)}
                    onOpenChange={() => toggleDateGroup(date)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-3 h-auto hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <CalendarIcon className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-base">{formatDateGroup(date)}</h3>
                            <p className="text-sm text-muted-foreground">
                              {dateSessions.length} session{dateSessions.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        {openDates.has(date) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="space-y-2 mt-2">
                      {dateSessions.map((session) => {
                        const calculatedPrice = (session.duration / 60) * session.rate;
                        
                        // Create full datetime for the session
                        const sessionDateTime = new Date(session.session_start);
                        const createdDate = new Date(session.created_at);
                        const now = new Date();
                        
                        // Session is "logged late" if it was created after the session time had already passed
                        const isLoggedLate = createdDate > sessionDateTime && now > sessionDateTime;
                        
                        return (
                          <div
                            key={session.id}
                            className="ml-11 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-gray-900">
                                    {session.student_name}
                                  </h4>
                                  {session.recurrence_id && (
                                    <div title="Recurring session">
                                      <Repeat className="h-3 w-3 text-blue-500" />
                                    </div>
                                  )}
                                  {session.paid && (
                                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                      Paid
                                    </Badge>
                                  )}
                                  {isLoggedLate && (
                                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                                      Logged Late
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {session.session_start && session.session_end && tutorTimezone
                                      ? (() => {
                                          const startTime = formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'HH:mm');
                                          const duration = calculateDurationMinutes(session.session_start, session.session_end);
                                          console.log('📋 Upcoming sessions time display:', {
                                            student: session.student_name,
                                            utc_start: session.session_start,
                                            tutor_timezone: tutorTimezone,
                                            displayed_time: startTime
                                          });
                                          return `${startTime} (${duration} min)`;
                                        })()
                                      : 'Loading timezone...'}
                                  </span>
                                  <span className="font-medium text-green-600">
                                    {formatCurrency(calculatedPrice, tutorCurrency)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {!session.paid && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-600 border-green-200 hover:bg-green-50"
                                    onClick={() => handleMarkAsPaid(session.id, session.student_name)}
                                    disabled={markAsPaidMutation.isPending}
                                  >
                                    <Coins className="h-3 w-3 mr-1" />
                                    Mark Paid
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-400 hover:text-red-600"
                                  onClick={() => handleCancelSession(session.id, session.student_name)}
                                  disabled={cancelSessionMutation.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}