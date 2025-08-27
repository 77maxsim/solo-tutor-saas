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
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { TimePicker } from "@/components/ui/time-picker";
import { useTimezone } from "@/contexts/TimezoneContext";
import { formatUtcToTutorTimezone, calculateDurationMinutes } from "@/lib/dateUtils";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const editSessionSchema = z.object({
  student_id: z.string().min(1, "Please select a student"),
  time: z.string().min(1, "Please select a time"),
  duration: z.number().min(15, "Duration must be at least 15 minutes"),
  rate: z.number().min(0, "Rate must be 0 or greater"),
  color: z.string(),
});

type EditSessionForm = z.infer<typeof editSessionSchema>;

interface SessionData {
  id: string;
  student_id: string;
  student_name?: string;
  session_start: string;
  session_end: string;
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
  const [rateInput, setRateInput] = useState("");
  const [rateDirty, setRateDirty] = useState(false);
  const [suggestedRate, setSuggestedRate] = useState<{ value: number; studentName: string } | null>(null);
  const [originalStudentId, setOriginalStudentId] = useState<string>("");
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

  // Fetch students for the current tutor
  const { data: students = [], isLoading: isStudentsLoading } = useQuery({
    queryKey: ['tutor-students'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get tutor_id first
      const { data: tutorData } = await supabase
        .from('tutors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!tutorData) throw new Error('Tutor record not found');

      const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .eq('tutor_id', tutorData.id)
        .order('name');

      if (error) {
        console.error('Error fetching students:', error);
        return [];
      }

      return data || [];
    },
  });

  const form = useForm<EditSessionForm>({
    resolver: zodResolver(editSessionSchema),
    defaultValues: {
      student_id: "",
      time: "",
      duration: 60,
      rate: 0,
      color: "#3B82F6",
    },
  });

  // Handle rate input changes
  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/^0+(?=\d)/, ""); // remove leading zeros
    if (/^\d*\.?\d*$/.test(val)) { // allow decimal numbers
      setRateInput(val);
      form.setValue('rate', parseFloat(val) || 0);
      setRateDirty(true); // Mark rate as manually modified
      setSuggestedRate(null); // Clear any suggestion UI
    }
  };

  // Prefill form when editing a session
  useEffect(() => {
    if (session && open && tutorTimezone && session.session_start) {
      console.log('✅ Bug 4 fixed - Prefilling edit session form:', {
        session_id: session.id,
        session_start: session.session_start,
        time: formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'HH:mm'),
        duration: session.duration,
        rate: session.rate,
        color: session.color,
        tutor_timezone: tutorTimezone,
        is_recurring: isRecurring
      });

      // Reset form first to clear any previous values
      form.reset({
        student_id: session.student_id || "",
        time: formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'HH:mm'),
        duration: session.duration || 60,
        rate: session.rate || 0,
        color: session.color || "#3B82F6",
      });

      // Set the rate input value and reset dirty states
      setRateInput(session.rate?.toString() || "");
      setRateDirty(false);
      setSuggestedRate(null);
      setOriginalStudentId(session.student_id || "");
    }
  }, [session, open, form, tutorTimezone, isRecurring]);

  // Handle student change and auto-prefill rate
  useEffect(() => {
    const fetchStudentLastRate = async (studentId: string) => {
      try {
        console.log('🔍 Fetching last rate for student:', studentId);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('❌ No user found');
          return;
        }

        // Get tutor_id first
        const { data: tutorData } = await supabase
          .from('tutors')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!tutorData) {
          console.log('❌ No tutor data found');
          return;
        }

        console.log('🔍 Querying sessions for tutor_id:', tutorData.id, 'student_id:', studentId);

        const { data, error } = await supabase
          .from('sessions')
          .select('rate_per_hour, session_start')
          .eq('tutor_id', tutorData.id)
          .eq('student_id', studentId)
          .not('rate_per_hour', 'is', null)
          .order('session_start', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching student last rate:', error);
          return;
        }

        console.log('💰 Found rate data:', data);

        if (data?.rate_per_hour) {
          // Find student name
          const student = students.find(s => s.id === studentId);
          const studentName = student?.name || 'this student';
          
          console.log('✅ Setting rate to:', data.rate_per_hour, 'for student:', studentName);
          
          // Set the rate and show suggestion
          setRateInput(data.rate_per_hour.toString());
          form.setValue('rate', data.rate_per_hour);
          setSuggestedRate({ value: data.rate_per_hour, studentName });
        } else {
          console.log('❌ No rate data found for student');
        }
      } catch (error) {
        console.error('Error fetching student last rate:', error);
      }
    };

    // Watch for student_id changes in the form
    const subscription = form.watch((value, { name }) => {
      if (name === 'student_id' && value.student_id) {
        const selectedStudentId = value.student_id;
        
        console.log('🔄 Student changed in edit modal:', {
          selectedStudentId,
          originalStudentId,
          rateDirty,
          isDifferentStudent: selectedStudentId !== originalStudentId
        });
        
        // Only auto-prefill if:
        // 1. Rate hasn't been manually modified
        // 2. Student is different from the original (to allow changing to different students)
        // 3. We have a valid student ID
        if (!rateDirty && selectedStudentId !== originalStudentId && selectedStudentId) {
          console.log('✅ Conditions met, fetching rate for student:', selectedStudentId);
          fetchStudentLastRate(selectedStudentId);
        } else {
          console.log('❌ Conditions not met for auto-prefill:', {
            rateDirty,
            isDifferent: selectedStudentId !== originalStudentId,
            hasStudentId: !!selectedStudentId
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form, rateDirty, originalStudentId, students]);

  // Helper function to convert local time to UTC
  const convertToUTC = (existingDate: string, localTime: string, timezone: string) => {
    const datetimeStr = `${existingDate} ${localTime}`;
    const utcTimestamp = dayjs.tz(datetimeStr, timezone).utc();

    console.log('🌍 Converting to UTC for edit:', {
      existing_date: existingDate,
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
      if (isRecurring && session.recurrence_id) {
        // For recurring sessions, update all future sessions in the series
        console.log('📅 Bulk updating future sessions in series:', {
          recurrence_id: session.recurrence_id,
          session_start_threshold: session.session_start,
          updates: {
            duration: data.duration,
            rate: data.rate,
            color: data.color
          }
        });

        const { error } = await supabase
          .from('sessions')
          .update({
            student_id: data.student_id,
            duration: data.duration,
            rate: data.rate,
            color: data.color,
          })
          .eq('recurrence_id', session.recurrence_id)
          .gte('session_start', session.session_start);

        if (error) {
          console.error('Supabase error updating future sessions:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update future sessions. Please try again.",
          });
          return;
        }

        toast({
          title: "Future Sessions Updated",
          description: "All future sessions in the series have been updated successfully.",
        });
      } else {
        // For single session, update with time change
        const startUTC = dayjs.utc(session.session_start).tz(tutorTimezone).hour(parseInt(data.time.split(':')[0])).minute(parseInt(data.time.split(':')[1])).utc();
        const endUTC = startUTC.add(data.duration, 'minutes');

        console.log('📅 Edit single session - local to UTC conversion:', {
          session_id: session.id,
          existing_date: session.session_start ? dayjs.utc(session.session_start).tz(tutorTimezone).format('YYYY-MM-DD') : 'N/A',
          selected_time: data.time,
          tutor_timezone: tutorTimezone,
          start_utc: startUTC.toISOString(),
          end_utc: endUTC.toISOString(),
          duration_minutes: data.duration,
          verification: {
            will_display_as: startUTC.tz(tutorTimezone).format('YYYY-MM-DD HH:mm'),
            original_input: `${session.session_start} ${data.time}`
          }
        });

        const { error } = await supabase
          .from('sessions')
          .update({
            student_id: data.student_id,
            session_start: startUTC.toISOString(),
            session_end: endUTC.toISOString(),
            duration: data.duration,
            rate: data.rate,
            color: data.color,
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
          title: "Session Updated",
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
        setRateInput("");
        setRateDirty(false);
        setSuggestedRate(null);
        setOriginalStudentId("");
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

  const handleDeleteSession = () => {
    deleteSessionMutation.mutate();
  };

  const deleteSessionMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('No session to delete');
      
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', session.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      toast({
        title: "Session deleted",
        description: "The session has been successfully deleted.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCancel = () => {
    form.reset();
    setRateInput("");
    setRateDirty(false);
    setSuggestedRate(null);
    setOriginalStudentId("");
    onOpenChange(false);
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>
            {isRecurring ? "Edit Future Sessions" : "Edit Session"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Time - Hide for recurring sessions since we can't change time for bulk updates */}
            {!isRecurring && (
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
            )}

            {/* Student Selector */}
            <FormField
              control={form.control}
              name="student_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isStudentsLoading ? (
                        <SelectItem value="" disabled>Loading students...</SelectItem>
                      ) : students.length === 0 ? (
                        <SelectItem value="" disabled>No students found</SelectItem>
                      ) : (
                        students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Only students you teach are listed.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Duration */}
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (minutes)</FormLabel>
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

            {/* Rate */}
            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate (per hour in {tutorPreferences.currency})</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={rateInput}
                      onChange={handleRateChange}
                      placeholder="Enter hourly rate"
                      onFocus={(e) => {
                        // Select all text when focused for easy replacement
                        e.target.select();
                      }}
                    />
                  </FormControl>
                  {/* Rate suggestion UI */}
                  {suggestedRate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>Suggested: {tutorPreferences.currency === 'USD' ? '$' : tutorPreferences.currency}{suggestedRate.value} from last session with {suggestedRate.studentName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          // Restore original rate
                          const originalRate = session?.rate?.toString() || "";
                          setRateInput(originalRate);
                          form.setValue('rate', session?.rate || 0);
                          setRateDirty(true);
                          setSuggestedRate(null);
                        }}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        Undo
                      </button>
                    </p>
                  )}
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

            {/* Recurring session warning */}
            {isRecurring && session && session.recurrence_id && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <strong>Bulk Edit Mode:</strong> Changes will apply to all future sessions in this recurring series (including this one).
              </div>
            )}
            
            {!isRecurring && session && session.recurrence_id && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                This session is part of a recurring series. Only this individual session will be updated.
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <ConfirmActionModal
            trigger={
              <Button
                type="button"
                variant="destructive"
                disabled={deleteSessionMutation.isPending}
              >
                {deleteSessionMutation.isPending ? "Deleting..." : "Delete Session"}
              </Button>
            }
            title="Delete Session"
            description="Are you sure you want to delete this session? This action cannot be undone."
            confirmText="Delete Session"
            onConfirm={handleDeleteSession}
            isDestructive={true}
            disabled={deleteSessionMutation.isPending}
          />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Session"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}