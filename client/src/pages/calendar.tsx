import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { shouldUseOptimizedQuery, getOptimizedSessions, getStandardSessions } from "@/lib/queryOptimizer";
import { Calendar as BigCalendarBase, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Plus, Calendar as CalendarIcon, Filter, Edit, Trash2, ChevronLeft, ChevronRight, Maximize, Minimize, ChevronDown, ChevronUp, MapPin, Clock as ClockIcon, User as UserIcon } from "lucide-react";
import { scroller } from "react-scroll";
import { formatCurrency } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { SessionDetailsModal } from "@/components/modals/session-details-modal";
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
import { Label } from "@/components/ui/label";
import MobileCalendarView from "@/components/MobileCalendarView";
import { Clock, User, Check, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const localizer = momentLocalizer(moment);

// Create drag-and-drop enhanced calendar
const DragAndDropCalendar = withDragAndDrop(BigCalendarBase);

// Schema for editing series (excluding date and recurring options)
const editSeriesSchema = z.object({
  studentId: z.string().min(1, "Please select a student"),
  time: z.string().min(1, "Time is required").regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:MM)"),
  duration: z.number().min(15, "Duration must be at least 15 minutes").max(480, "Duration cannot exceed 8 hours"),
  rate: z.number().min(0, "Rate must be a positive number"),
  color: z.string().optional(),
});

interface Session {
  id: string;
  student_id: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  notes?: string;
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
  notes?: string;
  color?: string;
  created_at: string;
  recurrence_id?: string;
  paid?: boolean;
  avatarUrl?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: SessionWithStudent;
}

interface AgendaViewProps {
  sessions: SessionWithStudent[];
  onSelectSession: (session: SessionWithStudent) => void;
  tutorCurrency: string;
}

// Helper function to group sessions by date
const groupSessionsByDate = (sessions: SessionWithStudent[]) => {
  const grouped: { [key: string]: SessionWithStudent[] } = {};
  
  sessions.forEach(session => {
    const dateKey = session.date;
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(session);
  });

  // Sort sessions within each day by time
  Object.keys(grouped).forEach(date => {
    grouped[date].sort((a, b) => a.time.localeCompare(b.time));
  });

  // Return sorted array of { date, sessions }
  return Object.keys(grouped)
    .sort()
    .map(date => ({
      date,
      sessions: grouped[date]
    }));
};

// Get initials from name for avatar fallback
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const AgendaView = ({ sessions, onSelectSession, tutorCurrency }: AgendaViewProps) => {
  const groupedSessions = groupSessionsByDate(sessions);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No sessions scheduled</h3>
        <p className="text-gray-500 dark:text-gray-400">Schedule your first session to get started.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-4 sm:space-y-6 max-h-[600px] sm:max-h-[600px] h-screen sm:h-auto overflow-y-auto overflow-x-hidden">
      {groupedSessions.map(({ date, sessions: daySessions }) => (
        <div key={date} className="relative space-y-2 sm:space-y-3 z-0">
          {/* Date Header */}
          <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 py-2 sm:py-3 px-3 sm:px-4 rounded-lg mb-2 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
              {new Date(date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Sessions for this day */}
          <div className="space-y-2 relative">
            {daySessions.map(session => (
              <Card
                key={session.id}
                className="cursor-pointer hover:shadow-md transition-all duration-200 sm:hover:scale-[1.02] border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 relative overflow-hidden"
                onClick={() => onSelectSession(session)}
              >
                <CardContent className="p-3 sm:p-4 relative">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 relative">
                    {/* Mobile: Avatar and Name Row */}
                    <div className="flex items-center gap-3 sm:hidden">
                      <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-gray-200 dark:ring-gray-600">
                        <AvatarImage 
                          src={session.avatarUrl} 
                          alt={session.student_name}
                          className="object-cover rounded-full"
                        />
                        <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium text-xs rounded-full">
                          {getInitials(session.student_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                          {session.student_name}
                        </h4>
                        <Badge 
                          variant={session.paid === true ? "default" : "secondary"}
                          className={`text-xs mt-1 ${
                            session.paid === true
                              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" 
                              : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                          }`}
                        >
                          {session.paid === true ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </div>
                    </div>

                    {/* Desktop: Avatar */}
                    <Avatar className="hidden sm:block h-12 w-12 flex-shrink-0 ring-2 ring-gray-200 dark:ring-gray-600">
                      <AvatarImage 
                        src={session.avatarUrl} 
                        alt={session.student_name}
                        className="object-cover rounded-full"
                      />
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium text-sm rounded-full">
                        {getInitials(session.student_name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Session Details */}
                    <div className="flex-1 min-w-0">
                      {/* Desktop: Name and Badge */}
                      <div className="hidden sm:flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {session.student_name}
                        </h4>
                        <Badge 
                          variant={session.paid === true ? "default" : "secondary"}
                          className={`text-xs ${
                            session.paid === true
                              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" 
                              : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                          }`}
                        >
                          {session.paid === true ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </div>
                      
                      {/* Time and Earnings */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          🕐 {session.time} ({session.duration}min)
                        </span>
                        <span className="flex items-center gap-1">
                          💰 {formatCurrency(session.rate * session.duration / 60, tutorCurrency)}
                        </span>
                      </div>

                      {session.notes && (
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 sm:mt-1 truncate">
                          📝 {session.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function Calendar() {
  const isMobile = useIsMobile();
  const [calendarView, setCalendarView] = useState<'week' | 'month' | 'agenda'>(isMobile ? 'agenda' : 'week');
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<SessionWithStudent | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [modalView, setModalView] = useState<'details' | 'editSeries' | 'editSession'>('details');
  const [sessionForDetails, setSessionForDetails] = useState<SessionWithStudent | null>(null);
  const [selectedPendingSession, setSelectedPendingSession] = useState<any>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [newStudentName, setNewStudentName] = useState("");
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false);
  const [showPendingSections, setShowPendingSections] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [preventSlotSelection, setPreventSlotSelection] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Handle escape key for exiting full screen
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFullScreen]);

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

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

      // Automatically determine if optimization is needed based on dataset size
      const useOptimized = await shouldUseOptimizedQuery(tutorId);
      
      let allSessions;
      if (useOptimized) {
        allSessions = await getOptimizedSessions(tutorId);
      } else {
        allSessions = await getStandardSessions(tutorId);
      }

      // Ensure we have the status field and handle pending sessions
      return allSessions.map(session => ({
        ...session,
        status: session.status || 'confirmed'
      }));
    },
    refetchOnWindowFocus: true,
    staleTime: 0, // Always consider data stale to force refresh
  });

  // Add real-time subscription for sessions table changes
  useEffect(() => {
    const setupSubscription = async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) return;

      const channel = supabase
        .channel('sessions-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sessions',
            filter: `tutor_id=eq.${tutorId}`,
          },
          (payload) => {
            console.log('Sessions table changed, refreshing calendar:', payload);
            // Force refresh calendar data
            queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupSubscription();
  }, [queryClient]);

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
          color: data.color,
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
          color: data.color,
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

  // Convert single session to recurring series mutation
  const convertToRecurringMutation = useMutation({
    mutationFn: async (data: { 
      sessionId: string; 
      sessionData: any; 
      repeatWeeks: number; 
      originalDate: string;
      originalTime: string;
    }) => {
      const { sessionId, sessionData, repeatWeeks, originalDate, originalTime } = data;
      const recurrenceId = crypto.randomUUID();

      // First update the original session with the recurrence_id and any changes
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          student_id: sessionData.studentId,
          time: sessionData.time,
          duration: sessionData.duration,
          rate: sessionData.rate,
          recurrence_id: recurrenceId,
          color: sessionData.color,
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('Error updating original session:', updateError);
        throw updateError;
      }

      // Get tutor ID for new sessions
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      // Create additional weekly sessions
      const newSessions = [];
      for (let week = 1; week < repeatWeeks; week++) {
        const sessionDate = new Date(originalDate);
        sessionDate.setDate(sessionDate.getDate() + (week * 7));

        newSessions.push({
          tutor_id: tutorId,
          student_id: sessionData.studentId,
          date: sessionDate.toISOString().split('T')[0],
          time: sessionData.time,
          duration: sessionData.duration,
          rate: sessionData.rate,
          paid: false,
          recurrence_id: recurrenceId,
          color: sessionData.color,
        });
      }

      if (newSessions.length > 0) {
        const { error: insertError } = await supabase
          .from('sessions')
          .insert(newSessions);

        if (insertError) {
          console.error('Error creating recurring sessions:', insertError);
          throw insertError;
        }
      }

      return { recurrenceId, totalSessions: repeatWeeks };
    },
    onSuccess: (result) => {
      toast({
        title: "Recurring sessions created",
        description: `Successfully created ${result.totalSessions} weekly sessions.`,
      });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowSessionModal(false);
      setModalView('details');
    },
    onError: (error) => {
      console.error('Error converting to recurring series:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create recurring sessions. Please try again.",
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

  // Get pending sessions only
  const pendingSessions = sessions ? 
    sessions.filter(session => session.status === 'pending')
      .sort((a, b) => new Date(a.date + ' ' + a.time).getTime() - new Date(b.date + ' ' + b.time).getTime())
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

    const isPending = session.status === 'pending';
    
    // Determine display name
    let displayName;
    if (isPending) {
      displayName = session.unassigned_name || 'Pending Request';
    } else {
      displayName = session.student_name;
      // Truncate student name based on session duration
      if (session.duration < 60) {
        // For sessions less than 60 min, show full name
        displayName = session.student_name;
      } else if (session.duration >= 60 && session.duration <= 120) {
        // For 60-120 min, show first name + last initial
        const nameParts = session.student_name.split(' ');
        if (nameParts.length > 1) {
          displayName = `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`;
        } else {
          displayName = nameParts[0];
        }
      }
    }

    // For 30-minute sessions, use empty title to force custom component usage
    const eventTitle = session.duration <= 30 
      ? '' 
      : `${displayName} – ${session.duration} min`;

    return {
      id: session.id,
      title: eventTitle,
      start,
      end,
      resource: {
        ...session,
        isPending
      }
    };
  });

  const handleScheduleSession = () => {
    window.dispatchEvent(new CustomEvent('openScheduleModal'));
  };

  // Add event listeners for session actions from SessionDetailsModal
  useEffect(() => {
    const handleEditSession = (event: CustomEvent) => {
      const session = event.detail.session;
      setSelectedSession(session);
      setModalView('editSession');
      setShowSessionModal(true);
    };

    const handleEditSeries = (event: CustomEvent) => {
      const session = event.detail.session;
      setSelectedSession(session);
      setModalView('editSeries');
      setShowSessionModal(true);
    };

    const handleCancelSession = (event: CustomEvent) => {
      const session = event.detail.session;
      setSelectedSession(session);
      deleteSessionMutation.mutate(session.id);
    };

    const handleCancelSeries = (event: CustomEvent) => {
      const session = event.detail.session;
      if (session.recurrence_id) {
        deleteSeriesMutation.mutate(session.recurrence_id);
      }
    };

    window.addEventListener('editSession', handleEditSession as EventListener);
    window.addEventListener('editSeries', handleEditSeries as EventListener);
    window.addEventListener('cancelSession', handleCancelSession as EventListener);
    window.addEventListener('cancelSeries', handleCancelSeries as EventListener);

    return () => {
      window.removeEventListener('editSession', handleEditSession as EventListener);
      window.removeEventListener('editSeries', handleEditSeries as EventListener);
      window.removeEventListener('cancelSession', handleCancelSession as EventListener);
      window.removeEventListener('cancelSeries', handleCancelSeries as EventListener);
    };
  }, [deleteSessionMutation, deleteSeriesMutation]);

  // Handle event click to show session details modal
  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.resource.isPending || event.resource.status === 'pending') {
      setSelectedPendingSession(event.resource);
    } else {
      setSessionForDetails(event.resource);
      setShowSessionDetailsModal(true);
    }
  };

  // Handle slot click to schedule new session
  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    // Prevent slot selection if we just closed a modal
    if (preventSlotSelection) {
      setPreventSlotSelection(false);
      return;
    }

    // Calculate duration in minutes based on selected time range
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

    // Format date as YYYY-MM-DD
    const selectedDate = start.toISOString().split('T')[0];

    // Format time as HH:MM
    const hours = start.getHours().toString().padStart(2, '0');
    const minutes = start.getMinutes().toString().padStart(2, '0');
    const selectedTime = `${hours}:${minutes}`;

    // Create a custom event to open the schedule modal with pre-filled data
    window.dispatchEvent(new CustomEvent('openScheduleModal', {
      detail: {
        date: selectedDate,
        time: selectedTime,
        duration: Math.max(30, duration) // Minimum 30 minutes, or the selected duration
      }
    }));
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

  // Handle week navigation
  const handlePreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Format the current week range for display
  const getWeekRange = () => {
    const startOfWeek = moment(currentDate).startOf('week');
    const endOfWeek = moment(currentDate).endOf('week');
    
    if (startOfWeek.month() === endOfWeek.month()) {
      return `${startOfWeek.format('MMMM D')} - ${endOfWeek.format('D, YYYY')}`;
    } else {
      return `${startOfWeek.format('MMM D')} - ${endOfWeek.format('MMM D, YYYY')}`;
    }
  };

  // EditSessionForm component
  const EditSessionForm = () => {
    if (!selectedSession) return null;

    const [isRepeatWeekly, setIsRepeatWeekly] = useState(false);
    const [repeatWeeks, setRepeatWeeks] = useState(4);

    const form = useForm({
      resolver: zodResolver(editSeriesSchema),
      defaultValues: {
        studentId: selectedSession.student_id,
        time: selectedSession.time,
        duration: selectedSession.duration,
        rate: selectedSession.rate,
        color: selectedSession.color || "#3B82F6",
      },
    });

    const onSubmit = (data: z.infer<typeof editSeriesSchema>) => {
      if (isRepeatWeekly && !selectedSession.recurrence_id) {
        // Convert to recurring series
        convertToRecurringMutation.mutate({
          sessionId: selectedSession.id,
          sessionData: data,
          repeatWeeks: repeatWeeks,
          originalDate: selectedSession.date,
          originalTime: selectedSession.time,
        });
      } else {
        // Regular session update
        handleSessionFormSubmit(data);
      }
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

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session Color</FormLabel>
                <FormControl>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      { color: "#3B82F6", name: "Blue" },
                      { color: "#F87171", name: "Red" },
                      { color: "#34D399", name: "Green" },
                      { color: "#FBBF24", name: "Yellow" },
                      { color: "#A78BFA", name: "Purple" },
                      { color: "#6B7280", name: "Gray" },
                    ].map((colorOption) => (
                      <div
                        key={colorOption.color}
                        className={`w-8 h-8 rounded-lg cursor-pointer border-2 transition-all ${
                          field.value === colorOption.color
                            ? "border-gray-900 scale-110"
                            : "border-gray-300 hover:border-gray-500"
                        }`}
                        style={{ backgroundColor: colorOption.color }}
                        onClick={() => field.onChange(colorOption.color)}
                        title={colorOption.name}
                      />
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Show warning if session is already recurring */}
          {selectedSession.recurrence_id && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                This session is already part of a recurring series.
              </p>
            </div>
          )}

          {/* Repeat weekly section - only show for non-recurring sessions */}
          {!selectedSession.recurrence_id && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="repeat-weekly"
                  checked={isRepeatWeekly}
                  onCheckedChange={(checked) => setIsRepeatWeekly(!!checked)}
                />
                <label
                  htmlFor="repeat-weekly"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Repeat weekly
                </label>
              </div>

              {isRepeatWeekly && (
                <div className="space-y-2">
                  <label htmlFor="repeat-weeks" className="text-sm font-medium">
                    Repeat for how many weeks?
                  </label>
                  <Input
                    id="repeat-weeks"
                    type="number"
                    min="1"
                    max="12"
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(parseInt(e.target.value) || 4)}
                    className="w-24"
                  />
                  <p className="text-xs text-gray-600">
                    This will create {repeatWeeks} sessions (including this one) at the same time on consecutive weeks.
                  </p>
                </div>
              )}
            </div>
          )}

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
              disabled={updateSessionMutation.isPending || convertToRecurringMutation.isPending}
              className="flex-1"
            >
              {(updateSessionMutation.isPending || convertToRecurringMutation.isPending) 
                ? (isRepeatWeekly ? "Creating Series..." : "Updating...") 
                : (isRepeatWeekly ? "Create Recurring Series" : "Update Session")}
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
        color: selectedSession.color || "#3B82F6",
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

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session Color</FormLabel>
                <FormControl>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      { color: "#3B82F6", name: "Blue" },
                      { color: "#F87171", name: "Red" },
                      { color: "#34D399", name: "Green" },
                      { color: "#FBBF24", name: "Yellow" },
                      { color: "#A78BFA", name: "Purple" },
                      { color: "#6B7280", name: "Gray" },
                    ].map((colorOption) => (
                      <div
                        key={colorOption.color}
                        className={`w-8 h-8 rounded-lg cursor-pointer border-2 transition-all ${
                          field.value === colorOption.color
                            ? "border-gray-900 scale-110"
                            : "border-gray-300 hover:border-gray-500"
                        }`}
                        style={{ backgroundColor: colorOption.color }}
                        onClick={() => field.onChange(colorOption.color)}
                        title={colorOption.name}
                      />
                    ))}
                  </div>
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
    // Create full datetime for the session
    const sessionDateTime = new Date(`${event.resource.date}T${event.resource.time}`);
    const createdDate = new Date(event.resource.created_at);
    const now = new Date();

    // Calculate session end time
    const sessionEndDateTime = new Date(sessionDateTime);
    sessionEndDateTime.setMinutes(sessionEndDateTime.getMinutes() + event.resource.duration);

    // Check if session has ended (past session)
    const isPastSession = now > sessionEndDateTime;

    // Session is "logged late" if it was created after the session time had already passed
    const isLoggedLate = createdDate > sessionDateTime && now > sessionDateTime;

    if (isLoggedLate) {
      return {
        style: {
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          opacity: isPastSession ? '0.45' : '0.85',
          border: '2px solid #fb923c',
          filter: isPastSession ? 'grayscale(0.3)' : 'none',
        }
      };
    }

    // Use the custom color from the session
    const sessionColor = event.resource.color || '#3B82F6';
    return {
      style: {
        background: sessionColor,
        color: 'white',
        border: 'none',
        opacity: isPastSession ? '0.4' : '1',
        filter: isPastSession ? 'grayscale(0.3)' : 'none',
      }
    };
  };

  // Enhanced event component with micro-interactions
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const { student_name, duration, time, rate, date, created_at, notes } = event.resource;
    const startTime = new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const earning = rate * duration / 60;

    // Create full datetime for the session
    const sessionDateTime = new Date(`${date}T${time}`);
    const createdDate = new Date(created_at);
    const now = new Date();

    // Session is "logged late" if it was created after the session time had already passed
    const isLoggedLate = createdDate > sessionDateTime && now > sessionDateTime;
    const hasNotes = notes && notes.trim().length > 0;

    const tooltipText = `${student_name}${isLoggedLate ? ' (Logged Late)' : ''}\n${startTime} - ${duration} min\nRate: ${formatCurrency(rate, tutorCurrency)}/hr\nEarning: ${formatCurrency(earning, tutorCurrency)}${hasNotes ? '\nHas notes' : ''}`;

    // For very short sessions, return enhanced compact view
    if (duration <= 30) {
      return (
        <div 
          title={tooltipText} 
          className="text-white font-medium text-xs flex items-center justify-center gap-1 hover:scale-105 transition-transform duration-200 cursor-pointer group p-1 rounded h-full w-full overflow-hidden"
        >
          <span className="group-hover:animate-bounce-subtle truncate flex-1 text-center">{student_name.split(' ')[0]}</span>
          {isLoggedLate && <span className="animate-pulse text-yellow-300 flex-shrink-0">⚠</span>}
          {hasNotes && <span className="group-hover:animate-wiggle flex-shrink-0">📄</span>}
        </div>
      );
    }

    return (
      <div 
        title={tooltipText} 
        className="calendar-event-content group hover:scale-105 transition-all duration-200 cursor-pointer p-1 rounded h-full flex flex-col justify-start overflow-hidden"
      >
        <div className="calendar-event-title flex items-start gap-1 group-hover:text-white/90 min-h-0 mb-0.5">
          <span className="group-hover:animate-bounce-subtle font-semibold text-xs leading-tight truncate flex-1">{student_name}</span>
          <div className="flex gap-0.5 flex-shrink-0">
            {isLoggedLate && <span className="text-xs animate-pulse text-yellow-300">⚠</span>}
            {hasNotes && <span className="text-xs group-hover:animate-wiggle">📄</span>}
          </div>
        </div>
        <div className="calendar-event-details text-xs opacity-90 group-hover:opacity-100 transition-opacity duration-200 leading-tight">
          <div className="truncate">
            <span className="group-hover:font-medium">{duration}min</span> • 
            <span className="group-hover:font-medium">{formatCurrency(rate, tutorCurrency)}</span>
          </div>
        </div>
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-200 rounded pointer-events-none" />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white dark:bg-gray-900 border-b border-border dark:border-gray-700 px-4 sm:px-6 py-4 transition-colors duration-300 shadow-sm dark:shadow-gray-900/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground dark:text-gray-100 flex items-center gap-2">📅 Calendar</h1>
              <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1 hidden sm:block">
                Manage your tutoring schedule and upcoming sessions.
              </p>
            </div>
            <Button onClick={handleScheduleSession} size="sm" className="self-start sm:self-auto">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Schedule Session</span>
              <span className="sm:hidden">Schedule</span>
            </Button>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 pb-4">
              <Skeleton className="h-6 w-32" />
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-8 w-full sm:w-40" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-8 w-full sm:w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[400px] sm:h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white dark:bg-gray-900 border-b border-border dark:border-gray-700 px-4 sm:px-6 py-4 transition-colors duration-300 shadow-sm dark:shadow-gray-900/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground dark:text-gray-100 flex items-center gap-2">📅 Calendar</h1>
              <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1 hidden sm:block">
                Manage your tutoring schedule and upcoming sessions.
              </p>
            </div>
            <Button onClick={handleScheduleSession} size="sm" className="self-start sm:self-auto">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Schedule Session</span>
              <span className="sm:hidden">Schedule</span>
            </Button>
          </div>
        </header>

        <div className="p-4 sm:p-6">
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

  // Full screen layout
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
        {/* Full Screen Calendar Header */}
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">📅 Calendar</h1>
              
              {/* View Toggle in Full Screen */}
              <div className="flex bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden p-1">
                <Button
                  variant={calendarView === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  className={`px-2 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                    calendarView === 'week'
                      ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  onClick={() => setCalendarView('week')}
                >
                  Week
                </Button>
                <Button
                  variant={calendarView === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  className={`px-2 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                    calendarView === 'month'
                      ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  onClick={() => setCalendarView('month')}
                >
                  Month
                </Button>
                <Button
                  variant={calendarView === 'agenda' ? 'default' : 'ghost'}
                  size="sm"
                  className={`px-2 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                    calendarView === 'agenda'
                      ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                  onClick={() => setCalendarView('agenda')}
                >
                  Agenda
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleScheduleSession}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Schedule Session
              </Button>
              
              {/* Exit Full Screen */}
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullScreen}
                className="h-9 w-9 p-0"
                title="Exit Full Screen"
              >
                <Minimize className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Week Navigation in Full Screen */}
          {calendarView === 'week' && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousWeek}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[180px] text-center">
                {getWeekRange()}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextWeek}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                className="ml-2 px-3 h-8 text-xs"
              >
                Today
              </Button>
            </div>
          )}
        </div>

        {/* Full Screen Calendar Content */}
        <div className="flex-1 p-3 sm:p-4 overflow-hidden">
          {calendarView === 'agenda' || (isMobile && calendarView !== 'week' && calendarView !== 'month') ? (
            <div className="h-full">
              <AgendaView
                sessions={filteredSessions}
                onSelectSession={(session: SessionWithStudent) => {
                  const calendarEvent = {
                    id: session.id,
                    title: session.student_name,
                    start: new Date(`${session.date}T${session.time}`),
                    end: new Date(new Date(`${session.date}T${session.time}`).getTime() + session.duration * 60000),
                    resource: session
                  };
                  handleSelectEvent(calendarEvent);
                }}
                tutorCurrency={tutorCurrency}
              />
            </div>
          ) : isMobile ? (
            <MobileCalendarView
              sessions={sessions || []}
              onSelectSlot={(date: Date) => handleSelectSlot({ start: date, end: date })}
              onSelectEvent={(session: SessionWithStudent) => {
                const calendarEvent = {
                  id: session.id,
                  title: session.student_name,
                  start: new Date(`${session.date}T${session.time}`),
                  end: new Date(new Date(`${session.date}T${session.time}`).getTime() + session.duration * 60000),
                  resource: session
                };
                handleSelectEvent(calendarEvent);
              }}
            />
          ) : (
            <div className="calendar-container h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <DndProvider backend={HTML5Backend}>
                <DragAndDropCalendar
                  localizer={localizer}
                  events={events}
                  startAccessor={(event: any) => event.start}
                  endAccessor={(event: any) => event.end}
                  defaultView={calendarView === 'week' ? Views.WEEK : Views.MONTH}
                  view={calendarView === 'week' ? Views.WEEK : Views.MONTH}
                  date={currentDate}
                  onNavigate={(date: Date) => setCurrentDate(date)}
                  onView={(view: any) => setCalendarView(view === Views.WEEK ? 'week' : 'month')}
                  onSelectEvent={(event: any) => handleSelectEvent(event)}
                  onSelectSlot={handleSelectSlot}
                  onEventDrop={(args: any) => handleEventDrop(args)}
                  onEventResize={(args: any) => handleEventResize(args)}
                  selectable
                  resizable
                  draggableAccessor={() => true}
                  views={[Views.WEEK, Views.MONTH]}
                  step={15}
                  timeslots={4}
                  showMultiDayTimes
                  eventPropGetter={(event: any) => eventStyleGetter(event)}
                  toolbar={false}
                  popup={true}
                  style={{ height: '100%' }}
                  components={{
                    toolbar: () => null,
                    event: (props: any) => <EventComponent event={props.event} />,
                  }}
                  formats={{
                    eventTimeRangeFormat: () => '',
                    eventTimeRangeStartFormat: () => '',
                    eventTimeRangeEndFormat: () => '',
                    selectRangeFormat: () => '',
                    dayFormat: 'dddd M/D',
                    timeGutterFormat: 'h:mm A',
                  }}
                />
              </DndProvider>
            </div>
          )}
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

                    <DialogFooter className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setModalView('editSession')}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Session
                      </Button>
                      
                      {selectedSession.recurrence_id && (
                        <Button
                          variant="outline"
                          onClick={() => setModalView('editSeries')}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Series
                        </Button>
                      )}
                      
                      <Button
                        variant="destructive"
                        onClick={handleCancelSession}
                        disabled={deleteSessionMutation.isPending}
                        className="flex-1"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deleteSessionMutation.isPending ? "Canceling..." : "Cancel Session"}
                      </Button>
                      
                      {selectedSession.recurrence_id && (
                        <Button
                          variant="destructive"
                          onClick={handleCancelSeries}
                          disabled={deleteSeriesMutation.isPending}
                          className="flex-1"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deleteSeriesMutation.isPending ? "Canceling..." : "Cancel Series"}
                        </Button>
                      )}
                    </DialogFooter>
                  </>
                ) : modalView === 'editSession' ? (
                  <EditSessionForm />
                ) : (
                  <EditSeriesForm />
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
        

      </div>
    );
  }

  // Normal layout
  return (
    <div className="flex-1 overflow-auto w-full">
      {/* Enhanced Header - Hidden on mobile since we have MobileHeader */}
      <header className="hidden md:block bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-2 sticky top-0 z-10 transition-colors duration-300 shadow-sm dark:shadow-gray-900/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 hover:text-primary dark:hover:text-blue-400 transition-colors duration-200">📅 Calendar</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 hidden sm:block">
              Manage your tutoring schedule and upcoming sessions.
            </p>
          </div>
          <Button 
            onClick={handleScheduleSession}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Schedule Session
          </Button>
        </div>
      </header>

      {/* Calendar Content */}
      <div className="p-3 sm:p-4 w-full">
        <Card className="shadow-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-y-3">
              {/* Title Row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {calendarView === 'week' ? 'Weekly Schedule' : 
                   calendarView === 'month' ? 'Monthly Schedule' : 'Agenda View'}
                </CardTitle>
                
                {/* View Toggle and Full Screen */}
                <div className="flex items-center gap-x-3 self-start sm:self-auto">
                  <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 hidden sm:block" />
                  {/* Mobile: Dropdown for view selection */}
                  <div className="sm:hidden">
                    <Select value={calendarView} onValueChange={(value: 'week' | 'month' | 'agenda') => setCalendarView(value)}>
                      <SelectTrigger className="w-32 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agenda">Agenda</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Desktop: Button group */}
                  <div className="hidden sm:flex bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden p-1">
                    <Button
                      variant={calendarView === 'week' ? 'default' : 'ghost'}
                      size="sm"
                      className={`px-2 sm:px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
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
                      className={`px-2 sm:px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        calendarView === 'month'
                          ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-600/50'
                      }`}
                      onClick={() => setCalendarView('month')}
                    >
                      Month
                    </Button>
                    <Button
                      variant={calendarView === 'agenda' ? 'default' : 'ghost'}
                      size="sm"
                      className={`px-2 sm:px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        calendarView === 'agenda'
                          ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-600/50'
                      }`}
                      onClick={() => setCalendarView('agenda')}
                    >
                      Agenda
                    </Button>
                  </div>
                  
                  {/* Full Screen Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleFullScreen}
                    className="h-9 w-9 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                  >
                    {isFullScreen ? (
                      <Minimize className="h-4 w-4" />
                    ) : (
                      <Maximize className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Combined Filter and Navigation Controls Row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-3 gap-x-4">
                {/* Student Filter - Left side */}
                <div className="flex items-center gap-x-2">
                  <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400 hidden sm:block" />
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
                
                {/* Week Navigation - Right side, only show in week view */}
                {calendarView === 'week' && (
                  <div className="flex items-center gap-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousWeek}
                      className="h-9 w-9 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[160px] sm:min-w-[180px] text-center">
                      {getWeekRange()}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextWeek}
                      className="h-9 w-9 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToday}
                      className="ml-2 px-3 h-9 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Today
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            {calendarView === 'agenda' || (isMobile && calendarView !== 'week' && calendarView !== 'month') ? (
              <AgendaView
                sessions={filteredSessions}
                onSelectSession={(session: SessionWithStudent) => {
                  const calendarEvent = {
                    id: session.id,
                    title: session.student_name,
                    start: new Date(`${session.date}T${session.time}`),
                    end: new Date(new Date(`${session.date}T${session.time}`).getTime() + session.duration * 60000),
                    resource: session
                  };
                  handleSelectEvent(calendarEvent);
                }}
                tutorCurrency={tutorCurrency}
              />
            ) : isMobile ? (
              <MobileCalendarView
                sessions={sessions || []}
                onSelectSlot={(date: Date) => handleSelectSlot({ start: date, end: date })}
                onSelectEvent={(session: SessionWithStudent) => {
                  const calendarEvent = {
                    id: session.id,
                    title: session.student_name,
                    start: new Date(`${session.date}T${session.time}`),
                    end: new Date(new Date(`${session.date}T${session.time}`).getTime() + session.duration * 60000),
                    resource: session
                  };
                  handleSelectEvent(calendarEvent);
                }}
              />
            ) : (
              <div className="calendar-container h-[500px] sm:h-[600px] lg:h-[700px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <DndProvider backend={HTML5Backend}>
                  <DragAndDropCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor={(event: any) => event.start}
                    endAccessor={(event: any) => event.end}
                    defaultView={calendarView === 'week' ? Views.WEEK : Views.MONTH}
                    view={calendarView === 'week' ? Views.WEEK : Views.MONTH}
                    date={currentDate}
                    onNavigate={(date: Date) => setCurrentDate(date)}
                    onView={(view: any) => setCalendarView(view === Views.WEEK ? 'week' : 'month')}
                    onSelectEvent={(event: any) => handleSelectEvent(event)}
                    onSelectSlot={handleSelectSlot}
                    onEventDrop={(args: any) => handleEventDrop(args)}
                    onEventResize={(args: any) => handleEventResize(args)}
                    selectable
                    resizable
                    draggableAccessor={() => true}
                    views={[Views.WEEK, Views.MONTH]}
                    step={15}
                    timeslots={4}
                    showMultiDayTimes
                    eventPropGetter={(event: any) => eventStyleGetter(event)}
                    toolbar={false}
                    popup={true}
                    style={{ height: '100%' }}
                    components={{
                      toolbar: () => null,
                      event: (props: any) => <EventComponent event={props.event} />,
                    }}
                    formats={{
                      eventTimeRangeFormat: () => '',
                      eventTimeRangeStartFormat: () => '',
                      eventTimeRangeEndFormat: () => '',
                      selectRangeFormat: () => '',
                      dayFormat: 'dddd M/D',
                      timeGutterFormat: 'h:mm A',
                    }}
                  />
                </DndProvider>
              </div>
            )}
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

      {/* Session Details Modal */}
      <SessionDetailsModal
        isOpen={showSessionDetailsModal}
        onClose={() => {
          setShowSessionDetailsModal(false);
          setSessionForDetails(null);
          setPreventSlotSelection(true);
          // Reset the flag after a short delay
          setTimeout(() => setPreventSlotSelection(false), 100);
        }}
        session={sessionForDetails}
      />


    </div>
  );
}