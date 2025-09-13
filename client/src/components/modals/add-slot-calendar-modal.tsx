import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
import AvailabilityGrid, { LocalRange } from '@/components/availability/AvailabilityGrid';
import { createAvailabilitySlots, normalizeToSlotGranularity, validateRangesNoOverlap } from '@/services/availability';
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
  const [selectedSlots, setSelectedSlots] = useState<LocalRange[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<BookingSlot | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
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

  // Edit form for slot editing
  const editForm = useForm<SlotFormData>({
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
        className: 'slot-event editable-slot',
        display: 'block',
        extendedProps: {
          slotData: slot,
          type: 'availability'
        }
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

  // Convert data to LocalRange format for AvailabilityGrid
  const bookedRangesLocal: LocalRange[] = useMemo(() => {
    if (!existingSessions.length || !tutorTimezone) return [];
    return existingSessions
      .filter(session => session.status === 'confirmed')
      .map(session => ({
        startLocal: dayjs.utc(session.session_start).tz(tutorTimezone).toDate(),
        endLocal: dayjs.utc(session.session_end).tz(tutorTimezone).toDate()
      }));
  }, [existingSessions, tutorTimezone]);

  const pendingRangesLocal: LocalRange[] = useMemo(() => {
    if (!existingSessions.length || !tutorTimezone) return [];
    return existingSessions
      .filter(session => session.status === 'pending')
      .map(session => ({
        startLocal: dayjs.utc(session.session_start).tz(tutorTimezone).toDate(),
        endLocal: dayjs.utc(session.session_end).tz(tutorTimezone).toDate()
      }));
  }, [existingSessions, tutorTimezone]);

  const existingAvailabilityLocal: LocalRange[] = useMemo(() => {
    if (!bookingSlots.length || !tutorTimezone) return [];
    return bookingSlots
      .filter(slot => slot.is_active)
      .map(slot => ({
        startLocal: dayjs.utc(slot.start_time).tz(tutorTimezone).toDate(),
        endLocal: dayjs.utc(slot.end_time).tz(tutorTimezone).toDate()
      }));
  }, [bookingSlots, tutorTimezone]);

  // Multi-select handlers
  const overlaps = useCallback((a: LocalRange, b: LocalRange) => 
    a.startLocal < b.endLocal && b.startLocal < a.endLocal, []);

  const collidesWithSystemRanges = useCallback((r: LocalRange) => {
    const allSystemRanges = [
      ...bookedRangesLocal,
      ...pendingRangesLocal,
      ...existingAvailabilityLocal,
    ];
    return allSystemRanges.some((x) => overlaps(r, x));
  }, [bookedRangesLocal, pendingRangesLocal, existingAvailabilityLocal, overlaps]);

  const collidesWithSelected = useCallback((r: LocalRange) =>
    selectedSlots.some((x) => overlaps(r, x)), [selectedSlots, overlaps]);

  const onProposedRange = useCallback((r: LocalRange) => {
    const norm = normalizeToSlotGranularity(r);
    if (norm.endLocal <= norm.startLocal) {
      toast({
        variant: "destructive",
        title: "Invalid Range",
        description: "Please select a valid time range."
      });
      return;
    }
    if (collidesWithSystemRanges(norm)) {
      toast({
        variant: "destructive",
        title: "Time Conflict",
        description: "That range overlaps an existing or booked slot."
      });
      return;
    }
    if (collidesWithSelected(norm)) {
      toast({
        variant: "destructive",
        title: "Selection Conflict",
        description: "That range overlaps one you already selected."
      });
      return;
    }
    // Check for exact duplicate
    if (selectedSlots.some(x => 
      x.startLocal.getTime() === norm.startLocal.getTime() &&
      x.endLocal.getTime() === norm.endLocal.getTime()
    )) {
      toast({
        title: "Already Selected",
        description: "This range is already in your selection."
      });
      return;
    }
    setSelectedSlots(prev => [...prev, norm].sort((a, b) => +a.startLocal - +b.startLocal));
  }, [selectedSlots, collidesWithSystemRanges, collidesWithSelected, toast]);

  const removeSelected = useCallback((idx: number) =>
    setSelectedSlots(prev => prev.filter((_, i) => i !== idx)), []);

  const clearSelection = useCallback(() => setSelectedSlots([]), []);

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

  // Handle slot click for editing
  const handleSlotClick = (clickInfo: any) => {
    const eventType = clickInfo.event.extendedProps?.type;
    if (eventType === 'availability') {
      const slotData = clickInfo.event.extendedProps?.slotData;
      if (slotData) {
        setEditingSlot(slotData);
        // Set form values for editing
        const startLocal = dayjs.utc(slotData.start_time).tz(tutorTimezone as string || 'UTC').format('YYYY-MM-DDTHH:mm');
        const endLocal = dayjs.utc(slotData.end_time).tz(tutorTimezone as string || 'UTC').format('YYYY-MM-DDTHH:mm');
        editForm.setValue('startTime', startLocal);
        editForm.setValue('endTime', endLocal);
        setShowEditModal(true);
      }
    }
  };

  // Handle slot drag/resize
  const handleEventChange = async (changeInfo: any) => {
    const eventType = changeInfo.event.extendedProps?.type;
    if (eventType === 'availability') {
      const slotData = changeInfo.event.extendedProps?.slotData;
      if (slotData) {
        try {
          // Convert back to UTC for storage
          const startUtc = dayjs(changeInfo.event.start).utc().toISOString();
          const endUtc = dayjs(changeInfo.event.end).utc().toISOString();

          const { error } = await supabase
            .from("booking_slots")
            .update({
              start_time: startUtc,
              end_time: endUtc,
            })
            .eq("id", slotData.id);

          if (error) throw error;

          toast({
            title: "Slot updated!",
            description: "Your availability slot has been moved.",
          });

          // Refresh data
          queryClient.invalidateQueries({ queryKey: ["booking-slots"] });

        } catch (error) {
          // Revert the change
          changeInfo.revert();
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update slot.",
          });
        }
      }
    }
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
    const startLocal = dayjs(start).tz(tutorTimezone || 'UTC').format('YYYY-MM-DD HH:mm');
    const endLocal = dayjs(end).tz(tutorTimezone || 'UTC').format('YYYY-MM-DD HH:mm');

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
      const startUtc = dayjs.tz(data.startTime, tutorTimezone || 'UTC').utc().toISOString();
      const endUtc = dayjs.tz(data.endTime, tutorTimezone || 'UTC').utc().toISOString();

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

  // Handle multiple slots submission
  const handleAddMultipleSlots = async () => {
    if (selectedSlots.length === 0) return;
    
    setIsSubmitting(true);
    
    try {
      const { error } = await createAvailabilitySlots(selectedSlots, tutorTimezone || 'UTC');

      if (error) throw error;

      toast({
        title: "Availability slots added!",
        description: `Added ${selectedSlots.length} slot${selectedSlots.length > 1 ? 's' : ''} successfully.`,
      });

      // Refresh data and clear selection (keep modal open)
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      queryClient.invalidateQueries({ queryKey: ["sessions-for-availability"] });
      onSlotAdded();
      clearSelection();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add some slots. Please try again.",
      });
    }
    
    setIsSubmitting(false);
  };

  // Handle calendar slot submission (legacy for mobile)
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

      // Refresh data and close modal for mobile
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      onSlotAdded();
      onOpenChange(false); // Close modal for mobile

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add availability slot.",
      });
    }
    
    setIsSubmitting(false);
  };

  // Handle edit form submission
  const onEditSubmit = async (data: SlotFormData) => {
    if (!editingSlot) return;
    
    setIsSubmitting(true);
    
    try {
      // Convert local times to UTC
      const startUtc = dayjs.tz(data.startTime, tutorTimezone as string || 'UTC').utc().toISOString();
      const endUtc = dayjs.tz(data.endTime, tutorTimezone as string || 'UTC').utc().toISOString();

      const { error } = await supabase
        .from("booking_slots")
        .update({
          start_time: startUtc,
          end_time: endUtc,
        })
        .eq("id", editingSlot.id);

      if (error) throw error;

      toast({
        title: "Slot updated!",
        description: "Your availability slot has been updated.",
      });

      // Refresh data and close modal
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      setShowEditModal(false);
      setEditingSlot(null);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update availability slot.",
      });
    }
    
    setIsSubmitting(false);
  };

  // Handle slot deletion
  const handleDeleteSlot = async () => {
    if (!editingSlot) return;
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("booking_slots")
        .delete()
        .eq("id", editingSlot.id);

      if (error) throw error;

      toast({
        title: "Slot deleted!",
        description: "Your availability slot has been removed.",
      });

      // Refresh data and close modal
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      setShowEditModal(false);
      setEditingSlot(null);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete availability slot.",
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
    setSelectedSlots([]);
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
                    : "Click and drag to select multiple time slots. Select several ranges, then add them all at once. The modal stays open until you close it."
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
          // Desktop Calendar View with Multi-Select
          <div className="flex flex-col h-[80vh] max-h-[800px]">
            {/* Legend and View Controls */}
            <div className="px-6 py-4 border-b bg-gray-50 dark:bg-gray-900 flex-shrink-0">
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
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-400 rounded animate-pulse"></div>
                    <span className="text-sm">Selected</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar Grid - Fixed Height */}
            <div className="p-6 h-96 flex-shrink-0">
              <AvailabilityGrid
                weekStartLocal={new Date()}
                bookedRangesLocal={bookedRangesLocal}
                pendingRangesLocal={pendingRangesLocal}
                existingAvailabilityLocal={existingAvailabilityLocal}
                selectedRangesLocal={selectedSlots}
                onProposedRange={onProposedRange}
                tutorTimezone={tutorTimezone || 'UTC'}
              />
            </div>

            {/* Selection Summary - Scrollable with fixed max height */}
            <div className="px-6 py-2 border-t bg-gray-50 dark:bg-gray-900 flex-1 overflow-hidden flex flex-col">
              <h4 className="font-medium mb-2 flex-shrink-0">Selected Time Slots ({selectedSlots.length})</h4>
              <div className="flex-1 overflow-y-auto min-h-0">
                {selectedSlots.length > 0 ? (
                  <div className="space-y-1 pr-2">
                    {selectedSlots.map((range, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 rounded px-3 py-2 border">
                        <span>
                          {range.startLocal.toLocaleString([], { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })} – {range.endLocal.toLocaleString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                          onClick={() => removeSelected(i)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No ranges selected yet. Click and drag or click on time slots to select them.</p>
                )}
              </div>
            </div>
            
            {/* Fixed action footer - Always visible at bottom */}
            <div className="px-6 py-4 bg-white dark:bg-gray-900 border-t flex-shrink-0 flex justify-between items-center">
              <Button variant="outline" onClick={clearSelection} disabled={selectedSlots.length === 0}>
                Clear Selection
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button 
                  onClick={handleAddMultipleSlots} 
                  disabled={selectedSlots.length === 0 || isSubmitting}
                >
                  {isSubmitting ? "Adding..." : `Add ${selectedSlots.length > 0 ? `${selectedSlots.length} Slot${selectedSlots.length > 1 ? 's' : ''}` : 'Slot'}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Edit Slot Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Availability Slot</DialogTitle>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
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
                control={editForm.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field}
                        min={editForm.watch('startTime') || new Date().toISOString().slice(0, 16)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between pt-4">
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDeleteSlot}
                  disabled={isSubmitting}
                >
                  Delete Slot
                </Button>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}