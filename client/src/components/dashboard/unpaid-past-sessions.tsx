import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, AlertTriangle } from "lucide-react";

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

interface UnpaidPastSessionsProps {
  currency?: string;
}

export function UnpaidPastSessions({ currency = 'USD' }: UnpaidPastSessionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: unpaidSessions, isLoading, error } = useQuery({
    queryKey: ['unpaid-past-sessions'],
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
        console.error('Error fetching unpaid past sessions:', error);
        throw error;
      }

      // Transform the data to include student_name
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
      .channel('unpaid-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions'
        },
        (payload) => {
          console.log('Sessions updated, refreshing unpaid sessions:', payload);
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
      // Refresh all relevant queries
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Unpaid Past Sessions
          </CardTitle>
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
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Unpaid Past Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-red-500 py-6">
            Error loading unpaid sessions
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!unpaidSessions || unpaidSessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-green-600" />
            Unpaid Past Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-green-600 py-6">
            Great! No overdue payments
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalOverdue = unpaidSessions.reduce((sum, session) => {
    return sum + (session.duration / 60) * session.rate;
  }, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Unpaid Past Sessions
        </CardTitle>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Overdue</p>
          <p className="text-lg font-semibold text-orange-600">
            {formatCurrency(totalOverdue, currency)}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {unpaidSessions.map((session) => {
            const calculatedPrice = (session.duration / 60) * session.rate;
            const daysOverdue = getDaysOverdue(session.date, session.time);
            
            return (
              <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground">
                      {session.student_name}
                    </p>
                    <Badge variant="destructive" className="text-xs">
                      {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {session.date} at {session.time} ({session.duration} min)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-orange-600">
                    {formatCurrency(calculatedPrice, currency)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2 text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => handleMarkAsPaid(session.id, session.student_name)}
                    disabled={markAsPaidMutation.isPending}
                  >
                    <DollarSign className="h-3 w-3 mr-1" />
                    Mark Paid
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