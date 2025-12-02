import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, User, UserX } from "lucide-react";
import { triggerCalendarDelete } from "@/hooks/useGoogleCalendarSync";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import { invalidateSessionCountCache } from "@/lib/queryOptimizer";
import type { CancellationReason, CancellationSource } from "@shared/schema";

interface CancelSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  studentId?: string;
  studentName: string;
  googleCalendarEventId?: string;
  isBulk?: boolean;
  bulkSessionIds?: string[];
  bulkGoogleEventIds?: string[];
  onSuccess?: () => void;
}

export function CancelSessionModal({
  isOpen,
  onClose,
  sessionId,
  studentId,
  studentName,
  googleCalendarEventId,
  isBulk = false,
  bulkSessionIds = [],
  bulkGoogleEventIds = [],
  onSuccess,
}: CancelSessionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancellationReason, setCancellationReason] = useState<CancellationReason | "">("");
  const [cancellationNote, setCancellationNote] = useState("");
  const [excludeFromRate, setExcludeFromRate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionCount = isBulk ? bulkSessionIds.length : 1;

  const handleCancel = async () => {
    if (!cancellationReason) {
      toast({
        variant: "destructive",
        title: "Selection required",
        description: "Please select who is cancelling this session.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const source: CancellationSource = isBulk ? "bulk" : "single";
      const idsToCancel = isBulk ? bulkSessionIds : [sessionId];

      const { error } = await supabase
        .from("sessions")
        .update({
          status: "cancelled",
          cancellation_reason: cancellationReason,
          cancelled_at: now,
          cancellation_note: cancellationNote || null,
          cancellation_source: source,
          bulk_excluded: excludeFromRate,
        })
        .in("id", idsToCancel);

      if (error) throw error;

      const eventIdsToDelete = isBulk ? bulkGoogleEventIds : (googleCalendarEventId ? [googleCalendarEventId] : []);
      for (const eventId of eventIdsToDelete) {
        if (eventId) {
          triggerCalendarDelete(eventId);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["calendar-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["all-upcoming-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      
      queryClient.invalidateQueries({ queryKey: ["cancellation-stats", "all"] });
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: ["student-session-history", studentId] });
        queryClient.invalidateQueries({ queryKey: ["cancellation-stats", studentId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["student-session-history"] });
        queryClient.invalidateQueries({ queryKey: ["cancellation-stats"] });
      }

      const tutorId = await getCurrentTutorId();
      if (tutorId) {
        invalidateSessionCountCache(tutorId);
      }

      toast({
        title: isBulk ? "Sessions Cancelled" : "Session Cancelled",
        description: isBulk
          ? `${sessionCount} sessions have been cancelled.`
          : `The session with ${studentName} has been cancelled.`,
      });

      onSuccess?.();
      handleClose();
    } catch (error: any) {
      console.error("Error cancelling session:", error);
      toast({
        variant: "destructive",
        title: "Failed to Cancel",
        description: error.message || "An error occurred while cancelling the session.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCancellationReason("");
    setCancellationNote("");
    setExcludeFromRate(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            {isBulk ? `Cancel ${sessionCount} Sessions` : "Cancel Session"}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? `You are about to cancel ${sessionCount} sessions. Please indicate who is cancelling.`
              : `Cancel the session with ${studentName}. This action helps track cancellation patterns.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Who is cancelling?</Label>
            <RadioGroup
              value={cancellationReason}
              onValueChange={(value) => setCancellationReason(value as CancellationReason)}
              className="space-y-3"
            >
              <div
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  cancellationReason === "tutor"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                onClick={() => setCancellationReason("tutor")}
                data-testid="radio-tutor-cancels"
              >
                <RadioGroupItem value="tutor" id="tutor" />
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <Label htmlFor="tutor" className="font-medium cursor-pointer">
                      I cancelled
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      You are cancelling this session
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  cancellationReason === "student"
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                onClick={() => setCancellationReason("student")}
                data-testid="radio-student-cancels"
              >
                <RadioGroupItem value="student" id="student" />
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                    <UserX className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <Label htmlFor="student" className="font-medium cursor-pointer">
                      Student cancelled
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {studentName || "The student"} is cancelling
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancellation-note" className="text-sm font-medium">
              Note (optional)
            </Label>
            <Textarea
              id="cancellation-note"
              value={cancellationNote}
              onChange={(e) => setCancellationNote(e.target.value)}
              placeholder="e.g., Illness, schedule conflict, emergency..."
              rows={2}
              className="resize-none"
              data-testid="input-cancellation-note"
            />
          </div>

          {isBulk && (
            <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <Checkbox
                id="exclude-from-rate"
                checked={excludeFromRate}
                onCheckedChange={(checked) => setExcludeFromRate(!!checked)}
                data-testid="checkbox-exclude-from-rate"
              />
              <div className="space-y-1">
                <Label htmlFor="exclude-from-rate" className="font-medium cursor-pointer">
                  Exclude from cancellation rate
                </Label>
                <p className="text-xs text-muted-foreground">
                  These {sessionCount} sessions won't count toward cancellation statistics
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            data-testid="button-cancel-modal-close"
          >
            Go Back
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isSubmitting || !cancellationReason}
            data-testid="button-confirm-cancel"
          >
            {isSubmitting
              ? "Cancelling..."
              : isBulk
              ? `Cancel ${sessionCount} Sessions`
              : "Cancel Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
