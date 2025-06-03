import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, CalendarPlus, UserPlus } from "lucide-react";
import { Link } from "wouter";

interface Activity {
  id: number;
  type: "payment" | "session_scheduled" | "student_added";
  description: string;
  time: string;
  amount?: number;
}

interface RecentActivityProps {
  activities: Activity[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
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

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/earnings">View all</Link>
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
          <Link href="/earnings">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = getActivityIcon(activity.type);
            const colors = getIconColors(activity.type);
            
            return (
              <div key={activity.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colors.bg}`}>
                  <Icon className={`w-4 h-4 ${colors.icon}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
                {activity.amount && (
                  <span className="text-sm font-medium text-green-600">
                    +${activity.amount}
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
