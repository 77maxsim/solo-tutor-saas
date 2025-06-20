import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
import { CalendarIcon, Plus, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { TimePicker } from "@/components/ui/time-picker";
import { triggerSuccessConfetti, triggerStudentConfetti } from "@/lib/confetti";
import { formatTimeDisplay, parseTimeInput, generateTimeOptions } from "@/lib/timeFormat";

const scheduleSessionSchema = z.object({
  studentId: z.string().min(1, "Please select a student"),
  date: z.date({ required_error: "Date is required" }).refine((date) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    return date >= thirtyDaysAgo;
  }, "Sessions cannot be scheduled more than 30 days in the past"),
  time: z.string().min(1, "Time is required").regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:MM)"),
  duration: z.number().min(15, "Duration must be at least 15 minutes").max(480, "Duration cannot exceed 8 hours"),
  rate: z.number().min(0, "Rate must be a positive number"),
  color: z.string().default("#3B82F6"),
  repeatWeekly: z.boolean().default(false),
  repeatWeeks: z.number().min(1, "Must repeat for at least 1 week").max(12, "Cannot repeat for more than 12 weeks").optional(),
  notes: z.string().optional(),
  applyNotesToSeries: z.boolean().default(false),
}).refine((data) => {
  if (data.repeatWeekly && !data.repeatWeeks) {
    return false;
  }
  return true;
}, {
  message: "Please specify how many weeks to repeat",
  path: ["repeatWeeks"],
}).refine((data) => {
  if (data.repeatWeekly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return data.date >= today;
  }
  return true;
}, {
  message: "Recurring sessions can only be scheduled for today or future dates",
  path: ["date"],
});

type ScheduleSessionForm = z.infer<typeof scheduleSessionSchema>;

interface Student {
  id: string;
  name: string;
  created_at: string;
}

interface Session {
  id: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  notes?: string;
  color?: string;
  recurrence_id?: string;
  student_id: string;
}

interface ScheduleSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSession?: Session | null;
  editMode?: boolean;
}

export function ScheduleSessionModal({ open, onOpenChange, editSession, editMode = false }: ScheduleSessionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Track which fields user has manually modified to prevent overwriting
  const [userModifiedFields, setUserModifiedFields] = useState<Set<string>>(new Set());



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

  const tutorCurrency = tutorPreferences.currency;
  const timeFormat = tutorPreferences.time_format;

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

  // Add new student mutation
  const addStudentMutation = useMutation({
    mutationFn: async (name: string) => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const { data, error } = await supabase
        .from('students')
        .insert([{ 
          name: name.trim(),
          tutor_id: tutorId 
        }])
        .select()
        .single();

      if (error) {
        console.error('Error adding student:', error);
        throw error;
      }

      return data as Student;
    },
    onSuccess: (newStudent) => {
      // Trigger confetti for new student
      triggerStudentConfetti();
      
      // Refresh students list
      queryClient.invalidateQueries({ queryKey: ['students'] });
      
      // Auto-select the new student
      form.setValue('studentId', newStudent.id);
      
      // Reset add student form
      setNewStudentName("");
      setShowAddStudent(false);
      
      // Show success message
      toast({
        title: "🎓 Student added!",
        description: `${newStudent.name} has been added successfully.`,
      });
    },
    onError: (error) => {
      console.error('Error adding student:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add student. Please try again.",
      });
    },
  });

  const form = useForm<ScheduleSessionForm>({
    resolver: zodResolver(scheduleSessionSchema),
    defaultValues: {
      studentId: "",
      date: undefined,
      time: "",
      duration: 60,
      rate: 0,
      color: "#3B82F6",
      repeatWeekly: false,
      repeatWeeks: 1,
      notes: "",
      applyNotesToSeries: false,
    },
  });

  // Prefill form when editing a session
  useEffect(() => {
    if (editMode && editSession && open) {
      form.setValue('studentId', editSession.student_id);
      form.setValue('date', new Date(editSession.date));
      form.setValue('time', editSession.time);
      form.setValue('duration', editSession.duration);
      form.setValue('rate', editSession.rate);
      form.setValue('color', editSession.color || "#3B82F6");
      form.setValue('notes', editSession.notes || "");
      form.setValue('repeatWeekly', false); // Don't allow editing recurring sessions
      form.setValue('repeatWeeks', 1);
      form.setValue('applyNotesToSeries', false);
      
      // Mark all fields as user-modified to prevent auto-prefilling
      setUserModifiedFields(new Set(['studentId', 'date', 'time', 'duration', 'rate', 'color', 'notes']));
      
      // Show notes section if there are notes
      if (editSession.notes) {
        setShowNotes(true);
      }
    }
  }, [editMode, editSession, open, form]);

  // Function to fetch student's most recent session data
  const fetchStudentLastSession = async (studentId: string) => {
    try {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) return null;

      const { data, error } = await supabase
        .from('sessions')
        .select('rate, duration, time')
        .eq('student_id', studentId)
        .eq('tutor_id', tutorId)
        .order('date', { ascending: false })
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

  // Handle student selection change to prefill form with last session data
  const handleStudentChange = async (studentId: string) => {
    // Update the student field
    form.setValue('studentId', studentId);
    
    // Fetch student's last session data
    const lastSession = await fetchStudentLastSession(studentId);
    
    if (lastSession) {
      // Only prefill fields that haven't been manually modified by the user
      const fieldsToUpdate: Array<{ field: string; value: any }> = [];
      
      if (!userModifiedFields.has('rate') && lastSession.rate !== null) {
        fieldsToUpdate.push({ field: 'rate', value: Number(lastSession.rate) });
      }
      
      if (!userModifiedFields.has('duration') && lastSession.duration !== null) {
        fieldsToUpdate.push({ field: 'duration', value: lastSession.duration });
      }
      
      if (!userModifiedFields.has('time') && lastSession.time !== null) {
        fieldsToUpdate.push({ field: 'time', value: lastSession.time });
      }
      
      // Apply the updates
      if (fieldsToUpdate.length > 0) {
        fieldsToUpdate.forEach(({ field, value }) => {
          if (field === 'rate') {
            form.setValue('rate', value);
          } else if (field === 'duration') {
            form.setValue('duration', value);
          } else if (field === 'time') {
            form.setValue('time', value);
          }
        });
        
        // Show success toast
        toast({
          title: "Prefilled from last session",
          description: "Form fields filled with this student's most recent session data.",
        });
      }
    }
  };

  // Track field modifications to prevent overwriting user changes
  const handleFieldChange = (fieldName: string) => {
    setUserModifiedFields(prev => new Set(prev).add(fieldName));
  };

  // Handle cancel button click - reset form and close modal
  const handleCancel = () => {
    form.reset();
    setUserModifiedFields(new Set());
    setShowAddStudent(false);
    setNewStudentName("");
    setShowNotes(false);
    onOpenChange(false);
  };

  // Listen for custom events to pre-fill form from calendar clicks
  useEffect(() => {
    const handleOpenScheduleModal = (event: CustomEvent) => {
      if (event.detail) {
        const { date, time, duration } = event.detail;
        
        if (date) {
          form.setValue('date', new Date(date));
        }
        if (time) {
          form.setValue('time', time);
          setUserModifiedFields(prev => new Set(prev).add('time'));
        }
        if (duration) {
          form.setValue('duration', duration);
          setUserModifiedFields(prev => new Set(prev).add('duration'));
        }
      }
      
      onOpenChange(true);
    };

    window.addEventListener('openScheduleModal', handleOpenScheduleModal as EventListener);
    
    return () => {
      window.removeEventListener('openScheduleModal', handleOpenScheduleModal as EventListener);
    };
  }, [form, onOpenChange]);

  const onSubmit = async (data: ScheduleSessionForm) => {
    setIsSubmitting(true);
    
    try {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      if (editMode && editSession) {
        // Update existing session
        const { error } = await supabase
          .from('sessions')
          .update({
            student_id: data.studentId,
            date: format(data.date, "yyyy-MM-dd"),
            time: data.time,
            duration: data.duration,
            rate: data.rate,
            color: data.color,
            notes: data.notes || null,
          })
          .eq('id', editSession.id);

        if (error) {
          console.error('Supabase error:', error);
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

        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['student-session-history'] });

      } else {
        // Create new session(s) - existing logic
        const recurrenceId = data.repeatWeekly ? crypto.randomUUID() : null;
        const sessionsToInsert = [];
        const baseDate = new Date(data.date);
        
        sessionsToInsert.push({
          student_id: data.studentId,
          date: format(baseDate, "yyyy-MM-dd"),
          time: data.time,
          duration: data.duration,
          rate: data.rate,
          color: data.color,
          notes: data.notes || null,
          tutor_id: tutorId,
          paid: false,
          recurrence_id: recurrenceId,
          created_at: new Date().toISOString(),
        });

        if (data.repeatWeekly && data.repeatWeeks) {
          for (let week = 1; week < data.repeatWeeks; week++) {
            const sessionDate = new Date(baseDate);
            sessionDate.setDate(sessionDate.getDate() + (week * 7));
            
            sessionsToInsert.push({
              student_id: data.studentId,
              date: format(sessionDate, "yyyy-MM-dd"),
              time: data.time,
              duration: data.duration,
              rate: data.rate,
              color: data.color,
              notes: data.applyNotesToSeries ? (data.notes || null) : null,
              tutor_id: tutorId,
              paid: false,
              recurrence_id: recurrenceId,
              created_at: new Date().toISOString(),
            });
          }
        }

        const { data: insertedData, error } = await supabase
          .from('sessions')
          .insert(sessionsToInsert)
          .select();

        if (error) {
          console.error('Supabase error:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to schedule session. Please try again.",
          });
          return;
        }

        triggerSuccessConfetti();
        
        const sessionCount = sessionsToInsert.length;
        toast({
          title: "🎉 Success!",
          description: sessionCount > 1 
            ? `${sessionCount} sessions scheduled successfully!`
            : "Session scheduled successfully!",
        });

        queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });

        console.log("Session created:", insertedData);
      }
      
      // Reset form and close modal
      setTimeout(() => {
        form.reset();
        setUserModifiedFields(new Set());
        setShowAddStudent(false);
        setNewStudentName("");
        setShowNotes(false);
        onOpenChange(false);
      }, editMode ? 100 : 500);

    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        variant: "destructive", 
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddStudent = () => {
    if (!newStudentName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Student name cannot be empty.",
      });
      return;
    }
    
    addStudentMutation.mutate(newStudentName);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] w-[95vw] sm:w-full flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 p-4 sm:p-6 pb-2">
          <DialogTitle className="text-lg">
            {editMode ? "Edit Session" : "Schedule a Session"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {editMode 
              ? "Update the session details below."
              : "Fill out the details below to schedule a new tutoring session."
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
                  <div className="flex gap-2">
                    <FormControl className="flex-1">
                      <Select onValueChange={handleStudentChange} value={field.value}>
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
                                No students found. Please add one.
                              </div>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddStudent(true)}
                      className="px-3"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Student
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Add New Student Section */}
            {showAddStudent && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="text-sm font-medium mb-2">Add New Student</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter student name"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddStudent();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddStudent}
                    disabled={addStudentMutation.isPending || !newStudentName.trim()}
                  >
                    {addStudentMutation.isPending ? "Adding..." : "Add"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddStudent(false);
                      setNewStudentName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Date */}
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
                          variant="outline"
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
                        disabled={(date) => {
                          const today = new Date();
                          const thirtyDaysAgo = new Date(today);
                          thirtyDaysAgo.setDate(today.getDate() - 30);
                          return date < thirtyDaysAgo || date < new Date("1900-01-01");
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      onChange={(value) => {
                        field.onChange(value);
                        handleFieldChange('time');
                      }}
                      placeholder="Select time"
                      timeFormat={timeFormat}
                    />
                  </FormControl>
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
                      placeholder="60"
                      {...field}
                      onChange={(e) => {
                        field.onChange(parseInt(e.target.value) || 0);
                        handleFieldChange('duration');
                      }}
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
                  <FormLabel>Rate (per hour in {tutorCurrency})</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      placeholder="45.00"
                      step="0.01"
                      className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      {...field}
                      onChange={(e) => {
                        field.onChange(parseFloat(e.target.value) || 0);
                        handleFieldChange('rate');
                      }}
                      onFocus={(e) => {
                        // Clear the field if it contains 0 when focused
                        if (field.value === 0) {
                          field.onChange('');
                          e.target.value = '';
                        }
                        handleFieldChange('rate');
                      }}
                      onBlur={(e) => {
                        // Reset to 0 if the field is empty when blurred
                        if (e.target.value === '' || e.target.value === null) {
                          field.onChange(0);
                        }
                      }}
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
                  <FormControl>
                    <div className="grid grid-cols-6 gap-2">
                      {[
                        { color: "#3B82F6", name: "Blue" },
                        { color: "#F87171", name: "Red" },
                        { color: "#34D399", name: "Green" },
                        { color: "#FBBF24", name: "Yellow" },
                        { color: "#A78BFA", name: "Purple" },
                        { color: "#6B7280", name: "Gray" },
                      ].map((colorOption) => (
                        <div
                          key={colorOption.color}
                          className={`w-8 h-8 rounded-lg cursor-pointer border-2 transition-all ${
                            field.value === colorOption.color
                              ? "border-gray-900 scale-110"
                              : "border-gray-300 hover:border-gray-500"
                          }`}
                          style={{ backgroundColor: colorOption.color }}
                          onClick={() => field.onChange(colorOption.color)}
                          title={colorOption.name}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recurring Session Options - Hidden in edit mode */}
            {!editMode && (
              <>
                <FormField
                  control={form.control}
                  name="repeatWeekly"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Repeat Weekly
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('repeatWeekly') && (
                  <FormField
                    control={form.control}
                    name="repeatWeeks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of weeks to repeat</FormLabel>
                        <FormControl>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value, 10))}
                            value={field.value?.toString()}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select weeks" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((week) => (
                                <SelectItem key={week} value={week.toString()}>
                                  {week} week{week > 1 ? 's' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            {/* Session Notes Section */}
            <div className="space-y-4 border-t pt-4">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowNotes(!showNotes)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">📝</span>
                  <FormLabel className="text-sm font-medium cursor-pointer">
                    Add Session Notes
                  </FormLabel>
                </div>
                <ChevronDown 
                  className={`h-4 w-4 transition-transform duration-200 ${
                    showNotes ? 'rotate-180' : ''
                  }`}
                />
              </div>

              <div 
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  showNotes ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="space-y-4 pt-2">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Optional notes about this session..."
                            className="min-h-[80px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch('repeatWeekly') && (
                    <FormField
                      control={form.control}
                      name="applyNotesToSeries"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm text-muted-foreground">
                              Apply note to all future sessions in this series
                            </FormLabel>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            </div>
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
                {isSubmitting 
                  ? (editMode ? "Updating..." : "Scheduling...") 
                  : (editMode ? "Update Session" : "Schedule Session")
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}