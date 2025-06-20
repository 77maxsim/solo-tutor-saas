import { useState } from "react";
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
import { Clock, User, Calendar, Check, X, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import moment from "moment";

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
  first_name: string;
  last_name: string;
  email?: string;
}

interface PendingRequestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PendingRequestsModal({ open, onOpenChange }: PendingRequestsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStudents, setSelectedStudents] = useState<Record<string, string>>({});
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());

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

  // Fetch students for dropdown
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students-for-assignment'],
    queryFn: async () => {
      const tutorId = await getCurrentTutorId();
      if (!tutorId) return [];

      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, email')
        .eq('tutor_id', tutorId)
        .eq('is_active', true)
        .order('first_name');

      if (error) {
        console.error('Error fetching students:', error);
        throw error;
      }

      return data as Student[];
    },
    enabled: open,
  });

  // Accept request mutation
  const acceptMutation = useMutation({
    mutationFn: async ({ requestId, studentId }: { requestId: string; studentId: string }) => {
      const { error } = await supabase
        .from('sessions')
        .update({
          student_id: studentId,
          unassigned_name: null,
          status: 'confirmed'
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
    setSelectedStudents(prev => ({
      ...prev,
      [requestId]: studentId
    }));
  };

  const formatDateTime = (date: string, time: string) => {
    const dateTime = moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm');
    return {
      date: dateTime.format('MMM D, YYYY'),
      time: dateTime.format('h:mm A'),
      dayOfWeek: dateTime.format('dddd')
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
                <Card key={request.id} className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
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
                          Requested {moment(request.created_at).fromNow()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-3 lg:w-64">
                        <Select
                          value={selectedStudents[request.id] || ""}
                          onValueChange={(value) => handleStudentSelect(request.id, value)}
                          disabled={isProcessing || loadingStudents}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select student..." />
                          </SelectTrigger>
                          <SelectContent>
                            {students.map((student) => (
                              <SelectItem key={student.id} value={student.id}>
                                {student.first_name} {student.last_name}
                                {student.email && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({student.email})
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

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