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
  Minimize2,
  Smartphone
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

  // Reset form when modal opens
  useEffect(() => {
    if (open && isMobile) {
      const now = new Date();
      now.setMinutes(0, 0, 0); // Round to hour
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1);
      
      form.setValue('startTime', now.toISOString().slice(0, 16));
      form.setValue('endTime', nextHour.toISOString().slice(0, 16));
    }
  }, [open, isMobile, form]);

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
    queryKey: ["sessions-for-availability"],
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
    enabled: open && !isMobile,
  });

  // Convert booking slots to calendar events (green for available slots)
  const availabilityEvents: FullCalendarEvent[] = useMemo(() => {
    if (!bookingSlots.length || !tutorTimezone) return [];

    return bookingSlots
      .filter(slot => slot.is_active)
      .map(slot => ({
        id: `slot-${slot.id}`,
        title: 'Available',
        start: dayjs.utc(slot.start_time).tz(tutorTimezone).toDate(),
        end: dayjs.utc(slot.end_time).tz(tutorTimezone).toDate(),
        backgroundColor: '#10b981',
        borderColor: '#059669',
        textColor: 'white',
        className: 'slot-event',
        display: 'block'
      }));
  }, [bookingSlots, tutorTimezone]);

  // Convert sessions to calendar events (blue for booked, yellow for pending)
  const sessionEvents: FullCalendarEvent[] = useMemo(() => {
    if (!existingSessions.length || !tutorTimezone) return [];

    return existingSessions.map(session => ({
      id: `session-${session.id}`,
      title: session.student_name || session.unassigned_name || 'Booked Session',
      start: dayjs.utc(session.session_start).tz(tutorTimezone).toDate(),
      end: dayjs.utc(session.session_end).tz(tutorTimezone).toDate(),
      backgroundColor: session.color,
      borderColor: session.color,
      textColor: 'white',
      className: 'session-event',
      display: 'block'
    }));
  }, [existingSessions, tutorTimezone]);

  // Combine all events
  const allEvents = [...availabilityEvents, ...sessionEvents];

  // Check for overlaps with existing sessions
  const checkForOverlap = (start: Date, end: Date): boolean => {
    return existingSessions.some(session => {
      const sessionStart = new Date(session.session_start);
      const sessionEnd = new Date(session.session_end);
      
      return (
        (start >= sessionStart && start < sessionEnd) ||
        (end > sessionStart && end <= sessionEnd) ||
        (start <= sessionStart && end >= sessionEnd)
      );
    });
  };

  // Handle calendar time selection
  const handleSelect = (selectInfo: any) => {
    const start = selectInfo.start;
    const end = selectInfo.end;

    // Check for overlap with existing sessions
    if (checkForOverlap(start, end)) {
      toast({
        variant: "destructive",
        title: "Time Conflict",
        description: "This time overlaps with an existing session.",
      });
      
      // Clear the selection
      if (calendarRef.current) {
        calendarRef.current.getApi().unselect();
      }
      return;
    }

    // Convert to tutor's timezone for display
    const startLocal = dayjs(start).tz(tutorTimezone).format('YYYY-MM-DD HH:mm');
    const endLocal = dayjs(end).tz(tutorTimezone).format('YYYY-MM-DD HH:mm');

    setSelectedSlot({
      start,
      end,
      startLocal,
      endLocal
    });
  };

  // Handle form submission for mobile
  const onMobileSubmit = async (data: SlotFormData) => {
    setIsSubmitting(true);
    
    try {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error("User not authenticated");
      }

      // Convert local times to UTC
      const startUtc = dayjs.tz(data.startTime, tutorTimezone).utc().toISOString();
      const endUtc = dayjs.tz(data.endTime, tutorTimezone).utc().toISOString();

      const { error } = await supabase
        .from("booking_slots")
        .insert({
          tutor_id: tutorId,
          start_time: startUtc,
          end_time: endUtc,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Availability slot added!",
        description: "Your new time slot is now available for booking.",
      });

      // Refresh data and close modal
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      onSlotAdded();
      onOpenChange(false);
      form.reset();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add availability slot.",
      });
    }
    
    setIsSubmitting(false);
  };

  // Handle calendar slot submission
  const handleAddSlot = async () => {
    if (!selectedSlot) return;
    
    setIsSubmitting(true);
    
    try {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error("User not authenticated");
      }

      // Convert to UTC for storage
      const startUtc = dayjs(selectedSlot.start).utc().toISOString();
      const endUtc = dayjs(selectedSlot.end).utc().toISOString();

      const { error } = await supabase
        .from("booking_slots")
        .insert({
          tutor_id: tutorId,
          start_time: startUtc,
          end_time: endUtc,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Availability slot added!",
        description: "Your new time slot is now available for booking.",
      });

      // Refresh data and close modal
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      onSlotAdded();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add availability slot.",
      });
    }
    
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    setSelectedSlot(null);
    if (calendarRef.current) {
      calendarRef.current.getApi().unselect();
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleClearSelection = () => {
    setSelectedSlot(null);
    setIsFullScreen(false);
  };

  // Generate default datetime values for mobile form
  const getDefaultDateTime = (hoursOffset: number = 1) => {
    const date = new Date();
    date.setHours(date.getHours() + hoursOffset, 0, 0, 0);
    return date.toISOString().slice(0, 16);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-6xl w-full ${isFullScreen ? 'h-[95vh]' : 'max-h-[85vh]'} p-0 overflow-hidden`}>
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                {isMobile ? <Smartphone className="h-5 w-5 text-green-700 dark:text-green-300" /> : <CalendarIcon className="h-5 w-5 text-green-700 dark:text-green-300" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  Add Availability Slot
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {isMobile 
                    ? "Set your start and end times for student bookings."
                    : "Click and drag to select an available time slot. Green blocks show existing availability, colored blocks show booked sessions."
                  }
                </p>
              </div>
            </div>
            
            {!isMobile && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                >
                  {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {isMobile ? (
          // Mobile Form View
          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-sm">Available Slot</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-sm">Booked Sessions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span className="text-sm">Pending Requests</span>
                </div>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onMobileSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field}
                          min={form.watch('startTime') || new Date().toISOString().slice(0, 16)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Adding..." : "Add Slot"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        ) : (
          // Desktop Calendar View
          <div className="flex-1 overflow-hidden">
            {/* Legend and View Controls */}
            <div className="px-6 py-4 border-b bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-sm">Available Slots</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span className="text-sm">Booked Sessions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span className="text-sm">Pending Requests</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Select value={calendarView} onValueChange={(value: 'timeGridWeek' | 'timeGridDay') => setCalendarView(value)}>
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
                    onClick={() => {
                      if (calendarRef.current) {
                        calendarRef.current.getApi().today();
                      }
                    }}
                  >
                    Today
                  </Button>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className={`${isFullScreen ? 'h-[calc(95vh-200px)]' : 'h-[500px]'} p-4`}>
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin]}
                initialView={calendarView}
                headerToolbar={{
                  left: 'prev,next',
                  center: 'title',
                  right: ''
                }}
                height="100%"
                selectable={true}
                selectMirror={true}
                select={handleSelect}
                events={allEvents}
                slotMinTime="06:00:00"
                slotMaxTime="23:00:00"
                slotDuration="00:15:00"
                snapDuration="00:15:00"
                allDaySlot={false}
                selectAllow={(selectInfo) => {
                  const now = new Date();
                  return selectInfo.start >= now;
                }}
                timeZone={tutorTimezone}
                eventDisplay="block"
                eventOverlap={false}
                selectOverlap={false}
                eventInteractive={false}
                unselectAuto={false}
                eventClassNames="cursor-default"
              />
            </div>

            {/* Selected Slot Confirmation */}
            {selectedSlot && (
              <div className="px-6 py-4 border-t bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">Selected Time:</span>
                    </div>
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      {selectedSlot.startLocal} - {selectedSlot.endLocal}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleAddSlot}
                      disabled={isSubmitting}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {isSubmitting ? "Adding..." : "Add Slot"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="px-6 py-4 border-t">
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                {selectedSlot && (
                  <Button onClick={handleClearSelection} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear Selection
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}