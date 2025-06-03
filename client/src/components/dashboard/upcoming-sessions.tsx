import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTime, formatCurrency } from "@/lib/utils";
import { Link } from "wouter";

interface Session {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  rate: number;
  studentName?: string;
}

interface UpcomingSessionsProps {
  sessions: Session[];
}

export function UpcomingSessions({ sessions }: UpcomingSessionsProps) {
  if (sessions.length === 0) {
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
          {sessions.map((session, index) => (
            <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className={`w-2 h-2 rounded-full ${
                index === 0 ? 'bg-blue-500' : 
                index === 1 ? 'bg-green-500' : 'bg-purple-500'
              }`} />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {session.studentName ? 
                    `${session.studentName} - ${session.title}` : 
                    session.title
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(session.startTime)} - {formatTime(session.endTime)}
                </p>
              </div>
              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium">
                {formatCurrency(session.rate)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
