import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { Calendar as BigCalendarBase, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Plus, Calendar as CalendarIcon, Filter, Edit, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const localizer = momentLocalizer(moment);

// Create drag-and-drop enhanced calendar
const DragAndDropCalendar = withDragAndDrop(BigCalendarBase);

// Schema for editing series (excluding date and recurring options)
const editSeriesSchema = z.object({
  studentId: z.string().min(1, "Please select a student"),
  time: z.string().min(1, "Time is required").regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:MM)"),
  duration: z.number().min(15, "Duration must be at least 15 minutes").max(480, "Duration cannot exceed 8 hours"),
  rate: z.number().min(0, "Rate must be a positive number"),
});

interface Session {
  id: string;
  student_id: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  created_at: string;
}

interface SessionWithStudent {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  created_at: string;
  recurrence_id?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: SessionWithStudent;
}

export default function Calendar() {
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<SessionWithStudent | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [modalView, setModalView] = useState<'details' | 'editSeries' | 'editSession'>('details');
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['calendar-sessions'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          students (
            name
          )
        `)
        .eq('tutor_id', tutorId)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching calendar sessions:', error);
        throw error;
      }

      // Transform the data to include student_name
      const sessionsWithNames = data?.map((session: any) => ({
        ...session,
        student_name: session.students?.name || 'Unknown Student'
      })) || [];

      return sessionsWithNames as SessionWithStudent[];
    },
  });

  // Delete individual session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error('Error deleting session:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Session cancelled",
        description: "The session has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowSessionModal(false);
    },
    onError: (error) => {
      console.error('Error deleting session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel session. Please try again.",
      });
    },
  });

  // Delete recurring series mutation
  const deleteSeriesMutation = useMutation({
    mutationFn: async (recurrenceId: string) => {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('recurrence_id', recurrenceId);

      if (error) {
        console.error('Error deleting recurring series:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Series cancelled",
        description: "All sessions in the recurring series have been cancelled.",
      });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowSessionModal(false);
      setModalView('details');
    },
    onError: (error) => {
      console.error('Error deleting recurring series:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel recurring series. Please try again.",
      });
    },
  });

  // Update individual session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async (updateData: { sessionId: string; data: any }) => {
      const { sessionId, data } = updateData;
      
      const { error } = await supabase
        .from('sessions')
        .update({
          student_id: data.studentId,
          time: data.time,
          duration: data.duration,
          rate: data.rate,
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error updating session:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Session updated",
        description: "The session has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowSessionModal(false);
      setModalView('details');
    },
    onError: (error) => {
      console.error('Error updating session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update session. Please try again.",
      });
    },
  });

  // Reschedule session mutation for drag-and-drop
  const rescheduleSessionMutation = useMutation({
    mutationFn: async (updateData: { sessionId: string; newStart: Date; newEnd: Date }) => {
      const { sessionId, newStart, newEnd } = updateData;
      
      // Calculate new date, time, and duration
      const newDate = newStart.toISOString().split('T')[0];
      const newTime = newStart.toTimeString().slice(0, 5);
      const newDuration = Math.round((newEnd.getTime() - newStart.getTime()) / (1000 * 60));
      
      const { error } = await supabase
        .from('sessions')
        .update({
          date: newDate,
          time: newTime,
          duration: newDuration,
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error rescheduling session:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Session rescheduled",
        description: "The session has been moved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error) => {
      console.error('Error rescheduling session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reschedule session. Please try again.",
      });
    },
  });

  // Update recurring series mutation
  const updateSeriesMutation = useMutation({
    mutationFn: async (updateData: { recurrenceId: string; data: any }) => {
      const { recurrenceId, data } = updateData;
      
      const { error } = await supabase
        .from('sessions')
        .update({
          student_id: data.studentId,
          time: data.time,
          duration: data.duration,
          rate: data.rate,
        })
        .eq('recurrence_id', recurrenceId);

      if (error) {
        console.error('Error updating recurring series:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Series updated",
        description: "All sessions in the recurring series have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowSessionModal(false);
      setModalView('details');
    },
    onError: (error) => {
      console.error('Error updating recurring series:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update recurring series. Please try again.",
      });
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

  // Fetch students for filter dropdown
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching students:', error);
        throw error;
      }

      return data;
    },
  });

  // Get unique students from sessions for filter dropdown
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
      title: `${session.student_name} – ${session.duration} min`,
      start,
      end,
      resource: session
    };
  });

  const handleScheduleSession = () => {
    window.dispatchEvent(new CustomEvent('openScheduleModal'));
  };

  // Handle event click to show session details modal
  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedSession(event.resource);
    setModalView('details');
    setShowSessionModal(true);
  };

  // Handle session actions
  const handleEditSession = () => {
    setModalView('editSession');
  };

  const handleEditSeries = () => {
    setModalView('editSeries');
  };

  const handleCancelSession = () => {
    if (!selectedSession) return;
    
    if (window.confirm(`Are you sure you want to cancel the session with ${selectedSession.student_name}?`)) {
      deleteSessionMutation.mutate(selectedSession.id);
    }
  };

  const handleCancelSeries = () => {
    if (!selectedSession?.recurrence_id) return;
    
    if (window.confirm(`Are you sure you want to cancel ALL sessions in this recurring series with ${selectedSession.student_name}?`)) {
      deleteSeriesMutation.mutate(selectedSession.recurrence_id);
    }
  };

  // Handle modal close - reset to details view or close modal
  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      setShowSessionModal(false);
      setModalView('details');
    } else {
      setShowSessionModal(true);
    }
  };

  // Handle form cancel - return to details view
  const handleFormCancel = () => {
    setModalView('details');
  };

  // Handle individual session form submission
  const handleSessionFormSubmit = (data: any) => {
    if (!selectedSession?.id) return;
    
    updateSessionMutation.mutate({
      sessionId: selectedSession.id,
      data
    });
  };

  // Handle series form submission
  const handleSeriesFormSubmit = (data: any) => {
    if (!selectedSession?.recurrence_id) return;
    
    updateSeriesMutation.mutate({
      recurrenceId: selectedSession.recurrence_id,
      data
    });
  };

  // Handle drag-and-drop event move
  const handleEventDrop = ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    if (rescheduleSessionMutation.isPending) return;
    
    rescheduleSessionMutation.mutate({
      sessionId: event.id,
      newStart: start,
      newEnd: end
    });
  };

  // Handle event resize
  const handleEventResize = ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    if (rescheduleSessionMutation.isPending) return;
    
    rescheduleSessionMutation.mutate({
      sessionId: event.id,
      newStart: start,
      newEnd: end
    });
  };

  // EditSessionForm component
  const EditSessionForm = () => {
    if (!selectedSession) return null;

    const form = useForm({
      resolver: zodResolver(editSeriesSchema),
      defaultValues: {
        studentId: selectedSession.student_id,
        time: selectedSession.time,
        duration: selectedSession.duration,
        rate: selectedSession.rate,
      },
    });

    const onSubmit = (data: z.infer<typeof editSeriesSchema>) => {
      handleSessionFormSubmit(data);
    };

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="60"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate (per hour in {tutorCurrency})</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="45.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleFormCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateSessionMutation.isPending}
              className="flex-1"
            >
              {updateSessionMutation.isPending ? "Updating..." : "Update Session"}
            </Button>
          </div>
        </form>
      </Form>
    );
  };

  // EditSeriesForm component
  const EditSeriesForm = () => {
    if (!selectedSession) return null;

    const form = useForm({
      resolver: zodResolver(editSeriesSchema),
      defaultValues: {
        studentId: selectedSession.student_id,
        time: selectedSession.time,
        duration: selectedSession.duration,
        rate: selectedSession.rate,
      },
    });

    const onSubmit = (data: z.infer<typeof editSeriesSchema>) => {
      handleSeriesFormSubmit(data);
    };

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="60"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate (per hour in {tutorCurrency})</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="45.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleFormCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateSeriesMutation.isPending}
              className="flex-1"
            >
              {updateSeriesMutation.isPending ? "Updating..." : "Update Series"}
            </Button>
          </div>
        </form>
      </Form>
    );
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    return {
      style: {
        // Let CSS classes handle the styling for better consistency
      }
    };
  };

  // Custom event component with enhanced tooltip
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const { student_name, duration, time, rate } = event.resource;
    const startTime = new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const earning = rate * duration / 60;
    
    const tooltipText = `${student_name}\n${startTime} - ${duration} min\nRate: ${formatCurrency(rate, tutorCurrency)}/hr\nEarning: ${formatCurrency(earning, tutorCurrency)}`;
    
    return (
      <div title={tooltipText} className="calendar-event-content">
        <div className="calendar-event-title">
          {student_name}
        </div>
        <div className="calendar-event-details">
          {duration}min • {formatCurrency(rate, tutorCurrency)}
        </div>
      </div>
    );
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
      {/* Enhanced Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage your tutoring schedule and upcoming sessions.
            </p>
          </div>
          <Button 
            onClick={handleScheduleSession}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Schedule Session
          </Button>
        </div>
      </header>

      {/* Calendar Content */}
      <div className="p-4 sm:p-6">
        <Card className="shadow-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 pb-6">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {calendarView === 'week' ? 'Weekly Schedule' : 'Monthly Schedule'}
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Student Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger className="w-full sm:w-44 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
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
                <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <div className="flex bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden p-1">
                  <Button
                    variant={calendarView === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      calendarView === 'week'
                        ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-600/50'
                    }`}
                    onClick={() => setCalendarView('week')}
                  >
                    Week
                  </Button>
                  <Button
                    variant={calendarView === 'month' ? 'default' : 'ghost'}
                    size="sm"
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                      calendarView === 'month'
                        ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-600/50'
                    }`}
                    onClick={() => setCalendarView('month')}
                  >
                    Month
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="h-[500px] sm:h-[600px] lg:h-[700px] bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <DndProvider backend={HTML5Backend}>
                <DragAndDropCalendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  defaultView={calendarView === 'week' ? Views.WEEK : Views.MONTH}
                  view={calendarView === 'week' ? Views.WEEK : Views.MONTH}
                  onView={(view: any) => setCalendarView(view === Views.WEEK ? 'week' : 'month')}
                  onSelectEvent={handleSelectEvent}
                  onEventDrop={handleEventDrop}
                  onEventResize={handleEventResize}
                  resizable
                  draggableAccessor={() => true}
                  views={[Views.WEEK, Views.MONTH]}
                  step={30}
                  timeslots={2}
                  showMultiDayTimes
                  eventPropGetter={eventStyleGetter}
                  toolbar={false}
                  popup={false}
                  style={{ height: '100%' }}
                  components={{
                    toolbar: () => null, // Completely disable the toolbar
                    event: EventComponent, // Use custom event component for consistent tooltips
                  }}
                />
              </DndProvider>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session Details Modal */}
      <Dialog open={showSessionModal} onOpenChange={handleModalOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modalView === 'details' ? 'Session Details' : 
               modalView === 'editSession' ? 'Edit Session' : 'Edit Recurring Series'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-4">
              {modalView === 'details' ? (
                <>
                  <div className="space-y-2">
                    <p><strong>Student:</strong> {selectedSession.student_name}</p>
                    <p><strong>Date:</strong> {new Date(selectedSession.date).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> {selectedSession.time}</p>
                    <p><strong>Duration:</strong> {selectedSession.duration} minutes</p>
                    <p><strong>Rate:</strong> {formatCurrency(selectedSession.rate, tutorCurrency)}/hour</p>
                    <p><strong>Earning:</strong> {formatCurrency(selectedSession.rate * selectedSession.duration / 60, tutorCurrency)}</p>
                    {selectedSession.recurrence_id && (
                      <p className="text-sm text-muted-foreground">
                        <strong>Note:</strong> This is part of a recurring series
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Individual session actions */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Individual Session</h4>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleEditSession}
                          className="flex-1"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit this session
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleCancelSession}
                          className="flex-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Cancel this session
                        </Button>
                      </div>
                    </div>

                    {/* Recurring series actions - only show if session has recurrence_id */}
                    {selectedSession.recurrence_id && (
                      <div className="space-y-2 border-t pt-4">
                        <h4 className="text-sm font-medium">Recurring Series</h4>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleEditSeries}
                            className="flex-1"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Series
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleCancelSeries}
                            className="flex-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Cancel Series
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : modalView === 'editSession' ? (
                <EditSessionForm />
              ) : (
                <EditSeriesForm />
              )}
            </div>
          )}

          {modalView === 'details' && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSessionModal(false)}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
