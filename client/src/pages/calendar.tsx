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
  console.log('🔍 Current pending modal state:', showPendingRequestsModal);
  const [highlightedSessionId, setHighlightedSessionId] = useState<string | undefined>(undefined);
  console.log('🔍 Current highlightedSessionId:', highlightedSessionId);
  
  // Effect to ensure modal opens when highlightedSessionId is set
  useEffect(() => {
    if (highlightedSessionId) {
      console.log('🔄 useEffect triggered - opening modal for session:', highlightedSessionId);
      setShowPendingRequestsModal(true);
    }
  }, [highlightedSessionId]);
  
  const [calendarView, setCalendarView] = useState<'week' | 'month' | 'agenda'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper function to check if two dates are in the same month
  const isSameMonth = (date1: Date, date2: Date): boolean => {
    return dayjs(date1).isSame(dayjs(date2), 'month');
  };

  // Handle calendar date changes (for month view title)
  const handleDatesSet = useCallback((arg: any) => {
    const newDate = arg.start;
    if (!isSameMonth(newDate, currentDate)) {
      setCurrentDate(newDate);
    }
  }, [currentDate]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editSession, setEditSession] = useState<SessionWithStudent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditingRecurring, setIsEditingRecurring] = useState(false);
  const [loadingSlot, setLoadingSlot] = useState<{x: number, y: number} | null>(null);
  const calendarRef = useRef<FullCalendar>(null);
  
  const isMobile = useIsMobile();
  const { tutorTimezone } = useTimezone();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set initial view to listWeek for mobile
  useEffect(() => {
    if (isMobile && view !== 'listWeek') {
      setView('listWeek');
      setCalendarView('agenda');
    }
  }, [isMobile]);

  // Add event listeners for session edit actions (works for both mobile and desktop)
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
      // Only process sessions with UTC timestamps
      if (!session.session_start || !session.session_end) {
        console.warn('⚠️ Session missing UTC timestamps, skipping:', {
          id: session.id?.substring(0, 8) + '...',
          session_start: session.session_start,
          session_end: session.session_end,
          status: session.status,
          student_name: session.student_name,
          unassigned_name: session.unassigned_name
        });
        
        skippedSessions.push(session);
        return;
      }

      try {
        // Use the proper utility function that handles colors correctly
        const event = convertSessionToCalendarEvent(session, tutorTz);
        validEvents.push(event);
        
        // Log event creation for verification including color
        console.log('✅ Calendar event created:', {
          id: session.id?.substring(0, 8) + '...',
          title: event.title,
          student_name: session.student_name,
          selected_color: session.color,
          final_background: event.backgroundColor,
          status: session.status,
          paid: session.paid,
          original_utc: session.session_start
        });
      } catch (error) {
        console.error('❌ Failed to convert session to calendar event:', error);
        skippedSessions.push(session);
      }
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

  // Custom event content renderer with hover animations
  const renderEventContent = (eventInfo: any) => {
    const session = eventInfo.event.extendedProps;
    const durationMinutes = session.duration || 60;
    const earning = (durationMinutes / 60) * session.rate;

    const { displayTime } = getSessionDisplayInfo(session, tutorTimezone || undefined);
    const tooltipContent = `${session.student_name || 'Unassigned'}\n${displayTime}\n${durationMinutes} minutes\n${formatCurrency(earning, tutorCurrency)}`;

    // Apply faded styling for past sessions
    const fadeClass = session.isPastSession ? 'opacity-50 grayscale' : '';

    // Check view types
    const isAgendaView = eventInfo.view.type === 'listWeek';
    const isMonthView = eventInfo.view.type === 'dayGridMonth';

    // Get student initials for avatar fallback
    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    };

    const studentName = session.student_name || session.unassigned_name || 'Unassigned';
    const initials = getInitials(studentName);

    if (isMonthView) {
      // Month view: Compact session preview with time, color dot, and student info
      return (
        <div 
          className={`calendar-session-preview flex items-center gap-1 text-xs overflow-hidden transition-all duration-200 ease-in-out hover:saturate-150 hover:brightness-110 ${fadeClass} cursor-pointer group`}
          title={tooltipContent}
        >
          {/* Session Color Dot */}
          <div 
            className="dot shrink-0 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: session.color || '#3b82f6' }}
          ></div>

          {/* Session Time */}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {displayTime.split(' – ')[0]}
          </span>

          {/* Student Name/Initials */}
          <span className="truncate text-gray-600 dark:text-gray-400 flex-1">
            {studentName.length > 12 ? initials : studentName}
          </span>
        </div>
      );
    }

    if (isAgendaView) {
      return (
        <div 
          className={`agenda-session flex items-center gap-2 p-2 text-sm transition-all duration-200 ease-in-out hover:saturate-150 hover:brightness-110 ${fadeClass} cursor-pointer group w-full`}
          title={tooltipContent}
        >
          {/* Student Avatar */}
          <div className="avatar shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-white shadow-sm overflow-hidden">
            {session.avatarUrl ? (
              <img 
                src={session.avatarUrl} 
                alt={`${studentName} avatar`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div 
              className={`w-full h-full flex items-center justify-center ${session.avatarUrl ? 'hidden' : ''}`}
              style={{ backgroundColor: session.color || '#3b82f6' }}
            >
              {initials}
            </div>
          </div>

          {/* Session Color Dot */}
          <div 
            className="color-dot shrink-0 w-2.5 h-2.5 rounded-full shadow-sm"
            style={{ backgroundColor: session.color || '#3b82f6' }}
          ></div>

          {/* Session Content */}
          <div className="flex-1 min-w-0">
            <div className="student-name font-medium truncate transition-transform duration-200 ease-in-out group-hover:translate-x-1">
              {studentName}
            </div>
            <div className="text-xs opacity-75 transition-opacity duration-200 group-hover:opacity-100">
              {durationMinutes}min • {formatCurrency(earning, tutorCurrency)}
            </div>
          </div>

          {/* Session Time */}
          <div className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
            {displayTime}
          </div>
        </div>
      );
    }

    // Default grid/timeline view content
    return (
      <div 
        className={`p-1 text-xs transition-all duration-200 ease-in-out hover:saturate-150 hover:brightness-110 ${fadeClass} cursor-pointer group`} 
        title={tooltipContent}
      >
        <div className="font-medium truncate transition-transform duration-200 ease-in-out group-hover:scale-105 group-hover:translate-y-[-1px]">
          {eventInfo.event.title}
        </div>
        <div className="text-xs opacity-90 transition-opacity duration-200 group-hover:opacity-100">
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

  // Add debounce ref to prevent rapid successive calls
  const selectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle slot selection to schedule new session
  const handleDateSelect = useCallback((selectInfo: any) => {
    console.log('📅 Calendar select triggered:', selectInfo);
    
    // Clear any existing timeout
    if (selectTimeoutRef.current) {
      clearTimeout(selectTimeoutRef.current);
      selectTimeoutRef.current = null;
    }

    // Prevent multiple modal instances - check and prevent immediately
    if (showScheduleModal) {
      console.log('⚠️ Schedule modal already open, ignoring duplicate slot selection');
      return;
    }

    // Prevent default scroll behavior immediately
    if (selectInfo.jsEvent) {
      selectInfo.jsEvent.preventDefault();
      selectInfo.jsEvent.stopImmediatePropagation();
      
      // Prevent any scroll-related events
      if (selectInfo.jsEvent.type === 'mousedown' || selectInfo.jsEvent.type === 'click') {
        selectInfo.jsEvent.target?.addEventListener('scroll', (e) => e.preventDefault(), { once: true });
      }
    }
    
    // Store current scroll position BEFORE any actions
    const preservedScrollY = window.scrollY;
    
    // Immediately lock the scroll position with comprehensive prevention
    const scrollLockStyles = {
      position: 'fixed' as const,
      top: `-${preservedScrollY}px`,
      left: '0',
      right: '0', 
      width: '100%',
      overflow: 'hidden' as const,
      height: '100vh'
    };
    
    Object.assign(document.body.style, scrollLockStyles);
    
    // Also prevent scroll on document element
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';
    
    // Add CSS classes for additional scroll prevention
    document.body.classList.add('scroll-locked', 'modal-open');
    document.documentElement.classList.add('scroll-locked-html');

    // Show loading indicator at click position
    const rect = selectInfo.jsEvent?.target?.getBoundingClientRect();
    if (rect) {
      setLoadingSlot({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    }

    // Debounce the selection to prevent rapid duplicate calls
    selectTimeoutRef.current = setTimeout(() => {
      // Double-check modal state after debounce delay
      if (showScheduleModal) {
        console.log('⚠️ Schedule modal opened during debounce, canceling selection');
        setLoadingSlot(null);
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
      
      // Store prefill data for the modal to use when it mounts
      window.sessionPrefillData = {
        date: selectedDate,
        time: selectedTime,
        duration: Math.max(30, duration)
      };

      // Clear loading indicator when modal opens
      setLoadingSlot(null);
    }, 100); // 100ms debounce delay
  }, [showScheduleModal, tutorTimezone]);

  // Handle single date clicks as fallback when select doesn't work
  const handleDateClick = useCallback((dateClickInfo: any) => {
    console.log('📅 Calendar dateClick triggered:', dateClickInfo);
    
    // Prevent default scroll behavior
    if (dateClickInfo.jsEvent) {
      dateClickInfo.jsEvent.preventDefault();
      dateClickInfo.jsEvent.stopPropagation();
    }
    
    // Prevent multiple modal instances
    if (showScheduleModal) {
      console.log('⚠️ Schedule modal already open, ignoring date click');
      return;
    }

    // Store current scroll position to preserve it
    const preservedScrollY = window.scrollY;

    // Show loading indicator at click position
    const rect = dateClickInfo.jsEvent?.target?.getBoundingClientRect();
    if (rect) {
      setLoadingSlot({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    }

    // Create a simulated selectInfo for consistent handling
    const clickDate = dayjs(dateClickInfo.date).tz(tutorTimezone || 'UTC');
    const selectedDate = clickDate.format('YYYY-MM-DD');
    const selectedTime = clickDate.format('HH:mm');
    const duration = 60; // Default 1 hour duration for single clicks
    
    console.log('🎯 Date clicked for new session:', {
      clicked_date: dateClickInfo.date,
      tutor_timezone: tutorTimezone || 'UTC',
      form_date: selectedDate,
      form_time: selectedTime,
      duration: duration
    });

    setTimeout(() => {
      // Clear any existing edit session and open modal
      setEditSession(null);
      setShowScheduleModal(true);
      
      // Store prefill data for the modal to use when it mounts
      window.sessionPrefillData = {
        date: selectedDate,
        time: selectedTime,
        duration: duration
      };

      // Clear loading indicator when modal opens
      setLoadingSlot(null);
      
    }, 100);
  }, [showScheduleModal, tutorTimezone]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (selectTimeoutRef.current) {
        clearTimeout(selectTimeoutRef.current);
      }
    };
  }, []);

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
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <div className="p-4 h-full flex flex-col">
          {/* Mobile Header */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendar
            </h1>
            <div className="flex items-center gap-2">
              {/* Pending Requests Button */}
              {pendingCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPendingRequestsModal(true)}
                  className="relative"
                  data-testid="button-pending-requests"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Pending</span>
                  <Badge className="ml-1 bg-orange-500 text-white" data-testid="badge-pending-count">{pendingCount}</Badge>
                </Button>
              )}

              {/* Schedule Session Button */}
              <Button 
                size="sm" 
                onClick={handleScheduleSession}
                data-testid="button-schedule-session"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Schedule</span>
              </Button>
            </div>
          </div>

          {/* Student Filter */}
          <div className="mb-4">
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="w-full" data-testid="select-student-filter">
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
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              data-testid="button-previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              data-testid="button-today"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              data-testid="button-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar - Agenda View */}
          <div className="flex-1 calendar-container bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, luxonPlugin]}
              initialView="listWeek"
              locale="en-gb"
              firstDay={1}
              timeZone={tutorTimezone || 'UTC'}
              initialDate={new Date()}
              validRange={{
                start: '2020-01-01',
                end: '2030-12-31'
              }}
              events={events}
              eventDidMount={(info) => {
                const session = info.event.extendedProps;
                
                // Apply faded styling to past sessions
                if (session.isPastSession) {
                  info.el.style.opacity = '0.5';
                  info.el.style.filter = 'grayscale(50%)';
                }
              }}
              editable={false}
              selectable={false}
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              height="100%"
              headerToolbar={false}
              nowIndicator={true}
              listDayFormat={{ weekday: 'long', day: 'numeric', month: 'long' }}
              listDaySideFormat={false}
              noEventsContent="No sessions scheduled"
              datesSet={handleDatesSet}
            />
          </div>
        </div>

        {/* Schedule Session Modal */}
        <ScheduleSessionModal
          open={showScheduleModal}
          onOpenChange={(open) => {
            setShowScheduleModal(open);
            if (!open) {
              setEditSession(null);
              setLoadingSlot(null);
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

        {/* Session Details Modal */}
        {sessionForDetails && (
          <SessionDetailsModal
            session={sessionForDetails as any}
            isOpen={showSessionDetailsModal}
            onClose={() => {
              setShowSessionDetailsModal(false);
              setSessionForDetails(null);
            }}
          />
        )}

        {/* Pending Requests Modal */}
        <PendingRequestsModal
          open={showPendingRequestsModal}
          onOpenChange={(open) => {
            setShowPendingRequestsModal(open);
            if (!open) {
              setHighlightedSessionId(undefined);
            }
          }}
          highlightSessionId={highlightedSessionId}
        />
      </div>
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
            
            {/* Month Title (only for month view) */}
            {calendarView === 'month' && (
              <div className="ml-4 text-lg font-semibold text-gray-900 dark:text-white">
                {dayjs(currentDate).format('MMMM YYYY')}
              </div>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 calendar-container bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, luxonPlugin]}
            initialView={view}
            locale="en-gb"
            firstDay={1}
            timeZone={tutorTimezone || 'UTC'}
            initialDate={new Date()}
            validRange={{
              start: '2020-01-01',
              end: '2030-12-31'
            }}
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
            selectMirror={false}
            dayMaxEvents={true}
            weekends={true}
            eventClick={handleEventClick}
            select={handleDateSelect}
            dateClick={handleDateClick}
            unselectAuto={false}
            selectMinDistance={5}
            selectAllow={() => true}
            scrollTime="06:00:00"
            scrollTimeReset={false}
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
            dayHeaderFormat={{ weekday: 'short' }}
            slotLabelFormat={{
              hour: 'numeric',
              minute: '2-digit',
              omitZeroMinute: false,
              meridiem: 'short'
            }}
            views={{
              timeGridWeek: {
                dayHeaderFormat: { weekday: 'short', day: 'numeric', month: 'short' }, // e.g. "Mon 8 Jul"
              },
              dayGridMonth: {
                dayMaxEventRows: 3,  // Allow up to 3 events before showing "+X more"
                eventLimit: true,
                moreLinkClick: 'popover',  // Show popover when clicking "+X more"
                fixedWeekCount: false,  // Don't show extra weeks
                showNonCurrentDates: false  // Hide dates from other months
              }
            }}
            datesSet={handleDatesSet}
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
            setLoadingSlot(null); // Clear loading indicator when modal closes
            // Force calendar to clear any selection state
            if (calendarRef.current) {
              calendarRef.current.getApi().unselect();
            }
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

      {/* Session Details Modal */}
      {console.log('🔍 Modal render check:', { sessionForDetails: !!sessionForDetails, showSessionDetailsModal, sessionData: sessionForDetails })}
      {sessionForDetails && (
        <SessionDetailsModal
          session={sessionForDetails as any}
          isOpen={showSessionDetailsModal}
          onClose={() => {
            console.log('📱 Closing session details modal');
            setShowSessionDetailsModal(false);
            setSessionForDetails(null);
          }}
        />
      )}

      {/* Pending Requests Modal */}
      {console.log('🎭 About to render PendingRequestsModal with open:', showPendingRequestsModal, 'highlightSessionId:', highlightedSessionId)}
      <PendingRequestsModal
        open={showPendingRequestsModal}
        onOpenChange={(open) => {
          console.log('🚀 Pending modal state changing to:', open);
          setShowPendingRequestsModal(open);
          if (!open) {
            setHighlightedSessionId(undefined);
          }
        }}
        highlightSessionId={highlightedSessionId}
      />

      {/* Animated Loading Indicator for Time Slot Selection */}
      {loadingSlot && (
        <div 
          className="fixed z-50 pointer-events-none animate-in fade-in-0 zoom-in-95 duration-200"
          style={{
            left: loadingSlot.x - 20,
            top: loadingSlot.y - 20,
          }}
        >
          <div className="relative">
            {/* Outer Pulsing Ring */}
            <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-blue-400 animate-ping opacity-75"></div>
            
            {/* Middle Spinning Circle */}
            <div className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-blue-500 animate-spin"></div>
            
            {/* Center Dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
            
            {/* Floating "+" Icon */}
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold animate-bounce">
              +
            </div>
          </div>
        </div>
      )}
    </div>
  );
}