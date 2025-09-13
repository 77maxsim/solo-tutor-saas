import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Enable dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

export interface LocalRange {
  startLocal: Date;
  endLocal: Date;
}

interface AvailabilityGridProps {
  weekStartLocal: Date;
  bookedRangesLocal: LocalRange[];
  pendingRangesLocal: LocalRange[];
  existingAvailabilityLocal: LocalRange[];
  selectedRangesLocal: LocalRange[];
  onProposedRange: (range: LocalRange) => void;
  tutorTimezone: string;
}

interface FullCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  className?: string;
  display?: string;
}

export default function AvailabilityGrid({
  weekStartLocal,
  bookedRangesLocal,
  pendingRangesLocal,
  existingAvailabilityLocal,
  selectedRangesLocal,
  onProposedRange,
  tutorTimezone
}: AvailabilityGridProps) {
  const [calendarView, setCalendarView] = useState<'timeGridWeek' | 'timeGridDay'>('timeGridWeek');
  const calendarRef = useRef<FullCalendar>(null);
  

  // Convert ranges to calendar events
  const bookedEvents: FullCalendarEvent[] = useMemo(() => {
    return bookedRangesLocal.map((range, index) => ({
      id: `booked-${index}`,
      title: 'Booked Session',
      start: range.startLocal,
      end: range.endLocal,
      backgroundColor: '#3b82f6',
      borderColor: '#2563eb',
      textColor: 'white',
      className: 'booked-event',
      display: 'block'
    }));
  }, [bookedRangesLocal]);

  const pendingEvents: FullCalendarEvent[] = useMemo(() => {
    return pendingRangesLocal.map((range, index) => ({
      id: `pending-${index}`,
      title: 'Pending Request',
      start: range.startLocal,
      end: range.endLocal,
      backgroundColor: '#eab308',
      borderColor: '#ca8a04',
      textColor: 'white',
      className: 'pending-event',
      display: 'block'
    }));
  }, [pendingRangesLocal]);

  const existingAvailabilityEvents: FullCalendarEvent[] = useMemo(() => {
    return existingAvailabilityLocal.map((range, index) => ({
      id: `existing-${index}`,
      title: 'Available',
      start: range.startLocal,
      end: range.endLocal,
      backgroundColor: '#10b981',
      borderColor: '#059669',
      textColor: 'white',
      className: 'availability-event',
      display: 'block'
    }));
  }, [existingAvailabilityLocal]);

  const selectedEvents: FullCalendarEvent[] = useMemo(() => {
    return selectedRangesLocal.map((range, index) => ({
      id: `selected-${index}`,
      title: 'Selected',
      start: range.startLocal,
      end: range.endLocal,
      backgroundColor: '#22c55e',
      borderColor: '#16a34a',
      textColor: 'white',
      className: 'selected-event',
      display: 'block'
    }));
  }, [selectedRangesLocal]);

  // Combine all events
  const allEvents = [...bookedEvents, ...pendingEvents, ...existingAvailabilityEvents, ...selectedEvents];

  // Handle calendar time selection for drag/click
  const handleSelect = useCallback((selectInfo: any) => {
    const start = selectInfo.start;
    const end = selectInfo.end;
    
    console.log('Selection made:', { start, end, duration: (end.getTime() - start.getTime()) / (1000 * 60), unit: 'minutes' });
    
    // Always use the full selected range (works for both single clicks and drag selections)
    onProposedRange({
      startLocal: start,
      endLocal: end
    });

    // Clear the calendar selection
    if (calendarRef.current) {
      calendarRef.current.getApi().unselect();
    }
  }, [onProposedRange]);

  return (
    <div className="availability-grid h-full">
      <style>
        {`
          .selected-event {
            border: 2px solid #16a34a !important;
            background: linear-gradient(45deg, #22c55e, #34d399) !important;
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0% { opacity: 0.8; }
            50% { opacity: 1; }
            100% { opacity: 0.8; }
          }
          
          .fc-event-main {
            cursor: pointer;
          }
          
          .fc-timegrid-slot {
            cursor: pointer;
          }
          
          .fc-daygrid-day {
            cursor: pointer;
          }
        `}
      </style>
      
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin]}
        initialView={calendarView}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridDay,timeGridWeek'
        }}
        height="100%"
        events={allEvents}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        editable={false}
        droppable={false}
        select={handleSelect}
        slotMinTime="06:00:00"
        slotMaxTime="23:00:00"
        allDaySlot={false}
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          omitZeroMinute: false,
          meridiem: 'short'
        }}
        selectConstraint={{
          start: new Date().toISOString().split('T')[0] + 'T06:00:00',
          end: new Date().toISOString().split('T')[0] + 'T23:00:00'
        }}
        businessHours={{
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
          startTime: '06:00',
          endTime: '23:00'
        }}
        timeZone={tutorTimezone}
        viewDidMount={() => {
          // Set initial week if provided
          if (weekStartLocal && calendarRef.current) {
            calendarRef.current.getApi().gotoDate(weekStartLocal);
          }
        }}
      />
    </div>
  );
}