import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { Calendar, Clock, Plus, Trash2, ToggleLeft, ToggleRight, Share2 } from "lucide-react";
import { format, parseISO, isBefore, isAfter, isWithinInterval } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTimezone } from "@/contexts/TimezoneContext";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Form validation schema
const slotFormSchema = z.object({
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
}).refine((data) => {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  return isBefore(start, end);
}, {
  message: "Start time must be before end time",
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

export default function AvailabilityPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null);
  const [tutorId, setTutorId] = useState<string | null>(null);
  const { tutorTimezone } = useTimezone();

  // Fetch current tutor ID
  useEffect(() => {
    const fetchTutorId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: tutor, error } = await supabase
          .from('tutors')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching tutor:', error);
          return;
        }

        setTutorId(tutor.id);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchTutorId();
  }, []);

  const form = useForm<SlotFormData>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      startTime: "",
      endTime: "",
    },
  });

  // Fetch booking slots for the current tutor
  const { data: bookingSlots, isLoading, error } = useQuery({
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
  });

  // Add new booking slot mutation
  const addSlotMutation = useMutation({
    mutationFn: async (data: SlotFormData) => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error("User not authenticated");
      }

      // Get effective timezone - fetch from DB if context is not available
      let effectiveTimezone = tutorTimezone;
      
      if (!effectiveTimezone) {
        console.log('Timezone not available from context, fetching from database...');
        try {
          const { data: tutorData } = await supabase
            .from('tutors')
            .select('timezone')
            .eq('id', tutorId)
            .single();
          
          effectiveTimezone = tutorData?.timezone || 'Asia/Shanghai';
          console.log('Fetched timezone from database:', {
            contextTimezone: tutorTimezone,
            dbTimezone: tutorData?.timezone,
            effectiveTimezone
          });
        } catch (error) {
          console.error('Failed to fetch timezone from database:', error);
          effectiveTimezone = 'Asia/Shanghai';
        }
      }
      
      // Convert tutor's local time to UTC properly
      const startTimeUTC = dayjs.tz(data.startTime, effectiveTimezone).utc().toDate();
      const endTimeUTC = dayjs.tz(data.endTime, effectiveTimezone).utc().toDate();

      console.log('Slot creation timezone conversion:', {
        contextTimezone: tutorTimezone,
        effectiveTimezone,
        localStart: data.startTime,
        localEnd: data.endTime,
        utcStart: startTimeUTC.toISOString(),
        utcEnd: endTimeUTC.toISOString(),
        verificationLocal: dayjs.utc(startTimeUTC).tz(effectiveTimezone).format('YYYY-MM-DD HH:mm')
      });

      // Check for overlapping active slots
      if (bookingSlots) {
        const hasOverlap = bookingSlots.some((slot) => {
          if (!slot.is_active) return false;
          
          const slotStart = parseISO(slot.start_time);
          const slotEnd = parseISO(slot.end_time);
          
          return (
            isWithinInterval(startTimeUTC, { start: slotStart, end: slotEnd }) ||
            isWithinInterval(endTimeUTC, { start: slotStart, end: slotEnd }) ||
            isWithinInterval(slotStart, { start: startTimeUTC, end: endTimeUTC })
          );
        });

        if (hasOverlap) {
          throw new Error("New slot overlaps with an existing active slot");
        }
      }

      const { error: insertError } = await supabase
        .from("booking_slots")
        .insert({
          tutor_id: tutorId,
          start_time: startTimeUTC.toISOString(),
          end_time: endTimeUTC.toISOString(),
          is_active: true,
        });

      if (insertError) {
        throw insertError;
      }
    },
    onSuccess: () => {
      toast({
        title: "Slot Added",
        description: "New booking slot has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      setShowAddDialog(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Toggle slot active status mutation
  const toggleSlotMutation = useMutation({
    mutationFn: async ({ slotId, isActive }: { slotId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("booking_slots")
        .update({ is_active: isActive })
        .eq("id", slotId);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Slot Updated",
        description: "Booking slot status has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update slot status.",
      });
    },
  });

  // Delete slot mutation
  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from("booking_slots")
        .delete()
        .eq("id", slotId);

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Slot Deleted",
        description: "Booking slot has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      setDeleteSlotId(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete slot.",
      });
    },
  });

  const onSubmit = (data: SlotFormData) => {
    addSlotMutation.mutate(data);
  };

  const handleToggleSlot = (slotId: string, currentStatus: boolean) => {
    toggleSlotMutation.mutate({ slotId, isActive: !currentStatus });
  };

  const handleDeleteSlot = (slotId: string) => {
    deleteSlotMutation.mutate(slotId);
  };

  // Handle sharing booking link
  const handleShareBookingLink = async () => {
    if (!tutorId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to get tutor information.",
      });
      return;
    }

    const bookingUrl = `${window.location.origin}/booking/${tutorId}`;
    
    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast({
        title: "Booking link copied to clipboard!",
        description: "Share this link with students to let them book sessions.",
      });
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = bookingUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      toast({
        title: "Booking link copied to clipboard!",
        description: "Share this link with students to let them book sessions.",
      });
    }
  };

  // Generate default datetime values for form
  const getDefaultDateTime = (hoursOffset: number = 1) => {
    const date = new Date();
    date.setHours(date.getHours() + hoursOffset, 0, 0, 0);
    return date.toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (showAddDialog) {
      form.setValue("startTime", getDefaultDateTime(1));
      form.setValue("endTime", getDefaultDateTime(2));
    }
  }, [showAddDialog, form]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto">
        <header className="bg-white dark:bg-gray-900 border-b border-border px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                Availability Management
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your booking slots for public scheduling.
              </p>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-6 text-center">
          <div className="text-red-500 mb-2">Failed to load availability</div>
          <p className="text-sm text-muted-foreground">
            Please try refreshing the page or contact support if the problem persists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Availability Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your booking slots for public scheduling.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleShareBookingLink}
              variant="outline"
              size="sm"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              title="Copy your public booking link"
            >
              <Share2 className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Share Booking Link</span>
              <span className="sm:hidden">Share Link</span>
            </Button>
            
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Slot
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Booking Slot</DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addSlotMutation.isPending}
                      className="flex-1"
                    >
                      {addSlotMutation.isPending ? "Adding..." : "Add Slot"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {!bookingSlots || bookingSlots.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Booking Slots
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You haven't created any booking slots yet. Add your first slot to start accepting bookings.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Slot
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {bookingSlots.map((slot) => (
              <Card key={slot.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-gray-500" />
                      <div>
                        <div className="font-medium">
                          {dayjs.utc(slot.start_time).tz(tutorTimezone).format('dddd, MMMM D, YYYY')}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {dayjs.utc(slot.start_time).tz(tutorTimezone).format('h:mm A')} - {dayjs.utc(slot.end_time).tz(tutorTimezone).format('h:mm A')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={slot.is_active ? "default" : "secondary"}>
                        {slot.is_active ? "Active" : "Inactive"}
                      </Badge>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleSlot(slot.id, slot.is_active)}
                          disabled={toggleSlotMutation.isPending}
                          title={slot.is_active ? "Deactivate slot" : "Activate slot"}
                        >
                          {slot.is_active ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteSlotId(slot.id)}
                          disabled={deleteSlotMutation.isPending}
                          title="Delete slot"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSlotId} onOpenChange={() => setDeleteSlotId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking Slot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this booking slot? This action cannot be undone.
              Any pending bookings for this slot may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSlotId && handleDeleteSlot(deleteSlotId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}