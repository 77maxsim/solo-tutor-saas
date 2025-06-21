import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import luxonPlugin from '@fullcalendar/luxon3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentTutorId } from '@/lib/tutorHelpers';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  CalendarIcon, 
  Plus, 
  Settings, 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft, 
  ArrowRight,
  Calendar as CalendarIconLucide,
  Filter,
  Maximize2,
  Minimize2,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Repeat,
  Calendar as CalIcon,
  Eye,
  EyeOff,
  Palette,
  BookOpen,
  DollarSign,
  MapPin,
  Home,
  School,
  VideoIcon,
  Coffee,
  Zap,
  Target,
  CheckCircle,
  XCircle,
  Skeleton,
  Info
} from 'lucide-react';
import { getOptimizedSessions, getStandardSessions, shouldUseOptimizedQuery } from '@/lib/calendarOptimization';
import MobileCalendarView from '@/components/MobileCalendarView';
import { SessionDetailsModal } from '@/components/modals/session-details-modal';
import { PendingSessionModal } from '@/components/modals/pending-session-modal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, User, Check, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePendingSessions } from "@/hooks/use-pending-sessions";
import { PendingRequestsModal } from "@/components/modals/pending-requests-modal";
import { formatUtcToTutorTimezone, calculateDurationMinutes } from "@/lib/dateUtils";
import { useTimezone } from "@/contexts/TimezoneContext";
import { DateTime } from "luxon";

interface SessionWithStudent {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  tuition_fee: number;
  notes: string;
  paid: boolean;
  created_at: string;
  avatarUrl?: string;
  color?: string;
  recurrence_id?: string;
  session_start?: string;
  session_end?: string;
  status?: string;
  unassigned_name?: string;
}

interface FullCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: SessionWithStudent;
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
    // Extract date from session_start timestamp
    const dateKey = new Date(session.session_start).toISOString().split('T')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(session);
  });

  // Sort sessions within each day by session_start time
  Object.keys(grouped).forEach(date => {
    grouped[date].sort((a, b) => new Date(a.session_start).getTime() - new Date(b.session_start).getTime());
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

const editSeriesSchema = z.object({
  studentId: z.string().optional(),
  time: z.string().min(1, "Time is required"),
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  rate: z.number().min(0, "Rate must be 0 or positive"),
  color: z.string().optional(),
});

export default function Calendar() {
  const [view, setView] = useState<string>('timeGridWeek');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<SessionWithStudent | null>(null);
  const [sessionForDetails, setSessionForDetails] = useState<SessionWithStudent | null>(null);
  const [selectedPendingSession, setSelectedPendingSession] = useState<SessionWithStudent | null>(null);
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showPendingRequestsModal, setShowPendingRequestsModal] = useState(false);
  const [modalView, setModalView] = useState<'details' | 'editSession' | 'editSeries'>('details');
  const [preventSlotSelection, setPreventSlotSelection] = useState(false);
  const [calendarView, setCalendarView] = useState<'week' | 'month' | 'agenda'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const calendarRef = useRef<FullCalendar>(null);
  
  const isMobile = useIsMobile();
  const { pendingSessions } = usePendingSessions();
  const { tutorTimezone } = useTimezone();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tutor's currency preference
  const { data: tutorCurrency = 'USD' } = useQuery({
    queryKey: ['tutor-currency'],
    queryFn: async () => {
      try {
        const tutorId = await getCurrentTutorId();
        if (!tutorId) {
          throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
          .from('tutors')
          .select('currency')
          .eq('id', tutorId)
          .single();

        if (error) {
          console.error('Error fetching tutor currency:', error);
          return 'USD';
        }

        return data?.currency || 'USD';
      } catch (error) {
        console.error('Error in tutorCurrency query:', error);
        return 'USD';
      }
    },
  });

  // Fetch sessions data
  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['calendar-sessions'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const useOptimized = await shouldUseOptimizedQuery(tutorId);
      
      let allSessions;
      if (useOptimized) {
        allSessions = await getOptimizedSessions(tutorId);
      } else {
        allSessions = await getStandardSessions(tutorId);
      }

      const processedSessions = allSessions.map(session => ({
        ...session,
        status: session.status || 'confirmed'
      }));

      return processedSessions;
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
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
            console.log('Real-time session update:', payload);
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

  // Get unique students from sessions for filter dropdown
  const uniqueStudents = sessions ? 
    Array.from(new Set(sessions.map(session => session.student_name))).sort() : [];

  // Filter sessions based on selected student
  const filteredSessions = sessions ? 
    selectedStudent === 'all' 
      ? sessions 
      : sessions.filter(session => session.student_name === selectedStudent)
    : [];

  // Convert sessions to FullCalendar events
  const events: FullCalendarEvent[] = filteredSessions.map(session => {
    let start: string, end: string;

    if (session.session_start && session.session_end) {
      // Use UTC timestamps directly - FullCalendar will handle timezone conversion
      start = session.session_start;
      end = session.session_end;
    } else {
      // Fallback to legacy date/time fields - convert to UTC
      const sessionDate = new Date(session.date || new Date());
      const [hours, minutes] = (session.time || '12:00').split(':').map(Number);
      
      if (tutorTimezone) {
        // Create DateTime in tutor's timezone, then convert to UTC
        const startInTutorTz = DateTime.fromObject({
          year: sessionDate.getFullYear(),
          month: sessionDate.getMonth() + 1,
          day: sessionDate.getDate(),
          hour: hours,
          minute: minutes
        }, { zone: tutorTimezone });
        
        const endInTutorTz = startInTutorTz.plus({ minutes: session.duration || 60 });
        
        start = startInTutorTz.toUTC().toISO();
        end = endInTutorTz.toUTC().toISO();
      } else {
        // Fallback when timezone not loaded
        const startDate = new Date(sessionDate);
        startDate.setHours(hours, minutes, 0, 0);
        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + (session.duration || 60));
        
        start = startDate.toISOString();
        end = endDate.toISOString();
      }
    }

    const isPending = session.status === 'pending';
    
    // Determine display name
    let displayName;
    if (isPending) {
      displayName = session.unassigned_name || 'Pending Request';
    } else {
      displayName = session.student_name;
    }

    // Calculate duration for display
    const durationMinutes = session.session_end 
      ? calculateDurationMinutes(session.session_start, session.session_end)
      : session.duration || 60;
    
    // Create event title with duration and earning
    const earning = (session.rate || 0) * durationMinutes / 60;
    const eventTitle = `${displayName}`;

    // Determine event colors
    let backgroundColor = session.color || '#3B82F6';
    let borderColor = backgroundColor;
    let textColor = 'white';

    if (isPending) {
      backgroundColor = '#F59E0B';
      borderColor = '#D97706';
    } else if (!session.paid) {
      backgroundColor = '#EF4444';
      borderColor = '#DC2626';
    }

    return {
      id: session.id,
      title: eventTitle,
      start,
      end,
      backgroundColor,
      borderColor,
      textColor,
      extendedProps: {
        ...session,
        isPending,
        student_name: displayName,
        duration: durationMinutes,
        earning: earning
      }
    };
  });

  // Handle schedule session
  const handleScheduleSession = () => {
    window.dispatchEvent(new CustomEvent('openScheduleModal'));
  };

  // Handle event click to show session details modal
  const handleEventClick = (clickInfo: any) => {
    const session = clickInfo.event.extendedProps as SessionWithStudent;
    
    // Check if this is a pending session without assigned student
    if (session.status === 'pending' && session.student_id === null) {
      setSessionForDetails(session);
      setShowPendingRequestsModal(true);
    } else if (session.isPending || session.status === 'pending') {
      setSelectedPendingSession(session);
    } else {
      setSessionForDetails(session);
      setShowSessionDetailsModal(true);
    }
  };

  // Handle slot selection to schedule new session
  const handleDateSelect = (selectInfo: any) => {
    // Convert to tutor timezone for form data
    let selectedDate: string;
    let selectedTime: string;
    let duration: number;

    if (tutorTimezone) {
      const startInTutorTz = DateTime.fromJSDate(selectInfo.start).setZone(tutorTimezone);
      const endInTutorTz = DateTime.fromJSDate(selectInfo.end).setZone(tutorTimezone);
      
      selectedDate = startInTutorTz.toISODate();
      selectedTime = startInTutorTz.toFormat('HH:mm');
      duration = Math.round(endInTutorTz.diff(startInTutorTz, 'minutes').minutes);
    } else {
      selectedDate = selectInfo.start.toISOString().split('T')[0];
      const hours = selectInfo.start.getHours().toString().padStart(2, '0');
      const minutes = selectInfo.start.getMinutes().toString().padStart(2, '0');
      selectedTime = `${hours}:${minutes}`;
      duration = Math.round((selectInfo.end.getTime() - selectInfo.start.getTime()) / (1000 * 60));
    }

    // Create a custom event to open the schedule modal with pre-filled data
    window.dispatchEvent(new CustomEvent('openScheduleModal', {
      detail: {
        date: selectedDate,
        time: selectedTime,
        duration: Math.max(30, duration)
      }
    }));
  };

  // View toggle handlers
  const handleViewChange = (newView: 'week' | 'month' | 'agenda') => {
    setCalendarView(newView);
    if (calendarRef.current) {
      let fullCalendarView = '';
      switch (newView) {
        case 'week':
          fullCalendarView = 'timeGridWeek';
          break;
        case 'month':
          fullCalendarView = 'dayGridMonth';
          break;
        case 'agenda':
          fullCalendarView = 'listWeek';
          break;
      }
      setView(fullCalendarView);
      calendarRef.current.getApi().changeView(fullCalendarView);
    }
  };

  // Toggle full screen
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().prev();
    }
  };

  const handleNext = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().next();
    }
  };

  const handleToday = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().today();
    }
  };

  // Custom event content renderer
  const renderEventContent = (eventInfo: any) => {
    const session = eventInfo.event.extendedProps;
    const durationMinutes = session.duration || 60;
    const earning = session.earning || 0;

    return (
      <div className="p-1 text-xs">
        <div className="font-medium truncate">{eventInfo.event.title}</div>
        <div className="text-xs opacity-90">
          {durationMinutes}min • {formatCurrency(earning, tutorCurrency)}
        </div>
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
                <Skeleton className="h-8 w-full sm:w-40" />
                <Skeleton className="h-8 w-full sm:w-24" />
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
            <CardContent className="flex flex-col items-center justify-center py-12">
              <XCircle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Error loading calendar</h3>
              <p className="text-gray-500 dark:text-gray-400 text-center mb-4">
                We couldn't load your calendar data. Please try refreshing the page.
              </p>
              <Button onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show mobile view for mobile devices
  if (isMobile) {
    return (
      <MobileCalendarView 
        sessions={filteredSessions}
        onSelectSlot={(date) => {
          const sessionData = {
            date: date.toISOString().split('T')[0],
            time: "09:00",
            duration: 60,
          };
          window.dispatchEvent(new CustomEvent('openScheduleModal', {
            detail: sessionData
          }));
        }}
        onSelectEvent={(session) => {
          setSessionForDetails(session);
          setShowSessionDetailsModal(true);
        }}
      />
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
                  onClick={() => handleViewChange('week')}
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
                  onClick={() => handleViewChange('month')}
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
                  onClick={() => handleViewChange('agenda')}
                >
                  Agenda
                </Button>
              </div>
            </div>

            {/* Navigation and Controls */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={toggleFullScreen}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Full Screen Calendar Content */}
        <div className="flex-1 p-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, luxonPlugin]}
            initialView={view}
            timeZone={tutorTimezone || 'UTC'}
            events={events}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            eventClick={handleEventClick}
            select={handleDateSelect}
            eventContent={renderEventContent}
            height="100%"
            headerToolbar={false}
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
            slotDuration="00:15:00"
            snapDuration="00:15:00"
            allDaySlot={false}
            nowIndicator={true}
            eventDisplay="block"
            dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric' }}
            slotLabelFormat={{
              hour: 'numeric',
              minute: '2-digit',
              omitZeroMinute: false,
              meridiem: false
            }}
          />
        </div>
      </div>
    );
  }

  // Regular layout
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
                  
                  {/* Desktop: Button group for view selection */}
                  <div className="hidden sm:flex bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden p-1">
                    <Button
                      variant={calendarView === 'week' ? 'default' : 'ghost'}
                      size="sm"
                      className={`px-2 sm:px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        calendarView === 'week'
                          ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-600/50'
                      }`}
                      onClick={() => handleViewChange('week')}
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
                      onClick={() => handleViewChange('month')}
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
                      onClick={() => handleViewChange('agenda')}
                    >
                      Agenda
                    </Button>
                  </div>
                  
                  {/* Mobile: Dropdown for view selection */}
                  <div className="sm:hidden">
                    <Select value={calendarView} onValueChange={(value: 'week' | 'month' | 'agenda') => handleViewChange(value)}>
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
                  
                  {/* Full Screen Toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleFullScreen}
                    className="h-9 w-9 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Controls Row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Navigation Controls */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleToday}>
                    Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger className="w-full sm:w-40 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder="Filter by student" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students</SelectItem>
                      {uniqueStudents.map((studentName) => (
                        <SelectItem key={studentName} value={studentName}>
                          {studentName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-2 sm:p-6">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, luxonPlugin]}
              initialView={view}
              timeZone={tutorTimezone || 'UTC'}
              events={events}
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              eventClick={handleEventClick}
              select={handleDateSelect}
              eventContent={renderEventContent}
              height={600}
              headerToolbar={false}
              slotMinTime="06:00:00"
              slotMaxTime="23:00:00"
              slotDuration="00:15:00"
              snapDuration="00:15:00"
              allDaySlot={false}
              nowIndicator={true}
              eventDisplay="block"
              dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric' }}
              slotLabelFormat={{
                hour: 'numeric',
                minute: '2-digit',
                omitZeroMinute: false,
                meridiem: false
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Session Details Modal */}
      {sessionForDetails && (
        <SessionDetailsModal
          session={sessionForDetails}
          isOpen={showSessionDetailsModal}
          onClose={() => setShowSessionDetailsModal(false)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
          }}
          onDelete={() => {
            queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
          }}
        />
      )}

      {/* Pending Session Modal */}
      {selectedPendingSession && (
        <PendingSessionModal
          session={selectedPendingSession}
          isOpen={!!selectedPendingSession}
          onClose={() => setSelectedPendingSession(null)}
          onAccept={() => {
            queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
            setSelectedPendingSession(null);
          }}
          onDecline={() => {
            queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
            setSelectedPendingSession(null);
          }}
        />
      )}

      {/* Pending Requests Modal */}
      <PendingRequestsModal
        isOpen={showPendingRequestsModal}
        onClose={() => setShowPendingRequestsModal(false)}
        highlightSessionId={sessionForDetails?.id}
      />
    </div>
  );
}