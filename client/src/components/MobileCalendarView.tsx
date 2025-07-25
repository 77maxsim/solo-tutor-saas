import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';
import { formatUtcToTutorTimezone, calculateDurationMinutes } from '@/lib/dateUtils';
import { useTimezone } from '@/contexts/TimezoneContext';
import { usePendingSessions } from '@/hooks/use-pending-sessions';
import { PendingRequestsModal } from '@/components/modals/pending-requests-modal';

interface SessionWithStudent {
  id: string;
  student_id: string;
  student_name: string;
  session_start: string;
  session_end: string;
  duration: number;
  rate: number;
  notes?: string;
  color?: string;
  created_at: string;
  recurrence_id?: string;
  paid?: boolean;
  avatarUrl?: string;
  status?: string;
  unassigned_name?: string;
}

interface MobileCalendarViewProps {
  sessions: SessionWithStudent[];
  onSelectSession: (session: SessionWithStudent) => void;
  tutorCurrency: string;
}

export default function MobileCalendarView({ sessions, onSelectSession, tutorCurrency }: MobileCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showPendingModal, setShowPendingModal] = useState(false);
  const { tutorTimezone } = useTimezone();
  
  // Get pending sessions count
  const { data: pendingCount = 0 } = usePendingSessions();

  // Helper function to get duration from either UTC timestamps or legacy fields
  const getDurationMinutes = (session: SessionWithStudent): number => {
    if (session.session_start && session.session_end) {
      return calculateDurationMinutes(session.session_start, session.session_end);
    } else if (session.duration) {
      return session.duration;
    }
    return 60; // Default fallback
  };

  // Get week start (Sunday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  // Generate week days
  const weekStart = getWeekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  // Get sessions for a specific date
  const getSessionsForDate = (date: Date) => {
    const targetDateString = date.toDateString();
    
    return sessions.filter(session => {
      if (!session.session_start) return false;
      
      const sessionDate = new Date(session.session_start);
      return sessionDate.toDateString() === targetDateString;
    });
  };

  // Navigate weeks
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  // Time slots from 6 AM to 10 PM in 30-minute increments
  const timeSlots = Array.from({ length: 32 }, (_, i) => {
    const totalMinutes = 6 * 60 + (i * 30); // Start at 6 AM, increment by 30 minutes
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  const handleAddSession = (date: Date, time: string) => {
    const datetime = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    datetime.setHours(hours, minutes, 0, 0);
    
    // Trigger global schedule session modal
    window.dispatchEvent(new CustomEvent('openScheduleModalFromButton'));
  };

  const handleSessionClick = (session: SessionWithStudent) => {
    console.log('🎯 Mobile session clicked:', session);
    onSelectSession(session);
  };

  return (
    <Card className="mobile-calendar-container w-full bg-white dark:bg-slate-900">
      <CardHeader className="pb-4 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Weekly Schedule</CardTitle>
          <div className="flex items-center gap-2">
            {/* Mobile Pending Requests Button - Responsive */}
            {pendingCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPendingModal(true)}
                className="relative flex items-center gap-1 px-2 py-1 text-xs"
              >
                <Clock className="h-3 w-3" />
                <span className="hidden sm:inline">Pending</span>
                <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs bg-orange-500 text-white">
                  {pendingCount}
                </Badge>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
            </span>
            <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid border-b border-gray-200 dark:border-gray-700" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          <div className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800"></div>
          {weekDays.map((day, index) => (
            <div key={index} className="p-2 text-center border-r last:border-r-0 min-w-0 bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {timeSlots.map((time, timeIndex) => (
            <div key={time} className="grid border-b last:border-b-0 min-h-[30px] border-gray-200 dark:border-gray-700" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div className="p-1 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800 flex items-center justify-center">
                <span className="font-medium">{time}</span>
              </div>
              {weekDays.map((day, dayIndex) => {
                const daySessions = getSessionsForDate(day);
                
                // Find session that starts at this exact time
                const sessionAtTime = daySessions.find(session => {
                  if (!session.session_start || !tutorTimezone) return false;
                  
                  const sessionTimeString = formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'HH:mm');
                  return sessionTimeString === time;
                });

                // Check if this slot is occupied by a continuing session
                const occupyingSession = daySessions.find(session => {
                  if (!session.session_start || !session.session_end) return false;
                  
                  const sessionStart = new Date(session.session_start);
                  const sessionEnd = new Date(session.session_end);
                  
                  const [currentHour, currentMin] = time.split(':').map(Number);
                  const currentTimeSlot = new Date(day);
                  currentTimeSlot.setHours(currentHour, currentMin, 0, 0);
                  
                  return currentTimeSlot >= sessionStart && currentTimeSlot < sessionEnd;
                });

                const isOccupied = occupyingSession && !sessionAtTime;

                return (
                  <div key={dayIndex} className="mobile-calendar-grid-cell relative border-r last:border-r-0 p-0.5 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 min-h-[28px] min-w-0 border-gray-200 dark:border-gray-700" style={{ touchAction: 'manipulation' }}>
                    {sessionAtTime ? (
                      <button
                        className="mobile-session-card absolute top-0.5 left-0.5 right-0.5 rounded text-white cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity px-1 py-1 flex flex-col justify-center overflow-hidden z-20 touch-manipulation border-0 outline-none focus:ring-2 focus:ring-white/20"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('📱 Mobile session button clicked:', sessionAtTime.id);
                          handleSessionClick(sessionAtTime);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          console.log('👆 Touch started on session:', sessionAtTime.id);
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('👆 Touch ended on session:', sessionAtTime.id);
                          // Trigger click on touch end for better mobile experience
                          handleSessionClick(sessionAtTime);
                        }}
                        style={{ 
                          backgroundColor: sessionAtTime.status === 'pending' ? '#f59e0b' : sessionAtTime.color || '#3b82f6',
                          height: `${Math.max(26, (getDurationMinutes(sessionAtTime) / 30) * 28)}px`,
                          // Enhanced mobile touch target styling
                          minHeight: '28px',
                          minWidth: '100%',
                          WebkitTapHighlightColor: 'transparent',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none'
                        }}
                      >
                        <div className="text-xs font-medium truncate leading-tight w-full text-center pointer-events-none">
                          {sessionAtTime.status === 'pending' && '⏳ '}
                          {sessionAtTime.student_name?.split(' ')[0] || sessionAtTime.unassigned_name?.split(' ')[0] || 'Session'}
                        </div>
                      </button>
                    ) : isOccupied ? (
                      // This slot is occupied by a continuing session, render empty
                      <div className="w-full h-full"></div>
                    ) : (
                      <button
                        className="w-full h-full rounded hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        onClick={() => handleAddSession(day, time)}
                      >
                        <Plus className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>

      {/* Mobile Pending Requests Modal */}
      <PendingRequestsModal
        open={showPendingModal}
        onOpenChange={setShowPendingModal}
      />
    </Card>
  );
}