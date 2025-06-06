import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, CalendarPlus, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { formatCurrency } from "@/lib/utils";

interface Activity {
  id: string;
  type: "payment" | "session_scheduled" | "student_added";
  description: string;
  time: string;
  amount?: number;
  created_at: string;
}

interface RecentActivityProps {
  currency?: string;
  limit?: number; // Add limit prop for dashboard vs full view
}

export function RecentActivity({ currency = 'USD', limit = 5 }: RecentActivityProps) {
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      // Fetch recent sessions (with student names)
      const { data: recentSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          id,
          created_at,
          paid,
          rate,
          duration,
          students (
            name
          )
        `)
        .eq('tutor_id', tutorId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessionsError) {
        console.error('Error fetching sessions for activity:', sessionsError);
      }

      // Fetch recent students
      const { data: recentStudents, error: studentsError } = await supabase
        .from('students')
        .select('id, name, created_at')
        .eq('tutor_id', tutorId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (studentsError) {
        console.error('Error fetching students for activity:', studentsError);
      }

      const activities: Activity[] = [];

      // Add session activities
      if (recentSessions) {
        recentSessions.forEach((session: any) => {
          const studentName = session.students?.name || 'Unknown Student';
          const sessionEarnings = (session.duration / 60) * session.rate;
          
          // Session scheduled activity
          activities.push({
            id: `session-${session.id}`,
            type: 'session_scheduled',
            description: `New session scheduled with ${studentName}`,
            time: getRelativeTime(session.created_at),
            created_at: session.created_at
          });

          // Payment activity (if session is paid)
          if (session.paid) {
            activities.push({
              id: `payment-${session.id}`,
              type: 'payment',
              description: `Payment received from ${studentName}`,
              time: getRelativeTime(session.created_at),
              amount: sessionEarnings,
              created_at: session.created_at
            });
          }
        });
      }

      // Add student activities
      if (recentStudents) {
        recentStudents.forEach((student) => {
          activities.push({
            id: `student-${student.id}`,
            type: 'student_added',
            description: `New student added: ${student.name}`,
            time: getRelativeTime(student.created_at),
            created_at: student.created_at
          });
        });
      }

      // Sort all activities by created_at and return all for the query
      return activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  // Set up Supabase realtime subscription
  useEffect(() => {
    const sessionsChannel = supabase
      .channel('activity-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
      })
      .subscribe();

    const studentsChannel = supabase
      .channel('activity-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(studentsChannel);
    };
  }, [queryClient]);

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return time.toLocaleDateString();
  };
  const getActivityIcon = (type: Activity["type"]) => {
    switch (type) {
      case "payment":
        return CheckCircle;
      case "session_scheduled":
        return CalendarPlus;
      case "student_added":
        return UserPlus;
      default:
        return CheckCircle;
    }
  };

  const getIconColors = (type: Activity["type"]) => {
    switch (type) {
      case "payment":
        return { bg: "bg-green-100", icon: "text-green-600" };
      case "session_scheduled":
        return { bg: "bg-blue-100", icon: "text-blue-600" };
      case "student_added":
        return { bg: "bg-purple-100", icon: "text-purple-600" };
      default:
        return { bg: "bg-gray-100", icon: "text-gray-600" };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
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
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-red-500 py-6">
            Error loading activity
          </p>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/activity">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-6">
            No recent activity
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/activity">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.slice(0, limit).map((activity) => {
            const Icon = getActivityIcon(activity.type);
            const colors = getIconColors(activity.type);
            
            return (
              <div key={activity.id} className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-md transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colors.bg}`}>
                  <Icon className={`w-4 h-4 ${colors.icon}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
                {activity.amount && (
                  <span className="text-sm font-medium text-green-600">
                    +{formatCurrency(activity.amount, currency)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
