
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calendar, Clock, DollarSign, CheckCircle, XCircle, ChevronDown, ChevronRight, FolderOpen, Folder } from "lucide-react";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import { useState, useEffect } from "react";
import { SessionDetailsModal } from "./session-details-modal";
import { ScheduleSessionModal } from "./schedule-session-modal";

interface Session {
  id: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  paid: boolean;
  created_at: string;
  notes?: string;
  color?: string;
  recurrence_id?: string;
}

interface SessionForDetails {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  notes?: string;
  color?: string;
  recurrence_id?: string;
}

interface Student {
  id: string;
  name: string;
}

interface StudentSessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
}

export function StudentSessionHistoryModal({ isOpen, onClose, student }: StudentSessionHistoryModalProps) {
  const [futureSectionsOpen, setFutureSectionsOpen] = useState(false);
  const [pastSectionsOpen, setPastSectionsOpen] = useState(false);
  const [sessionDetailsOpen, setSessionDetailsOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionForDetails | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<SessionForDetails | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['student-session-history', student?.id],
    queryFn: async () => {
      if (!student) return [];

      const tutorId = await getCurrentTutorId();
      if (!tutorId) {
        throw new Error('User not authenticated or tutor record not found');
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('id, date, time, duration, rate, paid, created_at, notes, color, recurrence_id')
        .eq('tutor_id', tutorId)
        .eq('student_id', student.id)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching session history:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!student && isOpen,
  });

  // Separate sessions into upcoming and past
  const now = new Date();
  const upcomingSessions = sessions?.filter(session => {
    const sessionDateTime = new Date(session.session_start);
    return sessionDateTime > now;
  }) || [];

  const pastSessions = sessions?.filter(session => {
    const sessionDateTime = new Date(session.session_start);
    return sessionDateTime <= now;
  }) || [];

  const handleSessionClick = (session: Session) => {
    // Format session data for SessionDetailsModal
    const sessionForDetails: SessionForDetails = {
      id: session.id,
      student_id: student?.id || '',
      student_name: student?.name || '',
      session_start: session.session_start,
      session_end: session.session_end,
      duration: session.duration,
      rate: session.rate,
      notes: session.notes,
      color: session.color,
      recurrence_id: session.recurrence_id,
    };
    
    setSelectedSession(sessionForDetails);
    setSessionDetailsOpen(true);
  };

  // Add event listeners for session edit actions
  useEffect(() => {
    const handleEditSession = (event: CustomEvent) => {
      const session = event.detail.session;
      // Close session details modal
      setSessionDetailsOpen(false);
      setSelectedSession(null);
      
      // Convert to format expected by ScheduleSessionModal
      const editSessionData = {
        id: session.id,
        student_id: session.student_id,
        session_start: session.session_start,
        session_end: session.session_end,
        duration: session.duration,
        rate: session.rate,
        notes: session.notes,
        color: session.color,
        recurrence_id: session.recurrence_id,
      };
      
      setEditSession(editSessionData);
      setScheduleModalOpen(true);
    };

    const handleCancelSession = (event: CustomEvent) => {
      // Close session details modal
      setSessionDetailsOpen(false);
      setSelectedSession(null);
      // Handle session cancellation here if needed
    };

    window.addEventListener('editSession', handleEditSession as EventListener);
    window.addEventListener('cancelSession', handleCancelSession as EventListener);

    return () => {
      window.removeEventListener('editSession', handleEditSession as EventListener);
      window.removeEventListener('cancelSession', handleCancelSession as EventListener);
    };
  }, []);

  const handleScheduleModalClose = () => {
    setScheduleModalOpen(false);
    setEditSession(null);
  };

  const SessionItem = ({ session }: { session: Session }) => {
    const earnings = (session.duration / 60) * session.rate;
    
    return (
      <div 
        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={() => handleSessionClick(session)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatDate(new Date(session.date))}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{formatTime(new Date(session.session_start))}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {session.duration}min
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatCurrency(earnings)}</span>
          </div>
          {session.paid ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📅 Session History - {student?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading session history...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Future Sessions Section */}
                {upcomingSessions.length > 0 && (
                  <Collapsible 
                    open={futureSectionsOpen} 
                    onOpenChange={setFutureSectionsOpen}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-3 h-auto hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-2">
                          {futureSectionsOpen ? (
                            <FolderOpen className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Folder className="h-4 w-4 text-blue-600" />
                          )}
                          <span className="font-medium">📁 Future Sessions</span>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            {upcomingSessions.length}
                          </Badge>
                        </div>
                        {futureSectionsOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {upcomingSessions.map((session) => (
                        <SessionItem key={session.id} session={session} />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Past Sessions Section */}
                {pastSessions.length > 0 && (
                  <Collapsible 
                    open={pastSectionsOpen} 
                    onOpenChange={setPastSectionsOpen}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-3 h-auto hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-2">
                          {pastSectionsOpen ? (
                            <FolderOpen className="h-4 w-4 text-gray-600" />
                          ) : (
                            <Folder className="h-4 w-4 text-gray-600" />
                          )}
                          <span className="font-medium">📁 Past Sessions</span>
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                            {pastSessions.length}
                          </Badge>
                        </div>
                        {pastSectionsOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {pastSessions.map((session) => (
                        <SessionItem key={session.id} session={session} />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* No sessions message */}
                {!sessions || sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No sessions found for {student?.name}</p>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Details Modal */}
      <SessionDetailsModal
        isOpen={sessionDetailsOpen}
        onClose={() => {
          setSessionDetailsOpen(false);
          setSelectedSession(null);
        }}
        session={selectedSession}
      />

      {/* Schedule Session Modal for Editing */}
      <ScheduleSessionModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        editSession={editSession}
        editMode={true}
      />
    </>
  );
}
