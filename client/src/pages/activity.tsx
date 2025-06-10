import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, CalendarPlus, UserPlus, ArrowLeft, Filter } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
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

export default function Activity() {
  const [filterType, setFilterType] = useState<string>("all");

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
        return 'USD'; // Fallback to USD on error
      }

      return data?.currency || 'USD';
    },
  });

  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['all-activity'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      // Fetch all sessions (with student names)
      const { data: allSessions, error: sessionsError } = await supabase
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
        .order('created_at', { ascending: false });

      if (sessionsError) {
        console.error('Error fetching sessions for activity:', sessionsError);
      }

      // Fetch all students
      const { data: allStudents, error: studentsError } = await supabase
        .from('students')
        .select('id, name, created_at')
        .eq('tutor_id', tutorId)
        .order('created_at', { ascending: false });

      if (studentsError) {
        console.error('Error fetching students for activity:', studentsError);
      }

      const activities: Activity[] = [];

      // Add session activities
      if (allSessions) {
        allSessions.forEach((session: any) => {
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
      if (allStudents) {
        allStudents.forEach((student) => {
          activities.push({
            id: `student-${student.id}`,
            type: 'student_added',
            description: `New student added: ${student.name}`,
            time: getRelativeTime(student.created_at),
            created_at: student.created_at
          });
        });
      }

      // Sort all activities by created_at
      return activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

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

  const getActivityTypeLabel = (type: Activity["type"]) => {
    switch (type) {
      case "payment":
        return "Payment";
      case "session_scheduled":
        return "Session";
      case "student_added":
        return "Student";
      default:
        return "Activity";
    }
  };

  // Filter activities based on selected type
  const filteredActivities = filterType === "all" 
    ? activities 
    : activities.filter(activity => activity.type === filterType);

  // Group activities by date for better organization
  const groupedActivities = filteredActivities.reduce((groups: { [key: string]: Activity[] }, activity) => {
    const date = new Date(activity.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey: string;
    if (date.toDateString() === today.toDateString()) {
      groupKey = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = "Yesterday";
    } else {
      groupKey = date.toLocaleDateString();
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(activity);
    return groups;
  }, {});

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
              <CardTitle className="text-2xl font-bold">All Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-3 w-32" />
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
              <CardTitle className="text-2xl font-bold">All Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-red-500 py-12">
                Error loading activity data
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

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                📋 All Activity
              </CardTitle>

              {/* Filter dropdown */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activity</SelectItem>
                    <SelectItem value="payment">Payments</SelectItem>
                    <SelectItem value="session_scheduled">Sessions</SelectItem>
                    <SelectItem value="student_added">Students</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredActivities.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Showing {filteredActivities.length} {filterType === "all" ? "activities" : getActivityTypeLabel(filterType as Activity["type"]).toLowerCase() + "s"}
              </p>
            )}
          </CardHeader>

          <CardContent>
            {filteredActivities.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {filterType === "all" ? "No activity found" : `No ${getActivityTypeLabel(filterType as Activity["type"]).toLowerCase()}s found`}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedActivities).map(([dateGroup, groupActivities]) => (
                  <div key={dateGroup}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 pb-2 border-b">
                      {dateGroup}
                    </h3>
                    <div className="space-y-3">
                      {groupActivities.map((activity) => {
                        const Icon = getActivityIcon(activity.type);
                        const colors = getIconColors(activity.type);

                        return (
                          <div 
                            key={activity.id} 
                            className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colors.bg}`}>
                              <Icon className={`w-5 h-5 ${colors.icon}`} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-foreground font-medium">{activity.description}</p>
                              <p className="text-xs text-muted-foreground">{activity.time}</p>
                            </div>
                            {activity.amount && (
                              <div className="text-right">
                                <span className="text-sm font-semibold text-green-600">
                                  +{formatCurrency(activity.amount, tutorCurrency)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}