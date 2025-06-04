import { useState } from "react";
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
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";

const scheduleSessionSchema = z.object({
  studentId: z.string().min(1, "Please select a student"),
  date: z.date({ required_error: "Date is required" }),
  time: z.string().min(1, "Time is required").regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time (HH:MM)"),
  duration: z.number().min(15, "Duration must be at least 15 minutes").max(480, "Duration cannot exceed 8 hours"),
  rate: z.number().min(0, "Rate must be a positive number"),
});

type ScheduleSessionForm = z.infer<typeof scheduleSessionSchema>;

interface Student {
  id: string;
  name: string;
  created_at: string;
}

interface ScheduleSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleSessionModal({ open, onOpenChange }: ScheduleSessionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tutor's currency preference
  const { data: tutorCurrency = 'USD' } = useQuery({
    queryKey: ['tutor-currency'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('currency')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor currency:', error);
        return 'USD'; // Fallback to USD
      }

      return data?.currency || 'USD';
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
      // Refresh students list
      queryClient.invalidateQueries({ queryKey: ['students'] });
      
      // Auto-select the new student
      form.setValue('studentId', newStudent.id);
      
      // Reset add student form
      setNewStudentName("");
      setShowAddStudent(false);
      
      // Show success message
      toast({
        title: "Student added",
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
    },
  });

  const onSubmit = async (data: ScheduleSessionForm) => {
    setIsSubmitting(true);
    
    try {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      // Prepare data for Supabase insertion
      const sessionData = {
        student_id: data.studentId,
        date: format(data.date, "yyyy-MM-dd"),
        time: data.time,
        duration: data.duration,
        rate: data.rate,
        tutor_id: tutorId,
        paid: false,
        created_at: new Date().toISOString(),
      };

      // Insert into Supabase sessions table
      const { data: insertedData, error } = await supabase
        .from('sessions')
        .insert([sessionData])
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

      // Success - show success message and reset form
      toast({
        title: "Success",
        description: "Session scheduled successfully!",
      });

      // Invalidate and refetch upcoming sessions and calendar
      queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });

      console.log("Session created:", insertedData);
      form.reset();
      onOpenChange(false);

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

  const handleCancel = () => {
    form.reset();
    setShowAddStudent(false);
    setNewStudentName("");
    onOpenChange(false);
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule a Session</DialogTitle>
          <DialogDescription>
            Fill out the details below to schedule a new tutoring session.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Student Selection */}
            <FormField
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student</FormLabel>
                  <div className="flex gap-2">
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
                        disabled={(date) =>
                          date < new Date() || date < new Date("1900-01-01")
                        }
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
                    <Input 
                      placeholder="HH:MM (e.g., 14:30)" 
                      {...field} 
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
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => {
                        // Clear the field if it contains 0 when focused
                        if (field.value === 0) {
                          field.onChange('');
                          e.target.value = '';
                        }
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Scheduling..." : "Schedule Session"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}