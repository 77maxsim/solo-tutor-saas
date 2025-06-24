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
import { convertSessionToCalendarEvent, debugSessionConversion } from '@/lib/sessionUtils';
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
  session_start: string;
  session_end: string;
  duration: number;
  rate: number;
  tuition_fee: number;
  notes: string;
  paid: boolean;
  created_at: string;
  avatarUrl?: string;
  color?: string;
  recurrence_id?: string;
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

  // Get tutor preferences including currency and time format
  const { data: tutorData } = useQuery({
    queryKey: ['tutor-profile'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) throw new Error('No tutor found');
      
      const { data, error } = await supabase
        .from('tutors')
        .select('currency, time_format')
        .eq('id', tutorId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const tutorCurrency = tutorData?.currency || 'USD';
  const timeFormat = tutorData?.time_format || '24h';

  // Fetch sessions data with optimization
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['calendar-sessions'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) return [];

      console.log('🔍 Fetching calendar sessions for tutor:', tutorId);
      
      const useOptimized = await shouldUseOptimizedQuery(tutorId);
      if (useOptimized) {
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
    staleTime: 0, // Always fresh data for newly accepted requests
  });

  // Get unique students for filter
  const uniqueStudents = useMemo(() => {
    const students = sessions
      .filter(session => session.student_name && session.student_id)
      .reduce((acc: Array<{id: string, name: string}>, session) => {
        if (!acc.find(s => s.id === session.student_id)) {
          acc.push({
            id: session.student_id,
            name: session.student_name
          });
        }
        return acc;
      }, []);
    
    console.log('📊 Unique students found:', students.length, students.map(s => s.name));
    return students.sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  // Filter sessions based on selected student (include unassigned sessions)
  const filteredSessions = useMemo(() => {
    console.log('🔍 Filtering sessions - selected student:', selectedStudent);
    console.log('🔍 Raw sessions count:', sessions.length);
    
    // Check for June 23rd sessions specifically
    const june23Sessions = sessions.filter(s => 
      s.session_start && s.session_start.includes('2025-06-23')
    );
    if (june23Sessions.length > 0) {
      console.log('🔍 June 23rd sessions found:', june23Sessions.length);
      june23Sessions.forEach(s => {
        console.log('June 23 session:', {
          id: s.id?.substring(0, 8) + '...',
          student_name: s.student_name,
          student_id: s.student_id,
          status: s.status,
          session_start: s.session_start,
          session_end: s.session_end,
          has_timestamps: !!(s.session_start && s.session_end)
        });
      });
    }
    
    if (selectedStudent === 'all') {
      console.log('🔍 Returning all sessions');
      return sessions;
    }
    
    const filtered = sessions.filter(session => {
      // Include sessions assigned to selected student
      if (session.student_id === selectedStudent) return true;
      // Also include unassigned sessions when 'all' is selected
      if (selectedStudent === 'all' && !session.student_id) return true;
      return false;
    });
    
    console.log('🔍 Filtered sessions count:', filtered.length);
    return filtered;
  }, [sessions, selectedStudent]);

  // Convert sessions to FullCalendar events
  const events: FullCalendarEvent[] = useMemo(() => {
    console.log('🔄 Converting sessions to FullCalendar events');
    console.log('🌍 Current tutorTimezone value:', tutorTimezone);
    console.log('📊 Total raw sessions:', sessions.length);
    console.log('📊 Total filtered sessions:', filteredSessions.length);
    console.log('📊 Selected student filter:', selectedStudent);
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
    const tutorTz = tutorTimezone || 'UTC';
    
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
          legacy_date: session.session_start ? new Date(session.session_start).toISOString().split('T')[0] : 'N/A',
          legacy_time: 'DEPRECATED'
        });
        
        skippedSessions.push(session);
        return;
      }

      // CRITICAL: Pass UTC timestamps directly to FullCalendar
      // FullCalendar will handle timezone conversion using its timeZone prop
      const startDate = new Date(session.session_start);
      const endDate = new Date(session.session_end);
      
      // Debug timezone handling for verification
      console.debug('🕐 FullCalendar timezone setup:', {
        id: session.id?.substring(0, 8) + '...',
        student_name: session.student_name,
        utc_stored: session.session_start,
        tutor_timezone: tutorTz,
        fullcalendar_will_convert_to: dayjs.utc(session.session_start).tz(tutorTz).format(`YYYY-MM-DD HH:mm [${tutorTz}]`),
        raw_date_object: startDate.toISOString()
      });

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
        start: startDate,
        end: endDate,
        backgroundColor,
        borderColor: backgroundColor,
        textColor,
        extendedProps: { 
          ...session, 
          isPastSession // Flag for styling past sessions
        }
      };
      
      validEvents.push(event);
      
      // Log event creation for verification
      console.debug('✅ Calendar event created:', {
        id: session.id?.substring(0, 8) + '...',
        title,
        student_name: session.student_name,
        original_utc: session.session_start,
        display_time: startDate.toLocaleString('en-US', { timeZone: tutorTz })
      });
    });
    
    console.log('📊 Calendar event summary:', {
      totalFiltered: filteredSessions.length,
      validEvents: validEvents.length,
      skippedSessions: skippedSessions.length,
      june23Events: validEvents.filter(e => e.start.toISOString().includes('2025-06-23')).length,
      june23EventTimes: validEvents
        .filter(e => e.start.toISOString().includes('2025-06-23'))
        .map(e => ({
          title: e.title,
          start: e.start.toLocaleString('en-US', { timeZone: tutorTz })
        })),
      skippedReasons: skippedSessions.map(s => ({
        id: s.id?.substring(0, 8) + '...',
        reason: !s.session_start ? 'missing session_start' : !s.session_end ? 'missing session_end' : 'unknown'
      }))
    });
    
    // Final check: Log events being passed to FullCalendar
    console.log('📅 Final events array for FullCalendar:', {
      totalEvents: validEvents.length,
      june23Events: validEvents.filter(e => e.start.toISOString().includes('2025-06-23')).length,
      sampleJune23: validEvents
        .filter(e => e.start.toISOString().includes('2025-06-23'))
        .map(e => ({
          title: e.title,
          start: e.start,
          start_iso: e.start.toISOString(),
          start_local: e.start.toLocaleString('en-US', { timeZone: tutorTz })
        }))
    });
    
    return validEvents;
  }, [filteredSessions, tutorTimezone, timeFormat, tutorCurrency]);

  // Handle schedule session
  const handleScheduleSession = () => {
    console.log('✅ Opening single schedule modal from calendar');
    
    // Prevent multiple modal instances
    if (showScheduleModal) {
      console.log('⚠️ Schedule modal already open, ignoring duplicate request');
      return;
    }
    
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
    // Prevent multiple modal instances - check and prevent immediately
    if (showScheduleModal) {
      console.log('⚠️ Schedule modal already open, ignoring duplicate slot selection');
      return;
    }

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

    // Clear any existing edit session and open modal
    setEditSession(null);
    setShowScheduleModal(true);
    
    // Dispatch event for form prefill with slight delay to ensure modal is mounted
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openScheduleModal', {
        detail: {
          date: selectedDate,
          time: selectedTime,
          duration: Math.max(30, duration)
        }
      }));
    }, 50);
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
      legacy_time: 'DEPRECATED'
    });

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          session_start: newStartUTC,
          session_end: newEndUTC
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
            timeZone={tutorTimezone || 'UTC'}
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
              
              // Debug: Log when June 23 events are mounted
              if (info.event.start && info.event.start.toISOString().includes('2025-06-23')) {
                console.log('📅 FullCalendar mounted June 23 event:', {
                  title: info.event.title,
                  start: info.event.start.toLocaleString(),
                  element_visible: info.el.offsetHeight > 0
                });
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