
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  Coins, 
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { triggerEarningsConfetti } from "@/lib/confetti";
import { formatSessionTime, calculateDurationMinutes } from "@/lib/dateUtils";

interface UnpaidSession {
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
}

export default function UnpaidSessions() {
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    queryKey: ['all-unpaid-sessions'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

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
          students (
            name
          )
        `)
        .eq('tutor_id', tutorId)
        .eq('paid', false)
        .or(`date.lt.${currentDate},and(date.eq.${currentDate},time.lt.${currentTime})`)
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (error) {
        console.error('Error fetching unpaid sessions:', error);
        throw error;
      }

      const sessionsWithNames = data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];

      return sessionsWithNames as UnpaidSession[];
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
      // Trigger confetti for payment success
      triggerEarningsConfetti();
      
      toast({
        title: "💰 Payment recorded!",
        description: "The session has been marked as paid.",
      });
      queryClient.invalidateQueries({ queryKey: ['all-unpaid-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['unpaid-past-sessions'] });
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

  const handleMarkAsPaid = (sessionId: string, studentName: string) => {
    if (window.confirm(`Mark overdue session with ${studentName} as paid?`)) {
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
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    if (sessionDate.toDateString() === today.toDateString()) {
      return "Today";
    } else if (sessionDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else if (sessionDate >= lastWeek) {
      return sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    } else {
      return sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const getDaysOverdue = (date: string, time: string) => {
    const sessionDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    const diffTime = now.getTime() - sessionDateTime.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Group sessions by date
  const groupedSessions = sessions.reduce((groups: { [key: string]: UnpaidSession[] }, session) => {
    const date = session.session_start 
      ? new Date(session.session_start).toISOString().split('T')[0]
      : session.date || '';
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(session);
    return groups;
  }, {});

  // Calculate summary statistics
  const totalSessions = sessions.length;
  const totalOverdue = sessions.reduce((sum, session) => {
    return sum + (session.duration / 60) * session.rate;
  }, 0);

  const uniqueStudents = new Set(sessions.map(session => session.student_name)).size;

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
              <CardTitle className="text-2xl font-bold">All Unpaid Sessions</CardTitle>
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
              <CardTitle className="text-2xl font-bold">All Unpaid Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-red-500 py-12">
                Error loading unpaid sessions
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
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Overdue</p>
                  <p className="text-xl font-bold">{totalSessions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Students Affected</p>
                  <p className="text-xl font-bold">{uniqueStudents}</p>
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
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-xl font-bold">{formatCurrency(totalOverdue, tutorCurrency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">All Unpaid Sessions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Overdue sessions grouped by date, sorted chronologically
            </p>
          </CardHeader>

          <CardContent>
            {totalSessions === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="mx-auto h-12 w-12 text-green-400 mb-4" />
                <p className="text-lg font-medium text-green-600 mb-2">Great! No overdue payments</p>
                <p className="text-sm text-gray-500">
                  All your past sessions have been paid for.
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
                        className="w-full justify-between p-3 h-auto hover:bg-orange-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <CalendarIcon className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-base">{formatDateGroup(date)}</h3>
                            <p className="text-sm text-muted-foreground">
                              {dateSessions.length} overdue session{dateSessions.length !== 1 ? 's' : ''}
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
                        const daysOverdue = getDaysOverdue(session.date, session.time);
                        
                        return (
                          <div
                            key={session.id}
                            className="ml-11 p-4 bg-orange-50 border border-orange-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-gray-900">
                                    {session.student_name}
                                  </h4>
                                  <Badge variant="destructive" className="text-xs">
                                    {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {session.session_start && session.session_end 
                                      ? (() => {
                                          console.log("DEBUG", { raw: session.session_start, converted: new Date(session.session_start).toString() });
                                          const time = formatSessionTime(session.session_start);
                                          const duration = calculateDurationMinutes(session.session_start, session.session_end);
                                          return `${time} (${duration} min)`;
                                        })()
                                      : `${session.time?.substring(0, 5) || ''} (${session.duration || 0} min)`}
                                  </span>
                                  <span className="font-medium text-orange-600">
                                    {formatCurrency(calculatedPrice, tutorCurrency)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
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
