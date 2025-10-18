import { useState, useEffect, useRef } from "react";
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
import { getCurrentTutorId } from "@/lib/tutorHelpers";
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
  student_id: string | null;
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
  const [userModifiedFields, setUserModifiedFields] = useState<Set<string>>(new Set());
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  
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
      
      // Mark rate as manually modified
      setUserModifiedFields(prev => new Set(prev).add('rate'));
      setPrefillNote(null); // Clear any prefill note
    }
  };

  // Fetch student's last session data (matching schedule modal pattern)
  const fetchStudentLastSession = async (studentId: string) => {
    try {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) return null;

      const { data, error } = await supabase
        .from('sessions')
        .select('rate, duration, session_start')
        .eq('student_id', studentId)
        .eq('tutor_id', tutorId)
        .order('session_start', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching student last session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Unexpected error fetching student session:', error);
      return null;
    }
  };

  // Handle student selection changes (matching schedule modal pattern)
  const handleStudentChange = async (studentId: string) => {
    // Update the student field
    form.setValue('student_id', studentId);
    
    // Fetch student's last session data
    const lastSession = await fetchStudentLastSession(studentId);
    
    if (lastSession) {
      // Only prefill rate if it hasn't been manually modified by the user
      if (!userModifiedFields.has('rate') && lastSession.rate !== null) {
        const rateValue = Number(lastSession.rate);
        form.setValue('rate', rateValue);
        setRateInput(rateValue.toString());
        setPrefillNote('Prefilled from last session with this student');
      }
    }
  };

  // Prefill form when editing a session
  useEffect(() => {
    if (session && open && tutorTimezone && session.session_start) {
      console.log('✅ EditSessionModal: Prefilling form with session data:', {
        session_id: session.id,
        session_start: session.session_start,
        time: formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'HH:mm'),
        duration: session.duration,
        rate: session.rate,
        color: session.color,
        tutor_timezone: tutorTimezone,
        is_recurring: isRecurring
      });

      const initialRate = session.rate || 0;
      const initialStudentId = session.student_id || "";

      // Reset form first to clear any previous values
      form.reset({
        student_id: initialStudentId,
        time: formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'HH:mm'),
        duration: session.duration || 60,
        rate: initialRate,
        color: session.color || "#3B82F6",
      });

      // Set initial state
      setRateInput(initialRate.toString());
      setUserModifiedFields(new Set());
      setPrefillNote(null);
    }
  }, [session, open, form, tutorTimezone, isRecurring]);



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
        // For recurring sessions, fetch all future sessions and update each with new time
        console.log('📅 Bulk updating future sessions in series:', {
          recurrence_id: session.recurrence_id,
          session_start_threshold: session.session_start,
          updates: {
            time: data.time,
            duration: data.duration,
            rate: data.rate,
            color: data.color
          }
        });

        // First, fetch all future sessions in the series
        const { data: futureSessions, error: fetchError } = await supabase
          .from('sessions')
          .select('id, session_start')
          .eq('recurrence_id', session.recurrence_id)
          .gte('session_start', session.session_start)
          .order('session_start', { ascending: true });

        if (fetchError) {
          console.error('Error fetching future sessions:', fetchError);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to fetch future sessions. Please try again.",
          });
          return;
        }

        // Update each session individually with the new time
        for (const futureSession of futureSessions || []) {
          // Extract the date from the existing session_start
          const sessionDate = dayjs.utc(futureSession.session_start).tz(tutorTimezone).format('YYYY-MM-DD');
          
          // Create new start time by combining the date with the new time
          const newStartUTC = dayjs.tz(`${sessionDate} ${data.time}`, tutorTimezone).utc();
          const newEndUTC = newStartUTC.add(data.duration, 'minutes');

          console.log('🕐 Updating session time:', {
            session_id: futureSession.id,
            original_start: futureSession.session_start,
            session_date: sessionDate,
            new_time: data.time,
            new_start_utc: newStartUTC.toISOString(),
            new_end_utc: newEndUTC.toISOString()
          });

          const { error: updateError } = await supabase
            .from('sessions')
            .update({
              student_id: data.student_id,
              session_start: newStartUTC.toISOString(),
              session_end: newEndUTC.toISOString(),
              duration: data.duration,
              rate: data.rate,
              color: data.color,
            })
            .eq('id', futureSession.id);

          if (updateError) {
            console.error('Error updating session:', updateError);
            toast({
              variant: "destructive",
              title: "Error",
              description: `Failed to update session ${futureSession.id}. Please try again.`,
            });
            return;
          }
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
        setUserModifiedFields(new Set());
        setPrefillNote(null);
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
    setUserModifiedFields(new Set());
    setPrefillNote(null);
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
            {/* Time */}
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

            {/* Student Selector */}
            <FormField
              control={form.control}
              name="student_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student</FormLabel>
                  <Select onValueChange={handleStudentChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isStudentsLoading ? (
                        <SelectItem value="loading" disabled>Loading students...</SelectItem>
                      ) : students.length === 0 ? (
                        <SelectItem value="no-students" disabled>No students found</SelectItem>
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
                  {/* Rate prefill note with undo */}
                  {prefillNote && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>Suggested: {tutorPreferences.currency === 'USD' ? '$' : tutorPreferences.currency}{form.watch('rate')} from last session • </span>
                      <button
                        type="button"
                        onClick={() => {
                          // Restore original rate from when modal opened
                          const originalRate = session?.rate || 0;
                          setRateInput(originalRate.toString());
                          form.setValue('rate', originalRate);
                          setUserModifiedFields(prev => new Set(prev).add('rate'));
                          setPrefillNote(null);
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