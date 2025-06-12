import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';

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
}

interface MobileCalendarViewProps {
  sessions: SessionWithStudent[];
  onSelectSlot: (date: Date) => void;
  onSelectEvent: (session: SessionWithStudent) => void;
}

export default function MobileCalendarView({ sessions, onSelectSlot, onSelectEvent }: MobileCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

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
    const dateStr = date.toISOString().split('T')[0];
    return sessions.filter(session => session.date === dateStr);
  };

  // Navigate weeks
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  // Time slots from 6 AM to 10 PM
  const timeSlots = Array.from({ length: 16 }, (_, i) => {
    const hour = 6 + i;
    return `${hour.toString().padStart(2, '0')}:00`;
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
          {timeSlots.map((time) => (
            <div key={time} className="grid border-b last:border-b-0 min-h-[65px]" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div className="p-2 text-xs text-gray-500 border-r bg-gray-50 flex items-center justify-center">
                <span className="font-medium">{time}</span>
              </div>
              {weekDays.map((day, dayIndex) => {
                const daySessions = getSessionsForDate(day);
                const sessionAtTime = daySessions.find(session => {
                  const sessionTime = session.time.substring(0, 5);
                  return sessionTime === time;
                });

                return (
                  <div key={dayIndex} className="relative border-r last:border-r-0 p-1 bg-white hover:bg-gray-50 min-h-[60px] min-w-0">
                    {sessionAtTime ? (
                      <div
                        className="rounded text-white cursor-pointer hover:opacity-80 transition-opacity h-full px-1 py-1 flex flex-col justify-center overflow-hidden w-full"
                        onClick={() => onSelectEvent(sessionAtTime)}
                        style={{ backgroundColor: sessionAtTime.color || '#3b82f6' }}
                      >
                        <div className="text-xs font-medium truncate leading-tight mb-0.5 w-full">
                          {sessionAtTime.student_name.split(' ')[0]}
                        </div>
                        <div className="text-xs opacity-90 leading-tight truncate w-full">
                          {sessionAtTime.duration}min
                        </div>
                      </div>
                    ) : (
                      <button
                        className="w-full h-full min-h-[54px] rounded hover:bg-gray-100 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        onClick={() => handleAddSession(day, time)}
                      >
                        <Plus className="h-4 w-4 text-gray-400" />
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