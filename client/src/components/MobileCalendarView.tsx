import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';
import { formatUtcToTutorTimezone } from '@/lib/dateUtils';
import { useTimezone } from '@/contexts/TimezoneContext';

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
}

interface MobileCalendarViewProps {
  sessions: SessionWithStudent[];
  onSelectSlot: (date: Date) => void;
  onSelectEvent: (session: SessionWithStudent) => void;
}

export default function MobileCalendarView({ sessions, onSelectSlot, onSelectEvent }: MobileCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

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
      let sessionDate: Date;
      
      // Check if we have UTC timestamp or legacy date field
      if (session.session_start) {
        sessionDate = new Date(session.session_start);
      } else if (session.date) {
        sessionDate = new Date(session.date);
      } else {
        return false;
      }
      
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
    onSelectSlot(datetime);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Weekly Schedule</CardTitle>
          <div className="flex items-center gap-2">
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
        <div className="grid border-b" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
          <div className="p-2 text-xs font-medium text-gray-500 border-r bg-gray-50"></div>
          {weekDays.map((day, index) => (
            <div key={index} className="p-2 text-center border-r last:border-r-0 min-w-0">
              <div className="text-xs font-medium text-gray-600 truncate">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-sm font-semibold">
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {timeSlots.map((time, timeIndex) => (
            <div key={time} className="grid border-b last:border-b-0 min-h-[30px]" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div className="p-1 text-xs text-gray-500 border-r bg-gray-50 flex items-center justify-center">
                <span className="font-medium">{time}</span>
              </div>
              {weekDays.map((day, dayIndex) => {
                const daySessions = getSessionsForDate(day);
                
                // Find session that starts at this exact time
                const sessionAtTime = daySessions.find(session => {
                  let sessionTimeString: string;
                  
                  if (session.session_start && tutorTimezone) {
                    sessionTimeString = formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'HH:mm');
                  } else if (session.time) {
                    sessionTimeString = session.time.substring(0, 5);
                  } else {
                    return false;
                  }
                  
                  return sessionTimeString === time;
                });

                // Check if this slot is occupied by a continuing session
                const occupyingSession = daySessions.find(session => {
                  let sessionStart: Date, sessionEnd: Date;
                  
                  if (session.session_start && session.session_end) {
                    sessionStart = new Date(session.session_start);
                    sessionEnd = new Date(session.session_end);
                  } else if (session.date && session.time && session.duration) {
                    const [hours, minutes] = session.time.split(':').map(Number);
                    sessionStart = new Date(session.date);
                    sessionStart.setHours(hours, minutes, 0, 0);
                    sessionEnd = new Date(sessionStart.getTime() + session.duration * 60 * 1000);
                  } else {
                    return false;
                  }
                  
                  const [currentHour, currentMin] = time.split(':').map(Number);
                  const currentTimeSlot = new Date(day);
                  currentTimeSlot.setHours(currentHour, currentMin, 0, 0);
                  
                  return currentTimeSlot >= sessionStart && currentTimeSlot < sessionEnd;
                });

                const isOccupied = occupyingSession && !sessionAtTime;

                return (
                  <div key={dayIndex} className="relative border-r last:border-r-0 p-0.5 bg-white hover:bg-gray-50 min-h-[28px] min-w-0">
                    {sessionAtTime ? (
                      <div
                        className="absolute top-0.5 left-0.5 right-0.5 rounded text-white cursor-pointer hover:opacity-80 transition-opacity px-1 py-1 flex flex-col justify-center overflow-hidden z-10"
                        onClick={() => onSelectEvent(sessionAtTime)}
                        style={{ 
                          backgroundColor: sessionAtTime.color || '#3b82f6',
                          height: `${Math.max(26, (getDurationMinutes(sessionAtTime) / 30) * 28)}px`
                        }}
                      >
                        <div className="text-xs font-medium truncate leading-tight w-full text-center">
                          {sessionAtTime.student_name.split(' ')[0]}
                        </div>
                      </div>
                    ) : isOccupied ? (
                      // This slot is occupied by a continuing session, render empty
                      <div className="w-full h-full"></div>
                    ) : (
                      <button
                        className="w-full h-full rounded hover:bg-gray-100 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        onClick={() => handleAddSession(day, time)}
                      >
                        <Plus className="h-3 w-3 text-gray-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}