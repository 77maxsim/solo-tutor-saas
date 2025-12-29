import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, User, DollarSign, Edit, Trash2, ChevronDown, Plus, Pencil, Repeat, CheckCircle } from "lucide-react";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";
import { formatUtcToTutorTimezone, calculateDurationMinutes } from "@/lib/dateUtils";
import { useTimezone } from "@/contexts/TimezoneContext";
import { getSessionDisplayInfo } from "@/lib/sessionDisplay";
import { CancelSessionModal } from "@/components/modals/cancel-session-modal";
import { sanitizeText } from "@/lib/sanitize";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { invalidateSessionCountCache } from "@/lib/queryOptimizer";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { triggerCalendarSync } from "@/hooks/useGoogleCalendarSync";

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

interface SessionDetails {
  id: string;
  student_id: string | null;
  student_name: string;
  date?: string; // Legacy field
  time?: string; // Legacy field
  session_start: string; // UTC timestamp - required
  session_end: string; // UTC timestamp - required
  duration: number;
  rate: number;
  tuition_fee?: number;
  notes?: string;
  color?: string;
  recurrence_id?: string;
  paid?: boolean;
  created_at?: string;
  status?: string;
  unassigned_name?: string;
  google_calendar_event_id?: string;
}

interface SessionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionDetails | null;
}

export function SessionDetailsModal({ isOpen, onClose, session }: SessionDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tutorTimezone } = useTimezone();
  const [notes, setNotes] = useState(session?.notes || "");
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [sessionColor, setSessionColor] = useState(session?.color || '#3B82F6');
  const [showNotesSection, setShowNotesSection] = useState(false);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false);
  const [bulkSessionIds, setBulkSessionIds] = useState<string[]>([]);
  const [bulkGoogleEventIds, setBulkGoogleEventIds] = useState<string[]>([]);

  // Reset state when modal opens/closes
  const handleClose = () => {
    setNotes(session?.notes || "");
    setApplyToSeries(false);
    setSessionColor(session?.color || '#3B82F6');
    setShowNotesSection(!!(session?.notes && session?.notes.trim()));
    setRepeatWeekly(false);
    onClose();
  };

  // Update state when session changes
  useEffect(() => {
    if (session) {
      setNotes(session.notes || "");
      setSessionColor(session.color || '#3B82F6');
      setApplyToSeries(false);
      setRepeatWeekly(false);
      // Show notes section if there are existing notes
      setShowNotesSection(!!(session.notes && session.notes.trim()));
      console.log('📋 Session Details Modal - Session data:', {
        id: session.id,
        recurrence_id: session.recurrence_id,
        date: session.date,
        hasRecurrence: !!session.recurrence_id
      });
    }
  }, [session]);

  // Update session data mutation
  const updateSessionMutation = useMutation({
    mutationFn: async ({ notes, color, applyToSeries, repeatWeekly }: { notes: string; color: string; applyToSeries: boolean; repeatWeekly: boolean }) => {
      if (!session) throw new Error("No session selected");

      // Handle repeat weekly logic first (only for non-recurring sessions)
      if (repeatWeekly && !session.recurrence_id) {
        // Get the current tutor ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        const tutorId = user.id;
        const recurrenceCount = 12; // 12 weeks = ~3 months
        const recurringGroupId = session.id;
        const newSessions = [];

        // Create future weekly sessions FIRST (don't update current session yet)
        for (let i = 1; i <= recurrenceCount; i++) {
          const nextStart = new Date(session.session_start);
          const nextEnd = new Date(session.session_end);
          nextStart.setDate(nextStart.getDate() + i * 7);
          nextEnd.setDate(nextEnd.getDate() + i * 7);

          newSessions.push({
            tutor_id: tutorId,
            student_id: session.student_id,
            duration: session.duration,
            rate: session.rate,
            notes,
            color,
            paid: false,
            session_start: nextStart.toISOString(),
            session_end: nextEnd.toISOString(),
            recurrence_id: recurringGroupId,
            created_at: new Date().toISOString(),
          });
        }

        // Step 1: Try inserting future sessions
        const { error: insertError } = await supabase
          .from('sessions')
          .insert(newSessions);

        if (insertError) {
          console.error('Error creating recurring sessions:', insertError);
          throw new Error(`Failed to create recurring sessions: ${insertError.message}`);
        }

        // Step 2: Update the original session ONLY AFTER successful creation
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ notes, color, recurrence_id: recurringGroupId })
          .eq('id', session.id);

        if (updateError) {
          console.error('Error updating current session:', updateError);
          throw new Error(`Failed to update current session: ${updateError.message}`);
        }

        return { type: 'recurring', count: recurrenceCount + 1 };
      }

      if (applyToSeries && session.recurrence_id) {
        // Update all future sessions in the series
        const sessionDate = new Date(session.session_start);

        const { error } = await supabase
          .from('sessions')
          .update({ notes, color })
          .eq('recurrence_id', session.recurrence_id)
          .gte('session_start', session.session_start);

        if (error) {
          console.error('Error updating series notes:', error);
          throw error;
        }

        return { type: 'series', count: 'multiple' };
      } else {
        // Update only the current session
        const { error } = await supabase
          .from('sessions')
          .update({ notes, color })
          .eq('id', session.id);

        if (error) {
          console.error('Error updating session notes:', error);
          throw error;
        }

        return { type: 'single', count: 1 };
      }
    },
    onSuccess: async (data) => {
      let message = "Session data updated successfully";
      
      if (data.type === 'series') {
        message = "Session data updated for all future sessions in this series";
      } else if (data.type === 'recurring') {
        message = `✅ Weekly sessions created! Added ${data.count} sessions for the next 3 months`;
      }

      toast({
        title: "Session Updated",
        description: message,
      });

      // Sync to Google Calendar (non-blocking)
      if (session?.id) {
        triggerCalendarSync(session.id);
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      
      // Invalidate session count cache for optimization
      const tutorId = await getCurrentTutorId();
      if (tutorId) {
        invalidateSessionCountCache(tutorId);
      }

      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("No session selected");

      const { error } = await supabase
        .from('sessions')
        .update({ paid: true })
        .eq('id', session.id);

      if (error) {
        console.error('Error marking session as paid:', error);
        throw error;
      }
    },
    onSuccess: async () => {
      toast({
        title: "Session Marked as Paid",
        description: `Payment recorded for ${session?.student_name || 'this session'}`,
      });

      queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['unpaid-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['earnings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      const tutorId = await getCurrentTutorId();
      if (tutorId) {
        invalidateSessionCountCache(tutorId);
      }

      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark session as paid. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateSessionMutation.mutate({ notes, color: sessionColor, applyToSeries, repeatWeekly });
  };

  const openCancelModal = () => {
    setShowCancelModal(true);
  };

  const openBulkCancelModal = async () => {
    if (!session?.recurrence_id) {
      toast({
        title: "Error",
        description: "Cannot cancel future sessions: No recurrence group found",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: sessionsToCancel, error: fetchError } = await supabase
        .from('sessions')
        .select('id, google_calendar_event_id')
        .eq('recurrence_id', session.recurrence_id)
        .gte('session_start', session.session_start);

      if (fetchError) throw fetchError;

      if (sessionsToCancel && sessionsToCancel.length > 0) {
        setBulkSessionIds(sessionsToCancel.map(s => s.id));
        setBulkGoogleEventIds(sessionsToCancel.filter(s => s.google_calendar_event_id).map(s => s.google_calendar_event_id!));
        setShowBulkCancelModal(true);
      }
    } catch (error) {
      console.error('Error fetching sessions for bulk cancel:', error);
      toast({
        title: "Error",
        description: "Failed to load sessions for cancellation",
        variant: "destructive",
      });
    }
  };

  const handleCancelSuccess = () => {
    handleClose();
  };

  console.log('📄 SessionDetailsModal render check:', {
    session: !!session,
    isOpen,
    sessionId: session?.id,
    sessionData: session
  });

  if (!session) {
    console.log('📄 SessionDetailsModal not rendering - no session');
    return null;
  }

  const { displayTime, durationMinutes } = getSessionDisplayInfo({
    ...session,
    session_start: session.session_start || '',
    session_end: session.session_end || ''
  }, tutorTimezone ?? 'UTC');
  const earnings = (durationMinutes / 60) * session.rate;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg md:max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            📄 Session Details
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1">
          <div className="space-y-4 pb-4">
            {/* Session Info */}
            <div className="space-y-3 p-4 bg-accent/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{sanitizeText(session.student_name)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {session.session_start && tutorTimezone
                    ? formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'MM/dd/yyyy')
                    : session.session_start ? dayjs.utc(session.session_start).format('YYYY-MM-DD') : 'N/A'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {tutorTimezone
                    ? (() => {
                        const startTime = formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'HH:mm');
                        const endTime = formatUtcToTutorTimezone(session.session_end, tutorTimezone, 'HH:mm');
                        const duration = calculateDurationMinutes(session.session_start, session.session_end);
                        console.log('🔍 Session details modal time display:', {
                          student: session.student_name,
                          utc_start: session.session_start,
                          utc_end: session.session_end,
                          tutor_timezone: tutorTimezone,
                          displayed_times: `${startTime} - ${endTime}`
                        });
                        return `${startTime} - ${endTime} (${duration} minutes)`;
                      })()
                    : 'Loading timezone...'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>{formatCurrency(earnings, 'USD')}</span>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-3">
              <div 
                className="flex items-center justify-between cursor-pointer p-2 rounded-md hover:bg-accent/50 transition-colors"
                onClick={() => setShowNotesSection(!showNotesSection)}
                role="button"
                tabIndex={0}
                aria-expanded={showNotesSection}
                aria-controls="notes-section-content"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowNotesSection(!showNotesSection);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">📝</span>
                  <Label className="text-sm font-medium cursor-pointer">
                    {showNotesSection || (notes && notes.trim()) ? 'Session Notes' : 'Add Session Notes'}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  {!showNotesSection && !(notes && notes.trim()) && (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                      showNotesSection ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>

              <div 
                id="notes-section-content"
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  showNotesSection ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="space-y-3 pt-1">
                  <Textarea
                    id="session-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this session..."
                    rows={4}
                    className="resize-none"
                  />

                  {/* Apply to Series Checkbox */}
                  {session.recurrence_id && (
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <Checkbox
                        id="apply-to-series"
                        checked={applyToSeries}
                        onCheckedChange={(checked) => setApplyToSeries(!!checked)}
                      />
                      <Label htmlFor="apply-to-series" className="text-sm">
                        Apply note to all future sessions in this series
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Session Color */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Session Color</Label>
              <div className="flex gap-3 flex-wrap">
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
                    onClick={() => setSessionColor(colorOption.color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      sessionColor === colorOption.color 
                        ? 'border-gray-900 dark:border-gray-100 ring-2 ring-offset-2 ring-gray-400 scale-110' 
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: colorOption.color }}
                    title={colorOption.name}
                    aria-label={`Select ${colorOption.name} color`}
                  />
                ))}
              </div>
            </div>

            {/* Repeat Weekly Section - only show for non-recurring sessions */}
            {!session.recurrence_id && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <Checkbox
                    id="repeat-weekly"
                    checked={repeatWeekly}
                    onCheckedChange={(checked) => setRepeatWeekly(!!checked)}
                  />
                  <Label htmlFor="repeat-weekly" className="text-sm">
                    Repeat Weekly (next 3 months)
                  </Label>
                </div>
              </div>
            )}

            {/* Session Actions */}
            <div className="space-y-4 pt-4 border-t">
              {/* Mark as Paid - show for unpaid past sessions */}
              {!session.paid && session.session_end && new Date(session.session_end) < new Date() && (
                <div className="border rounded-md p-3 bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-green-800 dark:text-green-200">Payment Pending</h4>
                      <p className="text-xs text-green-600 dark:text-green-400">This session hasn't been marked as paid yet</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => markAsPaidMutation.mutate()}
                      disabled={markAsPaidMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      data-testid="button-mark-as-paid"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {markAsPaidMutation.isPending ? "Saving..." : "Mark as Paid"}
                    </Button>
                  </div>
                </div>
              )}

              {/* This Session Section */}
              <div className="border rounded-md p-3 bg-gray-50/50 dark:bg-gray-800/50">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">This Session</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => {
                      console.log('🔧 Edit this session button clicked');
                      window.dispatchEvent(new CustomEvent('editSession', { 
                        detail: { session } 
                      }));
                      handleClose();
                    }}
                    className="flex items-center justify-center gap-2 h-10"
                    data-testid="button-edit-session"
                  >
                    <Pencil className="w-4 h-4" />
                    <span className="text-sm">Edit</span>
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={openCancelModal}
                    className="flex items-center justify-center gap-2 h-10"
                    data-testid="button-cancel-session"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Cancel</span>
                  </Button>
                </div>
              </div>

              {/* Entire Series Section - only show if session has recurrence_id */}
              {session.recurrence_id && (
                <div className="border rounded-md p-3 bg-blue-50/50 dark:bg-blue-950/50">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Entire Series</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => {
                        console.log('🔧 Edit future sessions button clicked');
                        window.dispatchEvent(new CustomEvent('editSeries', { 
                          detail: { session } 
                        }));
                        handleClose();
                      }}
                      className="flex items-center justify-center gap-2 h-10"
                      data-testid="button-edit-future-sessions"
                    >
                      <Repeat className="w-4 h-4" />
                      <span className="text-sm">Edit future sessions</span>
                    </Button>
                    <Button 
                      variant="destructive"
                      className="w-full"
                      onClick={openBulkCancelModal}
                      data-testid="button-cancel-future-sessions"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      <span className="text-sm">Cancel future sessions</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t bg-background flex-shrink-0">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateSessionMutation.isPending}
          >
            {updateSessionMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>

      {/* Cancel Session Modal - Single Session */}
      <CancelSessionModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        sessionId={session?.id || ""}
        studentId={session?.student_id}
        studentName={session?.student_name || ""}
        googleCalendarEventId={session?.google_calendar_event_id}
        onSuccess={handleCancelSuccess}
      />

      {/* Cancel Session Modal - Bulk (Future Sessions) */}
      <CancelSessionModal
        isOpen={showBulkCancelModal}
        onClose={() => {
          setShowBulkCancelModal(false);
          setBulkSessionIds([]);
          setBulkGoogleEventIds([]);
        }}
        sessionId={session?.id || ""}
        studentId={session?.student_id}
        studentName={session?.student_name || ""}
        isBulk={true}
        bulkSessionIds={bulkSessionIds}
        bulkGoogleEventIds={bulkGoogleEventIds}
        onSuccess={handleCancelSuccess}
      />
    </Dialog>
  );
}