import { useState } from "react";
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
import { Calendar, Clock, User, DollarSign, Edit, Trash2 } from "lucide-react";
import { formatDate, formatTime, formatCurrency } from "@/lib/utils";

interface SessionDetails {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  time: string;
  duration: number;
  rate: number;
  notes?: string;
  recurrence_id?: string;
}

interface SessionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionDetails | null;
}

export function SessionDetailsModal({ isOpen, onClose, session }: SessionDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(session?.notes || "");
  const [applyToSeries, setApplyToSeries] = useState(false);

  // Reset state when modal opens/closes
  const handleClose = () => {
    setNotes(session?.notes || "");
    setApplyToSeries(false);
    onClose();
  };

  // Update session notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ notes, applyToSeries }: { notes: string; applyToSeries: boolean }) => {
      if (!session) throw new Error("No session selected");

      if (applyToSeries && session.recurrence_id) {
        // Update all future sessions in the series
        const sessionDate = new Date(`${session.date}T${session.time}`);
        
        const { error } = await supabase
          .from('sessions')
          .update({ notes })
          .eq('recurrence_id', session.recurrence_id)
          .gte('date', session.date);

        if (error) {
          console.error('Error updating series notes:', error);
          throw error;
        }

        return { type: 'series', count: 'multiple' };
      } else {
        // Update only the current session
        const { error } = await supabase
          .from('sessions')
          .update({ notes })
          .eq('id', session.id);

        if (error) {
          console.error('Error updating session notes:', error);
          throw error;
        }

        return { type: 'single', count: 1 };
      }
    },
    onSuccess: (data) => {
      const message = data.type === 'series' 
        ? "Notes updated for all future sessions in this series"
        : "Session notes updated successfully";
        
      toast({
        title: "Notes Updated",
        description: message,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update notes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateNotesMutation.mutate({ notes, applyToSeries });
  };

  if (!session) return null;

  const sessionDateTime = new Date(`${session.date}T${session.time}`);
  const earnings = (session.duration / 60) * session.rate;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📄 Session Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Session Info */}
          <div className="space-y-3 p-4 bg-accent/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{session.student_name}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(sessionDateTime)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTime(sessionDateTime)} ({session.duration} minutes)</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>{formatCurrency(earnings)}</span>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label htmlFor="session-notes">Session Notes</Label>
            <Textarea
              id="session-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this session..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Apply to Series Checkbox */}
          {session.recurrence_id && (
            <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
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

          {/* Session Actions */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Individual Session</h4>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    // Dispatch edit session event
                    window.dispatchEvent(new CustomEvent('editSession', { 
                      detail: { session } 
                    }));
                    handleClose();
                  }}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit this session
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    // Dispatch cancel session event
                    window.dispatchEvent(new CustomEvent('cancelSession', { 
                      detail: { session } 
                    }));
                    handleClose();
                  }}
                  className="flex-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cancel this session
                </Button>
              </div>
            </div>

            {/* Recurring series actions - only show if session has recurrence_id */}
            {session.recurrence_id && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="text-sm font-medium">Recurring Series</h4>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      // Dispatch edit series event
                      window.dispatchEvent(new CustomEvent('editSeries', { 
                        detail: { session } 
                      }));
                      handleClose();
                    }}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit future sessions
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      // Dispatch cancel series event
                      window.dispatchEvent(new CustomEvent('cancelSeries', { 
                        detail: { session } 
                      }));
                      handleClose();
                    }}
                    className="flex-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cancel future sessions
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateNotesMutation.isPending}
          >
            {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}