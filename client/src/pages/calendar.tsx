import { useState, useEffect } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Calendar as BigCalendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Plus, Calendar as CalendarIcon, Filter } from "lucide-react";

const localizer = momentLocalizer(moment);

interface Session {
  id: string;
  student_name: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  created_at: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Session;
}

export default function Calendar() {
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['calendar-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching calendar sessions:', error);
        throw error;
      }

      return data as Session[];
    },
  });

  // Set up Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'sessions'
        },
        (payload) => {
          console.log('Sessions table changed:', payload);
          
          // Invalidate and refetch sessions data
          queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
          queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
          queryClient.invalidateQueries({ queryKey: ['earnings-sessions'] });
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Get unique students for filter dropdown
  const uniqueStudents = sessions ? 
    Array.from(new Set(sessions.map(session => session.student_name))).sort() : [];

  // Filter sessions based on selected student
  const filteredSessions = sessions ? 
    selectedStudent === 'all' 
      ? sessions 
      : sessions.filter(session => session.student_name === selectedStudent)
    : [];

  // Convert sessions to calendar events
  const events: CalendarEvent[] = filteredSessions.map(session => {
    // Parse date and time to create start datetime
    const [hours, minutes] = session.time.split(':').map(Number);
    const start = new Date(session.date);
    start.setHours(hours, minutes, 0, 0);
    
    // Calculate end time by adding duration
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + session.duration);

    return {
      id: session.id,
      title: session.student_name,
      start,
      end,
      resource: session
    };
  });

  const handleScheduleSession = () => {
    window.dispatchEvent(new CustomEvent('openScheduleModal'));
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    return {
      style: {
        backgroundColor: '#3b82f6',
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your tutoring schedule and upcoming sessions.
              </p>
            </div>
            <Button onClick={handleScheduleSession}>
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          </div>
        </header>

        <div className="p-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <Skeleton className="h-6 w-32" />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-8 w-40" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your tutoring schedule and upcoming sessions.
              </p>
            </div>
            <Button onClick={handleScheduleSession}>
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          </div>
        </header>

        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-red-500">
                  Error loading calendar data. Please try again.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your tutoring schedule and upcoming sessions.
            </p>
          </div>
          <Button onClick={handleScheduleSession}>
            <Plus className="w-4 h-4 mr-2" />
            Schedule Session
          </Button>
        </div>
      </header>

      {/* Calendar Content */}
      <div className="p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>
              {calendarView === 'week' ? 'Weekly Schedule' : 'Monthly Schedule'}
            </CardTitle>
            <div className="flex items-center gap-3">
              {/* Student Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by student" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Students</SelectItem>
                    {uniqueStudents.map(student => (
                      <SelectItem key={student} value={student}>
                        {student}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <div className="flex border rounded-md">
                  <Button
                    variant={calendarView === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-r-none border-r-0"
                    onClick={() => setCalendarView('week')}
                  >
                    Week
                  </Button>
                  <Button
                    variant={calendarView === 'month' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setCalendarView('month')}
                  >
                    Month
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ height: '600px' }}>
              <BigCalendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                defaultView={calendarView === 'week' ? Views.WEEK : Views.MONTH}
                view={calendarView === 'week' ? Views.WEEK : Views.MONTH}
                onView={(view) => setCalendarView(view === Views.WEEK ? 'week' : 'month')}
                views={[Views.WEEK, Views.MONTH]}
                step={30}
                showMultiDayTimes
                eventPropGetter={eventStyleGetter}
                toolbar={true}
                popup={true}
                popupOffset={30}
                style={{ height: '100%' }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
