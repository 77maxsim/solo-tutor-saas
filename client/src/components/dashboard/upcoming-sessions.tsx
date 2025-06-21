import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { useToast } from "@/hooks/use-toast";
import { X, Coins, Repeat } from "lucide-react";
import { getLocalSessionDisplayInfo } from "@/lib/dateUtils";

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

interface UpcomingSessionsProps {
  currency?: string;
  limit?: number;
  showViewAll?: boolean;
}

export function UpcomingSessions({ currency = 'USD', limit = 5, showViewAll = true }: UpcomingSessionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['upcoming-sessions', limit],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      let query = supabase
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
        .gte('date', new Date().toISOString().split('T')[0]) // Only future sessions
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      // Apply limit only if specified (for dashboard view)
      if (limit && limit > 0) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching sessions:', error);
        throw error;
      }

      // Transform the data to include student_name
      const sessionsWithNames = data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];

      return sessionsWithNames as Session[];
    },
  });

  // Set up Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('upcoming-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions'
        },
        (payload) => {
          console.log('Sessions updated, refreshing upcoming sessions:', payload);
          queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
      // Refresh the sessions list
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
      // Refresh all relevant queries
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['earnings-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
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

  if (isLoading) {
    return (
      <Card className="dark:bg-card dark:shadow-md dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 dark:text-gray-100">🗓️ Upcoming Sessions</CardTitle>
          {showViewAll && (
            <Button variant="ghost" size="sm" asChild className="dark:hover:bg-gray-700 dark:text-gray-300">
              <Link href="/upcoming-sessions">View all</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 dark:bg-gray-800/50">
                <Skeleton className="w-2 h-2 rounded-full dark:bg-gray-600" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 dark:bg-gray-600" />
                  <Skeleton className="h-3 w-1/2 dark:bg-gray-600" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full dark:bg-gray-600" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">🗓️ Upcoming Sessions</CardTitle>
          {showViewAll && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/upcoming-sessions">View all</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-center text-red-500 py-6">
            Error loading sessions
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card className="dark:bg-card dark:shadow-md dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 dark:text-gray-100">🗓️ Upcoming Sessions</CardTitle>
          {showViewAll && (
            <Button variant="ghost" size="sm" asChild className="dark:hover:bg-gray-700 dark:text-gray-300">
              <Link href="/upcoming-sessions">View all</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground dark:text-gray-400 py-6">
            No upcoming sessions scheduled
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dark:bg-card dark:shadow-md dark:border-gray-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 dark:text-gray-100">🗓️ Upcoming Sessions</CardTitle>
        {showViewAll && (
          <Button variant="ghost" size="sm" asChild className="dark:hover:bg-gray-700 dark:text-gray-300">
            <Link href="/upcoming-sessions">View all</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sessions.map((session, index) => {
            const calculatedPrice = (session.duration / 60) * session.rate;
            
            // Create full datetime for the session
            const sessionDateTime = new Date(`${session.date}T${session.time}`);
            const createdDate = new Date(session.created_at);
            const now = new Date();
            
            // Session is "logged late" if it was created after the session time had already passed
            const isLoggedLate = createdDate > sessionDateTime && now > sessionDateTime;
            
            return (
              <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 dark:bg-gray-800/50 hover:bg-muted/70 dark:hover:bg-gray-800/70 transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  index === 0 ? 'bg-blue-500' : 
                  index === 1 ? 'bg-green-500' : 'bg-purple-500'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground dark:text-gray-100">
                      {session.student_name}
                    </p>
                    {session.recurrence_id && (
                      <div title="Recurring session">
                        <Repeat className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                      </div>
                    )}
                    {isLoggedLate && (
                      <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-full font-medium">
                        Logged Late
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    {session.session_start && session.session_end 
                      ? getLocalSessionDisplayInfo(session).display
                      : `${session.date} at ${session.time?.substring(0, 5) || ''} (${session.duration || 0} min)`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full font-medium">
                    {formatCurrency(calculatedPrice, currency)}
                  </span>
                  {session.paid ? (
                    <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full font-medium">
                      Paid
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2 text-green-600 dark:text-green-400 border-green-200 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
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
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => handleCancelSession(session.id, session.student_name)}
                    disabled={cancelSessionMutation.isPending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
