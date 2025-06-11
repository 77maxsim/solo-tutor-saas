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
  color?: string;
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
  const [sessionColor, setSessionColor] = useState(session?.color || '#3B82F6');

  // Reset state when modal opens/closes
  const handleClose = () => {
    setNotes(session?.notes || "");
    setApplyToSeries(false);
    setSessionColor(session?.color || '#3B82F6');
    onClose();
  };

  // Update state when session changes
  useEffect(() => {
    if (session) {
      setNotes(session.notes || "");
      setSessionColor(session.color || '#3B82F6');
      setApplyToSeries(false);
    }
  }, [session]);

  // Update session data mutation
  const updateSessionMutation = useMutation({
    mutationFn: async ({ notes, color, applyToSeries }: { notes: string; color: string; applyToSeries: boolean }) => {
      if (!session) throw new Error("No session selected");

      if (applyToSeries && session.recurrence_id) {
        // Update all future sessions in the series
        const sessionDate = new Date(`${session.date}T${session.time}`);
        
        const { error } = await supabase
          .from('sessions')
          .update({ notes, color })
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
          .update({ notes, color })
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
        ? "Session data updated for all future sessions in this series"
        : "Session data updated successfully";
        
      toast({
        title: "Session Updated",
        description: message,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['student-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sessions'] });
      
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

  const handleSave = () => {
    updateSessionMutation.mutate({ notes, color: sessionColor, applyToSeries });
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

          {/* Session Color */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Session Color</Label>
            <div className="flex gap-2 flex-wrap">
              {[
                { color: "#3B82F6", name: "Blue" },
                { color: "#10B981", name: "Green" },
                { color: "#F59E0B", name: "Yellow" },
                { color: "#EF4444", name: "Red" },
                { color: "#8B5CF6", name: "Purple" },
                { color: "#06B6D4", name: "Cyan" },
                { color: "#F97316", name: "Orange" },
                { color: "#84CC16", name: "Lime" },
              ].map((colorOption) => (
                <button
                  key={colorOption.color}
                  type="button"
                  onClick={() => setSessionColor(colorOption.color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                    sessionColor === colorOption.color 
                      ? 'border-gray-900 dark:border-gray-100 ring-2 ring-offset-2 ring-gray-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: colorOption.color }}
                  title={colorOption.name}
                />
              ))}
            </div>
          </div>

          {/* Session Actions */}
          <div className="space-y-4 pt-4 border-t">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Individual Session</h4>
              <div className="grid grid-cols-2 gap-3">
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
                  className="flex items-center justify-center gap-2 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span className="text-sm">Edit this session</span>
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
                  className="flex items-center justify-center gap-2 h-10 bg-white dark:bg-gray-800 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">Cancel this session</span>
                </Button>
              </div>
            </div>

            {/* Recurring series actions - only show if session has recurrence_id */}
            {session.recurrence_id && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Recurring Series</h4>
                <div className="grid grid-cols-2 gap-3">
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
                    className="flex items-center justify-center gap-2 h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="text-sm">Edit future sessions</span>
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
                    className="flex items-center justify-center gap-2 h-10 bg-white dark:bg-gray-800 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Cancel future sessions</span>
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
            disabled={updateSessionMutation.isPending}
          >
            {updateSessionMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}