import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { TimePicker } from "@/components/ui/time-picker";
import { useTimezone } from "@/contexts/TimezoneContext";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const editSessionSchema = z.object({
  studentId: z.string().min(1, "Please select a student"),
  date: z.date({
    required_error: "Please select a date",
  }),
  time: z.string().min(1, "Please select a time"),
  duration: z.number().min(15, "Duration must be at least 15 minutes"),
  rate: z.number().min(0, "Rate must be 0 or greater"),
  color: z.string(),
  notes: z.string().optional(),
  applyToSeries: z.boolean().default(false),
});

type EditSessionForm = z.infer<typeof editSessionSchema>;

interface Student {
  id: string;
  name: string;
}

interface SessionData {
  id: string;
  student_id: string;
  student_name?: string;
  date: string;
  time: string;
  session_start?: string;
  session_end?: string;
  duration: number;
  rate: number;
  notes?: string;
  color?: string;
  recurrence_id?: string;
}

interface EditSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: SessionData | null;
  isRecurring?: boolean;
}

export function EditSessionModal({ open, onOpenChange, session, isRecurring = false }: EditSessionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tutorTimezone } = useTimezone();

  // Fetch tutor's currency and time format preferences
  const { data: tutorPreferences = { currency: 'USD', time_format: '24h' } } = useQuery({
    queryKey: ['tutor-preferences'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('currency, time_format')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor preferences:', error);
        return { currency: 'USD', time_format: '24h' };
      }

      return {
        currency: data?.currency || 'USD',
        time_format: data?.time_format || '24h'
      };
    },
  });

  // Fetch students from Supabase for current user
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .eq('tutor_id', tutorId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching students:', error);
        throw error;
      }

      return data as Student[];
    },
  });

  const form = useForm<EditSessionForm>({
    resolver: zodResolver(editSessionSchema),
    defaultValues: {
      studentId: "",
      date: undefined,
      time: "",
      duration: 60,
      rate: 0,
      color: "#3B82F6",
      notes: "",
      applyToSeries: false,
    },
  });

  // Prefill form when editing a session
  useEffect(() => {
    if (session && open && tutorTimezone) {
      console.log('🕐 Loading session for editing:', {
        session_id: session.id,
        date: session.date,
        time: session.time,
        tutor_timezone: tutorTimezone,
        is_recurring: isRecurring
      });
      
      form.setValue('studentId', session.student_id);
      form.setValue('date', new Date(session.date));
      form.setValue('time', session.time);
      form.setValue('duration', session.duration);
      form.setValue('rate', session.rate);
      form.setValue('color', session.color || "#3B82F6");
      form.setValue('notes', session.notes || "");
      form.setValue('applyToSeries', false);
      
      // Show notes section if there are notes
      if (session.notes) {
        setShowNotes(true);
      }
    }
  }, [session, open, form, tutorTimezone, isRecurring]);

  // Helper function to convert local time to UTC
  const convertToUTC = (localDate: Date, localTime: string, timezone: string) => {
    const dateStr = format(localDate, "yyyy-MM-dd");
    const datetimeStr = `${dateStr} ${localTime}`;
    const utcTimestamp = dayjs.tz(datetimeStr, timezone).utc();
    
    console.log('🌍 Converting to UTC for edit:', {
      local_date: dateStr,
      local_time: localTime,
      timezone: timezone,
      combined_local: datetimeStr,
      converted_utc: utcTimestamp.toISOString()
    });
    
    return utcTimestamp;
  };

  const onSubmit = async (data: EditSessionForm) => {
    setIsSubmitting(true);
    
    if (!tutorTimezone || !session) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Session data or timezone not available.",
      });
      setIsSubmitting(false);
      return;
    }
    
    try {
      // Convert local datetime to UTC for storage
      const startUTC = convertToUTC(data.date, data.time, tutorTimezone);
      const endUTC = startUTC.add(data.duration, 'minutes');

      console.log('📅 Editing session datetime conversion:', {
        session_id: session.id,
        selected_date: format(data.date, "yyyy-MM-dd"),
        selected_time: data.time,
        tutor_timezone: tutorTimezone,
        start_utc: startUTC.toISOString(),
        end_utc: endUTC.toISOString(),
        duration_minutes: data.duration,
        is_recurring: isRecurring,
        apply_to_series: data.applyToSeries
      });

      if (isRecurring && data.applyToSeries && session.recurrence_id) {
        // Update all future sessions in the series
        const { error } = await supabase
          .from('sessions')
          .update({
            student_id: data.studentId,
            session_start: startUTC.toISOString(),
            session_end: endUTC.toISOString(),
            date: format(data.date, "yyyy-MM-dd"),
            time: data.time,
            duration: data.duration,
            rate: data.rate,
            color: data.color,
            notes: data.notes || null,
          })
          .eq('recurrence_id', session.recurrence_id)
          .gte('date', format(new Date(), 'yyyy-MM-dd')); // Only future sessions

        if (error) {
          console.error('Supabase error updating series:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update recurring sessions. Please try again.",
          });
          return;
        }

        toast({
          title: "✅ Series Updated!",
          description: "All future sessions in this series have been updated successfully.",
        });
      } else {
        // Update single session
        const { error } = await supabase
          .from('sessions')
          .update({
            student_id: data.studentId,
            session_start: startUTC.toISOString(),
            session_end: endUTC.toISOString(),
            date: format(data.date, "yyyy-MM-dd"),
            time: data.time,
            duration: data.duration,
            rate: data.rate,
            color: data.color,
            notes: data.notes || null,
          })
          .eq('id', session.id);

        if (error) {
          console.error('Supabase error updating session:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update session. Please try again.",
          });
          return;
        }

        toast({
          title: "✅ Session Updated!",
          description: "Session has been updated successfully.",
        });
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['student-session-history'] });
      
      // Reset form and close modal
      setTimeout(() => {
        form.reset();
        setShowNotes(false);
        onOpenChange(false);
      }, 100);

    } catch (error) {
      console.error('Error updating session:', error);
      toast({
        variant: "destructive", 
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    setShowNotes(false);
    onOpenChange(false);
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] w-[95vw] sm:w-full flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 p-4 sm:p-6 pb-2">
          <DialogTitle className="text-lg">
            {isRecurring ? "Edit Recurring Sessions" : "Edit Session"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isRecurring 
              ? "Update this session and optionally apply changes to future sessions in the series."
              : "Update the session details below."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-2 overflow-y-auto flex-1 min-h-0 px-4 sm:px-6 pb-2">
              {/* Student Selection */}
              <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student</FormLabel>
                    <FormControl className="flex-1">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder={studentsLoading ? "Loading students..." : "Select a student"} />
                        </SelectTrigger>
                        <SelectContent>
                          {students && students.length > 0 ? (
                            students.map((student) => (
                              <SelectItem key={student.id} value={student.id}>
                                {student.name}
                              </SelectItem>
                            ))
                          ) : (
                            !studentsLoading && (
                              <div className="p-2 text-sm text-muted-foreground">
                                No students found.
                              </div>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date Selection */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Time and Duration */}
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <TimePicker 
                          value={field.value} 
                          onChange={field.onChange}
                          timeFormat={tutorPreferences.time_format}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="15"
                          step="15"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Rate */}
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate ({tutorPreferences.currency})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Session Color */}
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Color</FormLabel>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { color: "#3B82F6", name: "Blue" },
                        { color: "#F87171", name: "Red" },
                        { color: "#34D399", name: "Green" },
                        { color: "#FBBF24", name: "Yellow" },
                        { color: "#A78BFA", name: "Purple" },
                        { color: "#6B7280", name: "Gray" },
                      ].map((colorOption) => (
                        <button
                          key={colorOption.color}
                          type="button"
                          onClick={() => field.onChange(colorOption.color)}
                          className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                            field.value === colorOption.color 
                              ? 'border-gray-900 dark:border-gray-100 ring-2 ring-offset-2 ring-gray-400 scale-110' 
                              : 'border-gray-300 dark:border-gray-600 hover:border-gray-500'
                          }`}
                          style={{ backgroundColor: colorOption.color }}
                          title={colorOption.name}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <div className="space-y-2">
                {!showNotes ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNotes(true)}
                    className="w-full"
                  >
                    Add Notes
                  </Button>
                ) : (
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any notes about this session..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Apply to Series Checkbox */}
              {isRecurring && session.recurrence_id && (
                <FormField
                  control={form.control}
                  name="applyToSeries"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Apply changes to all future sessions in this series
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter className="shrink-0 p-4 sm:p-6 pt-3 gap-2 border-t bg-white">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none">
                {isSubmitting ? "Updating..." : "Update Session"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}