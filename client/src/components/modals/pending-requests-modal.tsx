import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { useToast } from "@/hooks/use-toast";
import { Clock, User, Calendar, Check, X, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { DateTime } from "luxon";
import { useTimezone } from "@/contexts/TimezoneContext";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

interface PendingRequest {
  id: string;
  unassigned_name: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  notes?: string;
  created_at: string;
}

interface Student {
  id: string;
  name: string;
  created_at: string;
}

interface PendingRequestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightSessionId?: string;
}

// Configure dayjs
dayjs.extend(relativeTime);

export function PendingRequestsModal({ open, onOpenChange, highlightSessionId }: PendingRequestsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tutorTimezone } = useTimezone();
  const [selectedStudents, setSelectedStudents] = useState<Record<string, string>>({});
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const [showAddStudent, setShowAddStudent] = useState<Record<string, boolean>>({});
  const [newStudentNames, setNewStudentNames] = useState<Record<string, string>>({});

  // Fetch pending requests
  const { data: pendingRequests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['pending-requests'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) return [];

      const { data, error } = await supabase
        .from('sessions')
        .select('id, unassigned_name, date, time, duration, rate, notes, created_at')
        .eq('tutor_id', tutorId)
        .eq('status', 'pending')
        .is('student_id', null)
        .not('unassigned_name', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending requests:', error);
        throw error;
      }

      return data as PendingRequest[];
    },
    enabled: open,
  });

  // Fetch students from Supabase for current user (same as Schedule Session modal)
  const { data: students = [], isLoading: loadingStudents } = useQuery({
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
    enabled: open,
  });

  // Add new student mutation (same as Schedule Session modal)
  const addStudentMutation = useMutation({
    mutationFn: async ({ name, requestId }: { name: string; requestId: string }) => {
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

      return { student: data as Student, requestId };
    },
    onSuccess: ({ student, requestId }) => {
      // Refresh students list
      queryClient.invalidateQueries({ queryKey: ['students'] });
      
      // Auto-select the new student for this request
      setSelectedStudents(prev => ({
        ...prev,
        [requestId]: student.id
      }));
      
      // Reset add student form for this request
      setNewStudentNames(prev => ({
        ...prev,
        [requestId]: ""
      }));
      setShowAddStudent(prev => ({
        ...prev,
        [requestId]: false
      }));
      
      // Show success message
      toast({
        title: "Student added successfully",
        description: `${student.name} has been added and selected.`,
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

  // Accept request mutation
  const acceptMutation = useMutation({
    mutationFn: async ({ requestId, studentId }: { requestId: string; studentId: string }) => {
      // First get the pending request to extract date/time for UTC conversion
      const { data: pendingRequest, error: fetchError } = await supabase
        .from('sessions')
        .select('date, time, duration')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Convert legacy date/time to UTC timestamps using tutor timezone
      const tutorTz = tutorTimezone || 'UTC';
      const dateTimeStr = `${pendingRequest.date} ${pendingRequest.time}`;
      const sessionStartUTC = DateTime.fromFormat(dateTimeStr, 'yyyy-MM-dd HH:mm', { zone: tutorTz }).toUTC().toISO();
      const sessionEndUTC = DateTime.fromFormat(dateTimeStr, 'yyyy-MM-dd HH:mm', { zone: tutorTz })
        .plus({ minutes: pendingRequest.duration })
        .toUTC()
        .toISO();

      const { error } = await supabase
        .from('sessions')
        .update({
          student_id: studentId,
          unassigned_name: null,
          status: 'confirmed',
          session_start: sessionStartUTC,
          session_end: sessionEndUTC
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Request Accepted",
        description: "The booking request has been confirmed and assigned to the student.",
      });
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-sessions-count'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Accept Request",
        description: error.message || "There was an error accepting the request.",
      });
    },
    onSettled: (_, __, variables) => {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.requestId);
        return newSet;
      });
    },
  });

  // Decline request mutation
  const declineMutation = useMutation({
    mutationFn: async (requestId: string) => {
      // Delete the session entirely (default behavior)
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Request Declined",
        description: "The booking request has been declined and removed.",
      });
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-sessions-count'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to Decline Request",
        description: error.message || "There was an error declining the request.",
      });
    },
    onSettled: (_, __, requestId) => {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    },
  });

  const handleAccept = (requestId: string) => {
    const studentId = selectedStudents[requestId];
    if (!studentId) {
      toast({
        variant: "destructive",
        title: "No Student Selected",
        description: "Please select a student to assign this session to.",
      });
      return;
    }

    setProcessingRequests(prev => new Set(prev).add(requestId));
    acceptMutation.mutate({ requestId, studentId });
  };

  const handleDecline = (requestId: string) => {
    setProcessingRequests(prev => new Set(prev).add(requestId));
    declineMutation.mutate(requestId);
  };

  const handleStudentSelect = (requestId: string, studentId: string) => {
    if (studentId === "add-new") {
      setShowAddStudent(prev => ({
        ...prev,
        [requestId]: true
      }));
    } else {
      setSelectedStudents(prev => ({
        ...prev,
        [requestId]: studentId
      }));
    }
  };

  const handleAddStudent = (requestId: string) => {
    const name = newStudentNames[requestId];
    if (!name?.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Student name cannot be empty.",
      });
      return;
    }
    
    addStudentMutation.mutate({ name, requestId });
  };

  const formatDateTime = (date: string, time: string) => {
    // Assume date/time is in tutor's timezone, format appropriately
    const tutorTz = tutorTimezone || 'UTC';
    const dateTime = DateTime.fromFormat(`${date} ${time}`, 'yyyy-MM-dd HH:mm', { zone: tutorTz });
    return {
      date: dateTime.toFormat('MMM d, yyyy'),
      time: dateTime.toFormat('h:mm a'),
      dayOfWeek: dateTime.toFormat('cccc')
    };
  };

  // Auto-scroll to highlighted session when modal opens or when highlightSessionId changes
  useEffect(() => {
    if (open && highlightSessionId && pendingRequests.length > 0) {
      // Add a delay to ensure the modal content is fully rendered
      const timer = setTimeout(() => {
        const element = document.getElementById(`pending-request-${highlightSessionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add temporary highlight effect
          element.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-75');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-75');
          }, 3000);
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [open, highlightSessionId, pendingRequests]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto z-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Pending Booking Requests
            {pendingRequests.length > 0 && (
              <Badge variant="secondary">
                {pendingRequests.length} request{pendingRequests.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loadingRequests ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No pending requests</p>
              <p className="text-sm">All booking requests have been reviewed.</p>
            </div>
          ) : (
            pendingRequests.map((request) => {
              const { date, time, dayOfWeek } = formatDateTime(request.date, request.time);
              const isProcessing = processingRequests.has(request.id);

              return (
                <Card 
                  key={request.id} 
                  id={`pending-request-${request.id}`}
                  className={`border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 transition-all duration-300 ${
                    highlightSessionId === request.id ? 'shadow-lg scale-105' : ''
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Request Details */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-amber-600" />
                          <span className="font-semibold text-lg">{request.unassigned_name}</span>
                          <Badge variant="outline" className="text-amber-700 border-amber-300">
                            Pending
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{date}</div>
                              <div className="text-xs">{dayOfWeek}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{time}</div>
                              <div className="text-xs">{request.duration} minutes</div>
                            </div>
                          </div>

                          {request.rate > 0 && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="text-sm font-medium">Rate:</span>
                              <span className="font-semibold">{formatCurrency(Number(request.rate))}</span>
                            </div>
                          )}
                        </div>

                        {request.notes && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Notes:</span> {request.notes}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          Requested {dayjs(request.created_at).fromNow()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-3 lg:w-64">
                        <Select
                          value={selectedStudents[request.id] || ""}
                          onValueChange={(value) => handleStudentSelect(request.id, value)}
                          disabled={isProcessing || loadingStudents}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a student..." />
                          </SelectTrigger>
                          <SelectContent 
                            className="z-[60]" 
                            position="popper"
                            sideOffset={5}
                          >
                            {loadingStudents ? (
                              <SelectItem value="loading" disabled>
                                Loading students...
                              </SelectItem>
                            ) : students.length === 0 ? (
                              <SelectItem value="no-students" disabled>
                                No students found. Please add one.
                              </SelectItem>
                            ) : (
                              <>
                                {students.map((student) => (
                                  <SelectItem key={student.id} value={student.id}>
                                    {student.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value="add-new" className="text-blue-600 font-medium">
                                  <div className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add New Student
                                  </div>
                                </SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>

                        {/* Add New Student Form for this request */}
                        {showAddStudent[request.id] && (
                          <div className="mt-3 p-3 border rounded-lg bg-muted/50">
                            <h4 className="text-sm font-medium mb-2">Add New Student</h4>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter student name"
                                value={newStudentNames[request.id] || ""}
                                onChange={(e) => setNewStudentNames(prev => ({
                                  ...prev,
                                  [request.id]: e.target.value
                                }))}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddStudent(request.id);
                                  }
                                }}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleAddStudent(request.id)}
                                disabled={addStudentMutation.isPending || !newStudentNames[request.id]?.trim()}
                              >
                                {addStudentMutation.isPending ? "Adding..." : "Add"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowAddStudent(prev => ({
                                    ...prev,
                                    [request.id]: false
                                  }));
                                  setNewStudentNames(prev => ({
                                    ...prev,
                                    [request.id]: ""
                                  }));
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleAccept(request.id)}
                            disabled={!selectedStudents[request.id] || isProcessing}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            Accept
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDecline(request.id)}
                            disabled={isProcessing}
                            size="sm"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}