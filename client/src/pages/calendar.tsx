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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentTutorId } from '@/lib/tutorHelpers';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { 
  CalendarIcon, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Filter,
  Maximize2,
  Minimize2,
  Clock,
  User,
  Check,
  X
} from 'lucide-react';
import { shouldUseOptimizedQuery, getOptimizedSessions, getStandardSessions } from '@/lib/queryOptimizer';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);
import MobileCalendarView from '@/components/MobileCalendarView';
import { SessionDetailsModal } from '@/components/modals/session-details-modal';
import { ScheduleSessionModal } from '@/components/modals/schedule-session-modal';
import { EditSessionModal } from '@/components/modals/edit-session-modal';
import { useIsMobile } from "@/hooks/use-mobile";
import { usePendingSessions } from "@/hooks/use-pending-sessions";
import { PendingRequestsModal } from "@/components/modals/pending-requests-modal";
import { formatUtcToTutorTimezone } from "@/lib/dateUtils";
import { useTimezone } from "@/contexts/TimezoneContext";
import { getSessionDisplayInfo } from "@/lib/sessionDisplay"; // Utility to format session display information
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

export default function Calendar() {
  const [view, setView] = useState<string>('timeGridWeek');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [sessionForDetails, setSessionForDetails] = useState<SessionWithStudent | null>(null);
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false);
  const [showPendingRequestsModal, setShowPendingRequestsModal] = useState(false);
  const [calendarView, setCalendarView] = useState<'week' | 'month' | 'agenda'>('week');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editSession, setEditSession] = useState<SessionWithStudent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditingRecurring, setIsEditingRecurring] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);
  
  const isMobile = useIsMobile();
  const { tutorTimezone } = useTimezone();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Add event listeners for session edit actions
  useEffect(() => {
    const handleEditSession = (event: CustomEvent) => {
      const session = event.detail.session;
      console.log('📝 Edit session event received:', session);
      
      // Close session details modal
      setShowSessionDetailsModal(false);
      setSessionForDetails(null);
      
      // Set edit session data and open edit modal
      setEditSession(session);
      setIsEditingRecurring(false);
      setShowEditModal(true);
    };

    const handleEditSeries = (event: CustomEvent) => {
      const session = event.detail.session;
      console.log('📝 Edit series event received:', session);
      
      // Close session details modal
      setShowSessionDetailsModal(false);
      setSessionForDetails(null);
      
      // Set edit session data and open edit modal for recurring
      setEditSession(session);
      setIsEditingRecurring(true);
      setShowEditModal(true);
    };

    window.addEventListener('editSession', handleEditSession as EventListener);
    window.addEventListener('editSeries', handleEditSeries as EventListener);

    return () => {
      window.removeEventListener('editSession', handleEditSession as EventListener);
      window.removeEventListener('editSeries', handleEditSeries as EventListener);
    };
  }, []);

  // Get pending sessions count for the button
  const { data: pendingCount = 0 } = usePendingSessions();

  // Get tutor currency
  const { data: tutorData } = useQuery({
    queryKey: ['tutor-profile'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) throw new Error('No tutor found');
      
      const { data, error } = await supabase
        .from('tutors')
        .select('currency')
        .eq('id', tutorId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const tutorCurrency = tutorData?.currency || 'USD';

  // Fetch sessions data with optimization
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['calendar-sessions'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) return [];

      console.log('🔍 Fetching calendar sessions for tutor:', tutorId);
      
      if (shouldUseOptimizedQuery()) {
        const results = await getOptimizedSessions(tutorId);
        console.log('📊 Optimized query returned:', results.length, 'sessions');
        return results;
      } else {
        const results = await getStandardSessions(tutorId);
        console.log('📊 Standard query returned:', results.length, 'sessions');
        return results;
      }
    },
    refetchInterval: 30000,
    staleTime: 500, // Very fresh data for pending requests
  });

  // Get unique students for filter
  const uniqueStudents = useMemo(() => {
    const students = sessions
      .filter(session => session.student_name)
      .reduce((acc: Array<{id: string, name: string}>, session) => {
        if (!acc.find(s => s.id === session.student_id)) {
          acc.push({
            id: session.student_id,
            name: session.student_name
          });
        }
        return acc;
      }, []);
    
    return students.sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  // Filter sessions based on selected student (include unassigned sessions)
  const filteredSessions = useMemo(() => {
    if (selectedStudent === 'all') return sessions;
    return sessions.filter(session => {
      // Include sessions assigned to selected student
      if (session.student_id === selectedStudent) return true;
      // Also include unassigned sessions when 'all' is selected
      if (selectedStudent === 'all' && !session.student_id) return true;
      return false;
    });
  }, [sessions, selectedStudent]);

  // Convert sessions to FullCalendar events
  const events: FullCalendarEvent[] = useMemo(() => {
    console.log('🔄 Converting sessions to FullCalendar events');
    console.log('🌍 Current tutorTimezone value:', tutorTimezone);
    console.log('📊 Total filtered sessions:', filteredSessions.length);
    console.log('📊 Sessions data:', filteredSessions.map(s => ({
      id: s.id?.substring(0, 8) + '...',
      student_name: s.student_name,
      unassigned_name: s.unassigned_name,
      status: s.status,
      session_start: s.session_start,
      session_end: s.session_end,
      has_timestamps: !!(s.session_start && s.session_end)
    })));
    
    // Debug: Specifically check for booking requests
    const bookingRequestsInFiltered = filteredSessions.filter(s => 
      s.unassigned_name && s.unassigned_name.includes('Booking request from')
    );
    console.log('📋 Booking requests in filtered sessions:', bookingRequestsInFiltered.length);
    bookingRequestsInFiltered.forEach(s => {
      console.log('📋 Booking request details:', {
        id: s.id?.substring(0, 8) + '...',
        unassigned_name: s.unassigned_name,
        status: s.status,
        session_start: s.session_start,
        session_end: s.session_end,
        student_id: s.student_id,
        has_valid_timestamps: !!(s.session_start && s.session_end)
      });
    });
    
    const validEvents = [];
    const skippedSessions = [];
    
    filteredSessions.forEach(session => {
      // Only process sessions with UTC timestamps - remove fallback logic
      if (!session.session_start || !session.session_end) {
        console.warn('⚠️ Session missing UTC timestamps, skipping:', {
          id: session.id?.substring(0, 8) + '...',
          session_start: session.session_start,
          session_end: session.session_end,
          status: session.status,
          student_name: session.student_name,
          unassigned_name: session.unassigned_name,
          legacy_date: session.date,
          legacy_time: session.time
        });
        
        skippedSessions.push(session);
        return;
      }

      // Convert UTC timestamps to tutor timezone for FullCalendar display
      const tutorTz = tutorTimezone || 'UTC';
      const startISO = dayjs.utc(session.session_start).tz(tutorTz).toISOString();
      const endISO = dayjs.utc(session.session_end).tz(tutorTz).toISOString();
      
      // Debug timezone conversion for this specific session
      if (session.student_name === 'David' || session.unassigned_name?.includes('David')) {
        console.log('🎯 DAVID SESSION CONVERSION:', {
          id: session.id?.substring(0, 8) + '...',
          student_name: session.student_name,
          unassigned_name: session.unassigned_name,
          original_utc_start: session.session_start,
          original_utc_end: session.session_end,
          tutor_timezone: tutorTz,
          converted_start_iso: startISO,
          converted_end_iso: endISO,
          display_time_in_tz: dayjs.utc(session.session_start).tz(tutorTz).format('HH:mm'),
          status: session.status,
          student_id: session.student_id
        });
      }

      // Determine display name and styling
      let title = session.student_name || session.unassigned_name || 'Unknown Student';
      let backgroundColor = '#3b82f6'; // Default blue
      let textColor = '#ffffff';
      
      if (session.status === 'pending') {
        backgroundColor = '#f59e0b'; // Amber for pending requests
        title = `⏳ ${session.unassigned_name || 'Pending Request'}`;
      } else if (session.status === 'confirmed' && !session.student_id) {
        backgroundColor = '#10b981'; // Green for unassigned confirmed sessions
        title = `📝 ${session.unassigned_name || 'Unassigned Session'}`;
      } else if (!session.paid) {
        backgroundColor = '#ef4444'; // Red for unpaid
        title = `💰 ${title}`;
      } else if (session.color) {
        backgroundColor = session.color;
      }

      // Check if session has ended (for fading past sessions)
      const now = dayjs.utc();
      const sessionEnd = dayjs.utc(session.session_end);
      const isPastSession = sessionEnd.isBefore(now);

      const event = {
        id: session.id,
        title,
        start: startISO,
        end: endISO,
        backgroundColor,
        borderColor: backgroundColor,
        textColor,
        extendedProps: { 
          ...session, 
          isPastSession // Flag for styling past sessions
        }
      };
      
      validEvents.push(event);
      
      console.log('✅ Created calendar event:', {
        id: session.id?.substring(0, 8) + '...',
        title,
        start: startISO,
        student_name: session.student_name,
        status: session.status
      });
    });
    
    console.log('📊 Calendar event summary:', {
      totalFiltered: filteredSessions.length,
      validEvents: validEvents.length,
      skippedSessions: skippedSessions.length,
      skippedReasons: skippedSessions.map(s => ({
        id: s.id?.substring(0, 8) + '...',
        reason: !s.session_start ? 'missing session_start' : !s.session_end ? 'missing session_end' : 'unknown'
      }))
    });
    
    return validEvents;
  }, [filteredSessions, tutorTimezone]);

  // Handle schedule session
  const handleScheduleSession = () => {
    console.log('✅ Bug 1 fixed - Opening single schedule modal');
    setEditSession(null); // Clear any existing edit session
    setShowScheduleModal(true);
  };

  // Custom event content renderer
  const renderEventContent = (eventInfo: any) => {
    const session = eventInfo.event.extendedProps;
    const durationMinutes = session.duration || 60;
    const earning = (durationMinutes / 60) * session.rate;

    const { displayTime } = getSessionDisplayInfo(session, tutorTimezone || undefined);
    const tooltipContent = `${session.student_name || 'Unassigned'}\n${displayTime}\n${durationMinutes} minutes\n${formatCurrency(earning, tutorCurrency)}`;

    // Apply faded styling for past sessions
    const fadeClass = session.isPastSession ? 'opacity-50 grayscale' : '';

    return (
      <div className={`p-1 text-xs ${fadeClass}`} title={tooltipContent}>
        <div className="font-medium truncate">{eventInfo.event.title}</div>
        <div className="text-xs opacity-90">
          {durationMinutes}min • {formatCurrency(earning, tutorCurrency)}
        </div>
      </div>
    );
  };

  // Handle event click to show session details modal
  const handleEventClick = (clickInfo: any) => {
    const session = clickInfo.event.extendedProps as SessionWithStudent;
    
    if (session.status === 'pending' && session.student_id === null) {
      setSessionForDetails(session);
      setShowPendingRequestsModal(true);
    } else {
      setSessionForDetails(session);
      setShowSessionDetailsModal(true);
    }
  };

  // Handle slot selection to schedule new session
  const handleDateSelect = (selectInfo: any) => {
    // FullCalendar selection is already in the display timezone
    const startInTutorTz = dayjs(selectInfo.start).tz(tutorTimezone || 'UTC');
    const endInTutorTz = dayjs(selectInfo.end).tz(tutorTimezone || 'UTC');
    
    const selectedDate = startInTutorTz.format('YYYY-MM-DD');
    const selectedTime = startInTutorTz.format('HH:mm');
    const duration = endInTutorTz.diff(startInTutorTz, 'minutes');
    
    console.log('🎯 Slot selected for new session:', {
      selected_start_js: selectInfo.start,
      selected_end_js: selectInfo.end,
      tutor_timezone: tutorTimezone || 'UTC',
      form_date: selectedDate,
      form_time: selectedTime,
      duration: duration
    });

    // Open schedule modal directly with form data
    setEditSession(null); // Clear any existing edit session
    setShowScheduleModal(true);
    
    // Dispatch event for form prefill
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openScheduleModal', {
        detail: {
          date: selectedDate,
          time: selectedTime,
          duration: Math.max(30, duration)
        }
      }));
    }, 100);
  };

  // Handle event drop (drag and drop)
  const handleEventDrop = async (dropInfo: any) => {
    const session = dropInfo.event.extendedProps as SessionWithStudent;
    
    // Convert FullCalendar's JS Date to UTC for storage
    const newStartUTC = dayjs(dropInfo.event.start).utc().toISOString();
    const newEndUTC = dayjs(dropInfo.event.end).utc().toISOString();
    // For legacy fields, convert to tutor timezone
    const newStartInTutorTz = dayjs(dropInfo.event.start).tz(tutorTimezone || 'UTC');
    
    console.log('🔄 Drag & Drop - Converting times:', {
      session_id: session.id,
      js_start: dropInfo.event.start,
      js_end: dropInfo.event.end,
      converted_start_utc: newStartUTC,
      converted_end_utc: newEndUTC,
      legacy_date: newStartInTutorTz.format('YYYY-MM-DD'),
      legacy_time: newStartInTutorTz.format('HH:mm')
    });

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          session_start: newStartUTC,
          session_end: newEndUTC,
          date: newStartInTutorTz.format('YYYY-MM-DD'),
          time: newStartInTutorTz.format('HH:mm')
        })
        .eq('id', session.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      toast({
        title: "Session Updated",
        description: "Session has been moved successfully."
      });
    } catch (error: any) {
      dropInfo.revert();
      toast({
        variant: "destructive",
        title: "Failed to Update Session",
        description: error.message
      });
    }
  };

  // Helper function to calculate duration in minutes from start and end times
  const calculateDurationMinutes = (startTime: Date, endTime: Date): number => {
    return dayjs(endTime).diff(dayjs(startTime), 'minutes');
  };

  // Handle event resize (drag-to-resize duration)
  const handleEventResize = async (resizeInfo: any) => {
    const session = resizeInfo.event.extendedProps as SessionWithStudent;
    
    // Prevent resizing past sessions
    if (session.isPastSession) {
      resizeInfo.revert();
      toast({
        variant: "destructive",
        title: "Cannot Resize Past Session",
        description: "Past sessions cannot be resized."
      });
      return;
    }
    
    // Convert new end time to UTC for storage
    const newEndUTC = dayjs(resizeInfo.event.end).utc().toISOString();
    const newDuration = calculateDurationMinutes(resizeInfo.event.start, resizeInfo.event.end);
    
    console.log('🔧 Resizing session duration:', {
      session_id: session.id,
      old_duration: session.duration,
      new_duration: newDuration,
      new_end_utc: newEndUTC
    });

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          session_end: newEndUTC,
          duration: newDuration
        })
        .eq('id', session.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      toast({
        title: "Session Duration Updated",
        description: `Duration changed to ${newDuration} minutes.`
      });
    } catch (error: any) {
      resizeInfo.revert();
      toast({
        variant: "destructive",
        title: "Failed to Update Duration",
        description: error.message
      });
    }
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

  // Toggle full screen
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading calendar...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileCalendarView
        sessions={filteredSessions}
        onSelectSession={(session) => {
          setSessionForDetails(session);
          setShowSessionDetailsModal(true);
        }}
        tutorCurrency={tutorCurrency}
      />
    );
  }

  return (
    <div className={`flex-1 overflow-auto transition-all duration-300 ${
      isFullScreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900' : ''
    }`}>
      <div className="p-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="h-6 w-6" />
              Calendar
            </h1>
            
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <Button
                variant={calendarView === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('week')}
                className="text-xs"
              >
                Week
              </Button>
              <Button
                variant={calendarView === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('month')}
                className="text-xs"
              >
                Month
              </Button>
              <Button
                variant={calendarView === 'agenda' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('agenda')}
                className="text-xs"
              >
                Agenda
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Student Filter */}
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by student" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {uniqueStudents.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Pending Requests Button */}
            {pendingCount > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowPendingRequestsModal(true)}
                className="relative"
              >
                <Clock className="h-4 w-4 mr-2" />
                Pending ({pendingCount})
                <Badge className="ml-2 bg-orange-500">{pendingCount}</Badge>
              </Button>
            )}

            {/* Schedule Session Button */}
            <Button onClick={handleScheduleSession}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Session
            </Button>

            {/* Full Screen Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullScreen}
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 calendar-container bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, luxonPlugin]}
            initialView={view}
            timeZone="UTC"
            events={events}
            eventDidMount={(info) => {
              const session = info.event.extendedProps;
              
              // Apply faded styling to past sessions
              if (session.isPastSession) {
                info.el.style.opacity = '0.5';
                info.el.style.filter = 'grayscale(50%)';
              }
              
              // Disable resizing for past sessions
              if (session.isPastSession) {
                info.el.style.cursor = 'default';
              }
            }}
            editable={true}
            eventDurationEditable={true} // Enable vertical resizing
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            eventClick={handleEventClick}
            select={handleDateSelect}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
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
              meridiem: 'short'
            }}
          />
        </div>
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

      {/* Schedule Session Modal */}
      <ScheduleSessionModal
        open={showScheduleModal}
        onOpenChange={(open) => {
          setShowScheduleModal(open);
          if (!open) {
            setEditSession(null);
          }
        }}
        editSession={null}
        editMode={false}
      />

      {/* Edit Session Modal */}
      <EditSessionModal
        open={showEditModal}
        onOpenChange={(open) => {
          setShowEditModal(open);
          if (!open) {
            setEditSession(null);
            setIsEditingRecurring(false);
          }
        }}
        session={editSession}
        isRecurring={isEditingRecurring}
      />

      {/* Pending Requests Modal */}
      <PendingRequestsModal
        open={showPendingRequestsModal}
        onOpenChange={setShowPendingRequestsModal}
        highlightSessionId={sessionForDetails?.id}
      />
    </div>
  );
}