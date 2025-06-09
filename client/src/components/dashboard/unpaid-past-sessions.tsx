import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { useToast } from "@/hooks/use-toast";
import { Coins, AlertTriangle, TrendingUp } from "lucide-react";
import { Link } from "wouter";

interface UnpaidSession {
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

interface UpcomingSession {
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

interface PaymentOverviewProps {
  currency?: string;
  limit?: number;
  showViewAll?: boolean;
}

type ViewMode = 'overdue' | 'expected';
type ExpectedTimeframe = 'next30days' | 'nextMonth' | 'allFuture';

export function PaymentOverview({ currency = 'USD', limit = 0, showViewAll = true }: PaymentOverviewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Toggle state for view mode and expected earnings timeframe
  const [viewMode, setViewMode] = useState<ViewMode>('overdue');
  const [expectedTimeframe, setExpectedTimeframe] = useState<ExpectedTimeframe>('next30days');

  // Fetch unpaid past sessions (overdue)
  const { data: unpaidSessions, isLoading: isLoadingUnpaid, error: unpaidError } = useQuery({
    queryKey: ['unpaid-past-sessions', limit],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

      let query = supabase
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
        .eq('paid', false)
        .or(`date.lt.${currentDate},and(date.eq.${currentDate},time.lt.${currentTime})`)
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (limit && limit > 0) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching unpaid past sessions:', error);
        throw error;
      }

      const sessionsWithNames = data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];

      return sessionsWithNames as UnpaidSession[];
    },
  });

  // Set up Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('payment-overview-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions'
        },
        (payload) => {
          console.log('Sessions updated, refreshing payment overview:', payload);
          queryClient.invalidateQueries({ queryKey: ['unpaid-past-sessions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
      queryClient.invalidateQueries({ queryKey: ['unpaid-past-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['earnings-sessions'] });
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

  const getDaysOverdue = (date: string, time: string) => {
    const sessionDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    const diffTime = now.getTime() - sessionDateTime.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const totalOverdue = unpaidSessions?.reduce((sum, session) => {
    return sum + (session.duration / 60) * session.rate;
  }, 0) || 0;

  const isLoading = isLoadingUnpaid;
  const error = unpaidError;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Payment Overview
          </CardTitle>
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16 ml-1" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
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
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Payment Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-red-500 py-6">
            Error loading payment data
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Overdue Payments
          <span className="text-lg font-bold text-orange-600">
            {formatCurrency(totalOverdue, currency)}
          </span>
        </CardTitle>
        {showViewAll && unpaidSessions && unpaidSessions.length > 0 && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/unpaid-sessions">View all</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>

        {unpaidSessions?.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            No unpaid sessions! 🎉
          </p>
        ) : (
          <div className="space-y-3">
            {unpaidSessions?.slice(0, limit > 0 ? limit : unpaidSessions.length).map((session) => {
              const sessionDate = new Date(session.date);
              const now = new Date();
              const daysOverdue = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
              const earnings = (session.duration / 60) * session.rate;

              return (
                <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={`w-2 h-2 rounded-full bg-orange-500`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {session.student_name}
                      </p>
                      <Badge variant="destructive" className="text-xs">
                        {daysOverdue} days overdue
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.date).toLocaleDateString()} at {session.time} ({session.duration} min)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full font-medium">
                      {formatCurrency(earnings, currency)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2 text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleMarkAsPaid(session.id, session.student_name)}
                      disabled={markAsPaidMutation.isPending}
                    >
                      <Coins className="h-3 w-3 mr-1" />
                      Mark Paid
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export with the old name for backward compatibility
export { PaymentOverview as UnpaidPastSessions };