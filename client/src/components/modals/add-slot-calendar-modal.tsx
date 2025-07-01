import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentTutorId } from '@/lib/tutorHelpers';
import { useTimezone } from '@/contexts/TimezoneContext';
import {
  Clock,
  Calendar as CalendarIcon,
  Check,
  X,
  RotateCcw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { isWithinInterval, parseISO } from 'date-fns';

// Enable dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Mobile detection hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

// Form schema for mobile fallback
const slotFormSchema = z.object({
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
}).refine((data) => {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
});

type SlotFormData = z.infer<typeof slotFormSchema>;

interface BookingSlot {
  id: string;
  tutor_id: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

interface SessionWithStudent {
  id: string;
  session_start: string;
  session_end: string;
  student_name?: string;
  unassigned_name?: string;
  color: string;
  status: string;
  duration: number;
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

interface SelectedTimeSlot {
  start: Date;
  end: Date;
  startLocal: string;
  endLocal: string;
}

interface AddSlotCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSlotAdded: () => void;
}

export default function AddSlotCalendarModal({ 
  open, 
  onOpenChange, 
  onSlotAdded 
}: AddSlotCalendarModalProps) {
  const [calendarView, setCalendarView] = useState<'timeGridWeek' | 'timeGridDay'>('timeGridWeek');
  const [selectedSlot, setSelectedSlot] = useState<SelectedTimeSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tutorTimezone } = useTimezone();
  const calendarRef = useRef<FullCalendar>(null);
  const isMobile = useIsMobile();

  // Form for mobile fallback
  const form = useForm<SlotFormData>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      startTime: '',
      endTime: '',
    },
  });

  // Fetch existing booking slots
  const { data: bookingSlots = [] } = useQuery({
    queryKey: ["booking-slots"],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error("User not authenticated or tutor record not found");
      }

      const { data, error } = await supabase
        .from("booking_slots")
        .select("*")
        .eq("tutor_id", tutorId)
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error fetching booking slots:", error);
        throw error;
      }

      return data as BookingSlot[];
    },
    enabled: open,
  });

  // Fetch existing sessions to show as unavailable times
  const { data: existingSessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error("User not authenticated or tutor record not found");
      }

      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id,
          session_start,
          session_end,
          student:students(name),
          unassigned_name,
          status
        `)
        .eq("tutor_id", tutorId)
        .gte("session_start", new Date().toISOString())
        .order("session_start", { ascending: true });

      if (error) {
        console.error("Error fetching sessions:", error);
        throw error;
      }

      return data.map(session => ({
        id: session.id,
        session_start: session.session_start,
        session_end: session.session_end,
        student_name: session.student?.[0]?.name,
        unassigned_name: session.unassigned_name,
        status: session.status,
        color: session.status === 'confirmed' ? '#3b82f6' : '#eab308', // Blue for confirmed, yellow for pending
        duration: 0 // Calculated later
      })) as SessionWithStudent[];
    },
    enabled: open,
  });

  // Convert booking slots to calendar events (green for available slots)
  const availabilityEvents: FullCalendarEvent[] = useMemo(() => {
    if (!bookingSlots.length || !tutorTimezone) return [];

    return bookingSlots
      .filter(slot => slot.is_active)
      .map(slot => ({
        id: `slot-${slot.id}`,
        title: 'Available',
        start: new Date(slot.start_time),
        end: new Date(slot.end_time),
        backgroundColor: '#10B981',
        borderColor: '#059669',
        textColor: '#FFFFFF',
        className: 'available-slot',
        display: 'block'
      }));
  }, [bookingSlots, tutorTimezone]);

  // Convert sessions to calendar events (red/blue for booked sessions)
  const sessionEvents: FullCalendarEvent[] = useMemo(() => {
    if (!sessions.length || !tutorTimezone) return [];

    return sessions.map(session => ({
      id: `session-${session.id}`,
      title: session.student_name || session.unassigned_name || 'Booked Session',
      start: new Date(session.session_start),
      end: new Date(session.session_end),
      backgroundColor: session.status === 'pending' ? '#F59E0B' : session.color,
      borderColor: session.status === 'pending' ? '#D97706' : session.color,
      textColor: '#FFFFFF',
      className: 'booked-session'
    }));
  }, [sessions, tutorTimezone]);

  // Combine all events
  const allEvents = [...availabilityEvents, ...sessionEvents];

  // Handle time slot selection
  const handleSelect = (selectInfo: any) => {
    console.log('🎯 Time slot selected:', selectInfo);

    if (!tutorTimezone) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Timezone not available. Please try again.",
      });
      return;
    }

    const start = selectInfo.start;
    const end = selectInfo.end;

    // Check for overlaps with existing active slots
    const hasOverlap = bookingSlots.some((slot) => {
      if (!slot.is_active) return false;
      
      const slotStart = parseISO(slot.start_time);
      const slotEnd = parseISO(slot.end_time);
      
      return (
        isWithinInterval(start, { start: slotStart, end: slotEnd }) ||
        isWithinInterval(end, { start: slotStart, end: slotEnd }) ||
        isWithinInterval(slotStart, { start: start, end: end })
      );
    });

    if (hasOverlap) {
      toast({
        variant: "destructive",
        title: "Overlap Detected",
        description: "Selected time overlaps with an existing availability slot.",
      });
      // Clear the selection
      if (calendarRef.current) {
        calendarRef.current.getApi().unselect();
      }
      return;
    }

    // Check for overlaps with existing sessions
    const hasSessionOverlap = sessions.some((session) => {
      const sessionStart = new Date(session.session_start);
      const sessionEnd = new Date(session.session_end);
      
      return (
        isWithinInterval(start, { start: sessionStart, end: sessionEnd }) ||
        isWithinInterval(end, { start: sessionStart, end: sessionEnd }) ||
        isWithinInterval(sessionStart, { start: start, end: end })
      );
    });

    if (hasSessionOverlap) {
      toast({
        variant: "destructive",
        title: "Time Unavailable",
        description: "Selected time conflicts with an existing session.",
      });
      // Clear the selection
      if (calendarRef.current) {
        calendarRef.current.getApi().unselect();
      }
      return;
    }

    // Convert to local time for display
    const startLocal = dayjs(start).tz(tutorTimezone).format('YYYY-MM-DD HH:mm');
    const endLocal = dayjs(end).tz(tutorTimezone).format('YYYY-MM-DD HH:mm');

    setSelectedSlot({
      start,
      end,
      startLocal,
      endLocal
    });

    console.log('✅ Valid slot selected:', {
      start: start.toISOString(),
      end: end.toISOString(),
      startLocal,
      endLocal,
      duration: dayjs(end).diff(dayjs(start), 'minutes')
    });
  };

  // Handle slot confirmation
  const handleConfirmSlot = async () => {
    if (!selectedSlot) return;

    setIsSubmitting(true);

    try {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const { error } = await supabase
        .from("booking_slots")
        .insert({
          tutor_id: tutorId,
          start_time: selectedSlot.start.toISOString(),
          end_time: selectedSlot.end.toISOString(),
          is_active: true,
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Slot Added",
        description: "New availability slot has been created successfully.",
      });

      // Refresh data and close modal
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      onSlotAdded();
      handleCancel();

    } catch (error: any) {
      console.error('Error adding slot:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add slot. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel/reset
  const handleCancel = () => {
    setSelectedSlot(null);
    if (calendarRef.current) {
      calendarRef.current.getApi().unselect();
    }
    onOpenChange(false);
  };

  // Reset selection
  const handleResetSelection = () => {
    setSelectedSlot(null);
    if (calendarRef.current) {
      calendarRef.current.getApi().unselect();
    }
  };

  // Clear selection when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedSlot(null);
      setIsFullScreen(false);
    }
  }, [open]);

  if (!tutorTimezone) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${isFullScreen ? 'max-w-[95vw] max-h-[95vh]' : 'sm:max-w-[900px] max-h-[80vh]'} p-0`}>
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Add Availability Slot
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Select value={calendarView} onValueChange={(value: any) => setCalendarView(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timeGridWeek">Week</SelectItem>
                  <SelectItem value="timeGridDay">Day</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullScreen(!isFullScreen)}
              >
                {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Click and drag to select an available time slot. Green blocks show existing availability, colored blocks show booked sessions.
          </p>
        </DialogHeader>

        <div className="flex-1 p-6 pt-2 overflow-hidden">
          {/* Selected slot confirmation bar */}
          {selectedSlot && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">
                      Selected Time Slot
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                      {selectedSlot.startLocal} - {selectedSlot.endLocal}
                      <span className="ml-2 text-xs">
                        ({dayjs(selectedSlot.end).diff(dayjs(selectedSlot.start), 'minutes')} minutes)
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetSelection}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmSlot}
                    disabled={isSubmitting}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {isSubmitting ? 'Adding...' : 'Add Slot'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mb-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Available Slots</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>Booked Sessions</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>Pending Requests</span>
            </div>
          </div>

          {/* Calendar */}
          <div className="h-[500px] overflow-hidden rounded-lg border">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin]}
              initialView={calendarView}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: ''
              }}
              height="100%"
              events={allEvents}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              select={handleSelect}
              timeZone={tutorTimezone}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              slotDuration="00:15:00"
              snapDuration="00:15:00"
              selectConstraint={{
                start: '06:00',
                end: '22:00'
              }}
              businessHours={{
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                startTime: '06:00',
                endTime: '22:00'
              }}
              eventClick={(info) => {
                // Prevent default behavior for existing events
                info.jsEvent.preventDefault();
              }}
              selectAllow={(selectInfo) => {
                // Only allow selections that are at least 15 minutes
                const duration = dayjs(selectInfo.end).diff(dayjs(selectInfo.start), 'minutes');
                return duration >= 15;
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-2 border-t">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}