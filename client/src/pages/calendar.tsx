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
import MobileCalendarView from '@/components/MobileCalendarView';
import { SessionDetailsModal } from '@/components/modals/session-details-modal';
import { useIsMobile } from "@/hooks/use-mobile";
import { usePendingSessions } from "@/hooks/use-pending-sessions";
import { PendingRequestsModal } from "@/components/modals/pending-requests-modal";
import { formatUtcToTutorTimezone } from "@/lib/dateUtils";
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

export default function Calendar() {
  const [view, setView] = useState<string>('timeGridWeek');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [sessionForDetails, setSessionForDetails] = useState<SessionWithStudent | null>(null);
  const [showSessionDetailsModal, setShowSessionDetailsModal] = useState(false);
  const [showPendingRequestsModal, setShowPendingRequestsModal] = useState(false);
  const [calendarView, setCalendarView] = useState<'week' | 'month' | 'agenda'>('week');
  const calendarRef = useRef<FullCalendar>(null);
  
  const isMobile = useIsMobile();
  const { tutorTimezone } = useTimezone();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

      if (shouldUseOptimizedQuery()) {
        return await getOptimizedSessions(tutorId);
      } else {
        return await getStandardSessions(tutorId);
      }
    },
    refetchInterval: 30000,
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

  // Filter sessions based on selected student
  const filteredSessions = useMemo(() => {
    if (selectedStudent === 'all') return sessions;
    return sessions.filter(session => session.student_id === selectedStudent);
  }, [sessions, selectedStudent]);

  // Convert sessions to FullCalendar events
  const events: FullCalendarEvent[] = useMemo(() => {
    console.log('🔄 Converting sessions to FullCalendar events, tutorTimezone:', tutorTimezone);
    
    return filteredSessions.map(session => {
      let startISO: string;
      let endISO: string;

      if (session.session_start && session.session_end) {
        // Ensure proper UTC ISO string formatting for FullCalendar
        startISO = DateTime.fromISO(session.session_start, { zone: 'utc' }).toUTC().toISO();
        endISO = DateTime.fromISO(session.session_end, { zone: 'utc' }).toUTC().toISO();
        
        console.log('📅 Session with UTC timestamps:', {
          student: session.student_name,
          session_start_utc: session.session_start,
          session_end_utc: session.session_end,
          passed_to_fullcalendar: { start: startISO, end: endISO }
        });
      } else {
        // Fallback: convert legacy date/time fields to UTC for FullCalendar
        const sessionDate = session.date;
        const sessionTime = session.time;
        const tutorTz = tutorTimezone || 'UTC';
        
        // Parse as tutor's timezone, then convert to UTC
        const startInTutorTz = DateTime.fromFormat(`${sessionDate} ${sessionTime}`, 'yyyy-MM-dd HH:mm', { zone: tutorTz });
        const endInTutorTz = startInTutorTz.plus({ minutes: session.duration });
        
        startISO = startInTutorTz.toUTC().toISO();
        endISO = endInTutorTz.toUTC().toISO();
        
        console.log('📅 Session with legacy date/time:', {
          student: session.student_name,
          legacy_date: sessionDate,
          legacy_time: sessionTime,
          converted_to_utc: { start: startISO, end: endISO }
        });
      }

      // Determine display name and styling
      let title = session.student_name || session.unassigned_name || 'Unassigned Session';
      let backgroundColor = '#3b82f6'; // Default blue
      let textColor = '#ffffff';
      
      if (session.status === 'pending') {
        backgroundColor = '#f59e0b'; // Amber for pending
        title = `⏳ ${title}`;
      } else if (!session.paid) {
        backgroundColor = '#ef4444'; // Red for unpaid
        title = `💰 ${title}`;
      } else if (session.color) {
        backgroundColor = session.color;
      }

      return {
        id: session.id,
        title,
        start: startISO,
        end: endISO,
        backgroundColor,
        borderColor: backgroundColor,
        textColor,
        extendedProps: session
      };
    });
  }, [filteredSessions, tutorTimezone]);

  // Handle schedule session
  const handleScheduleSession = () => {
    window.dispatchEvent(new CustomEvent('openScheduleModal'));
  };

  // Custom event content renderer
  const renderEventContent = (eventInfo: any) => {
    const session = eventInfo.event.extendedProps;
    const durationMinutes = session.duration || 60;
    const earning = session.tuition_fee || 0;

    return (
      <div className="p-1 text-xs">
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
    // FullCalendar provides times in the calendar's timezone
    // Convert to tutor timezone for form data
    const tutorTz = tutorTimezone || 'local';
    
    const startInTutorTz = DateTime.fromJSDate(selectInfo.start).setZone(tutorTz);
    const endInTutorTz = DateTime.fromJSDate(selectInfo.end).setZone(tutorTz);
    
    const selectedDate = startInTutorTz.toISODate();
    const selectedTime = startInTutorTz.toFormat('HH:mm');
    const duration = Math.round(endInTutorTz.diff(startInTutorTz, 'minutes').minutes);

    window.dispatchEvent(new CustomEvent('openScheduleModal', {
      detail: {
        date: selectedDate,
        time: selectedTime,
        duration: Math.max(30, duration)
      }
    }));
  };

  // Handle event drop (drag and drop)
  const handleEventDrop = async (dropInfo: any) => {
    const session = dropInfo.event.extendedProps as SessionWithStudent;
    
    // FullCalendar provides the new time in the calendar's timezone
    // Convert to UTC for storage and tutor timezone for legacy fields
    const tutorTz = tutorTimezone || 'local';
    const newStartUTC = DateTime.fromJSDate(dropInfo.event.start).toUTC();
    const newEndUTC = DateTime.fromJSDate(dropInfo.event.end).toUTC();
    const newStartInTutorTz = newStartUTC.setZone(tutorTz);

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          session_start: newStartUTC.toISO(),
          session_end: newEndUTC.toISO(),
          date: newStartInTutorTz.toISODate(),
          time: newStartInTutorTz.toFormat('HH:mm')
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

  // Handle event resize
  const handleEventResize = async (resizeInfo: any) => {
    const session = resizeInfo.event.extendedProps as SessionWithStudent;
    
    // FullCalendar provides times in the calendar's timezone
    // Convert to UTC for storage
    const newEndUTC = DateTime.fromJSDate(resizeInfo.event.end).toUTC();
    const newStartUTC = DateTime.fromJSDate(resizeInfo.event.start).toUTC();
    const newDuration = Math.round(newEndUTC.diff(newStartUTC, 'minutes').minutes);

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          session_end: newEndUTC.toISO(),
          duration: newDuration
        })
        .eq('id', session.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      toast({
        title: "Session Updated",
        description: "Session duration has been updated successfully."
      });
    } catch (error: any) {
      resizeInfo.revert();
      toast({
        variant: "destructive",
        title: "Failed to Update Session",
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
            timeZone={tutorTimezone || 'local'}
            events={events}
            eventDidMount={(info) => {
              // Debug: log how FullCalendar positions events
              console.log('🎯 FullCalendar positioned event:', {
                title: info.event.title,
                utc_start: info.event.start?.toISOString(),
                utc_end: info.event.end?.toISOString(),
                calendar_timezone: tutorTimezone || 'local',
                displayed_start: info.event.start?.toLocaleString(),
                displayed_end: info.event.end?.toLocaleString()
              });
            }}
            editable={true}
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

      {/* Pending Requests Modal */}
      <PendingRequestsModal
        open={showPendingRequestsModal}
        onOpenChange={setShowPendingRequestsModal}
        highlightSessionId={sessionForDetails?.id}
      />
    </div>
  );
}