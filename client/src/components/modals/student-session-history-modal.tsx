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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, DollarSign, CheckCircle, XCircle } from "lucide-react";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";

interface Session {
  id: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  paid: boolean;
  created_at: string;
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
        .select('id, date, time, duration, rate, paid, created_at')
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
    const sessionDateTime = new Date(`${session.date}T${session.time}`);
    return sessionDateTime > now;
  }) || [];

  const pastSessions = sessions?.filter(session => {
    const sessionDateTime = new Date(`${session.date}T${session.time}`);
    return sessionDateTime <= now;
  }) || [];

  const SessionItem = ({ session }: { session: Session }) => {
    const earnings = (session.duration / 60) * session.rate;
    
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatDate(new Date(session.date))}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{formatTime(new Date(`${session.date}T${session.time}`))}</span>
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📅 Session History - {student?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading session history...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Upcoming Sessions */}
              {upcomingSessions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">Upcoming Sessions</h3>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      {upcomingSessions.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {upcomingSessions.map((session) => (
                      <SessionItem key={session.id} session={session} />
                    ))}
                  </div>
                </div>
              )}

              {/* Separator between sections */}
              {upcomingSessions.length > 0 && pastSessions.length > 0 && (
                <Separator className="my-4" />
              )}

              {/* Past Sessions */}
              {pastSessions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">Past Sessions</h3>
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                      {pastSessions.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {pastSessions.map((session) => (
                      <SessionItem key={session.id} session={session} />
                    ))}
                  </div>
                </div>
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
  );
}