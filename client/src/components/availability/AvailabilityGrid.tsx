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
  
  // Custom drag selection state
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [hoverCellStart, setHoverCellStart] = useState<Date | null>(null);

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

  // Handle custom drag selection with proper range calculation
  const handleMouseDown = useCallback((info: any) => {
    const cellStartLocal = new Date(info.date);
    setDragStart(cellStartLocal);
    setHoverCellStart(cellStartLocal);
  }, []);

  const handleMouseEnter = useCallback((info: any) => {
    if (dragStart) {
      const cellStartLocal = new Date(info.date);
      setHoverCellStart(cellStartLocal);
    }
  }, [dragStart]);

  const handleMouseUp = useCallback(() => {
    if (!dragStart) return;
    
    const stepMs = 30 * 60 * 1000; // 30 minutes in milliseconds
    const a = dragStart;
    const b = hoverCellStart || dragStart;
    
    // Calculate proper start and end
    const start = a < b ? a : b;
    const endBase = a < b ? b : a;
    const end = new Date(endBase.getTime() + stepMs); // include last hovered cell
    
    // Validate range
    if (end <= start) {
      setDragStart(null);
      setHoverCellStart(null);
      return;
    }
    
    // Emit the proposed range
    onProposedRange({
      startLocal: start,
      endLocal: end
    });
    
    // Reset drag state
    setDragStart(null);
    setHoverCellStart(null);
  }, [dragStart, hoverCellStart, onProposedRange]);

  // Handle single click to create 30-minute default slot
  const handleDateClick = useCallback((dateClickInfo: any) => {
    // Only handle single clicks (not part of drag)
    if (dragStart) return;
    
    const clickedDate = dateClickInfo.date;
    const endDate = new Date(clickedDate);
    endDate.setMinutes(endDate.getMinutes() + 30); // Default 30-minute slot

    onProposedRange({
      startLocal: clickedDate,
      endLocal: endDate
    });
  }, [onProposedRange, dragStart]);

  // Global mouseup event listener to handle drag completion
  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp();
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleMouseUp]);

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
        selectable={false}
        selectMirror={false}
        dayMaxEvents={true}
        weekends={true}
        editable={false}
        droppable={false}
        dateClick={handleDateClick}
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
        datesSet={() => {
          // Add event handlers to time slots after calendar renders
          setTimeout(() => {
            const timeSlots = document.querySelectorAll('.fc-timegrid-slot');
            timeSlots.forEach(slot => {
              const handleMouseDownSlot = (e: Event) => {
                e.preventDefault();
                const slotEl = e.target as HTMLElement;
                const timeAttr = slotEl.getAttribute('data-time');
                if (timeAttr) {
                  const date = new Date(timeAttr);
                  handleMouseDown({ date });
                }
              };
              
              const handleMouseEnterSlot = (e: Event) => {
                const slotEl = e.target as HTMLElement;
                const timeAttr = slotEl.getAttribute('data-time');
                if (timeAttr) {
                  const date = new Date(timeAttr);
                  handleMouseEnter({ date });
                }
              };
              
              slot.addEventListener('mousedown', handleMouseDownSlot);
              slot.addEventListener('mouseenter', handleMouseEnterSlot);
            });
          }, 100);
        }}
      />
    </div>
  );
}