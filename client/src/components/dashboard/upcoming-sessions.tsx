import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface Session {
  id: string;
  student_name: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  created_at: string;
}

export function UpcomingSessions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['upcoming-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .gte('date', new Date().toISOString().split('T')[0]) // Only future sessions
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(5);

      if (error) {
        console.error('Error fetching sessions:', error);
        throw error;
      }

      return data as Session[];
    },
  });

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

  const handleCancelSession = (sessionId: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to cancel the session with ${studentName}?`)) {
      cancelSessionMutation.mutate(sessionId);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Upcoming Sessions</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/calendar">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Skeleton className="w-2 h-2 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
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
          <CardTitle className="text-lg font-semibold">Upcoming Sessions</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/calendar">View all</Link>
          </Button>
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Upcoming Sessions</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/calendar">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-6">
            No upcoming sessions scheduled
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Upcoming Sessions</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/calendar">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sessions.map((session, index) => {
            const calculatedPrice = (session.duration / 60) * session.rate;
            return (
              <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className={`w-2 h-2 rounded-full ${
                  index === 0 ? 'bg-blue-500' : 
                  index === 1 ? 'bg-green-500' : 'bg-purple-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {session.student_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.date} at {session.time} ({session.duration} min)
                  </p>
                </div>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium">
                  {formatCurrency(calculatedPrice)}
                </span>
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
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
