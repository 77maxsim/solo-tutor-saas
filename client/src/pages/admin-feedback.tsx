import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, MessageCircle, Mail, Clock, User, ArrowLeft, Send, HelpCircle, MessageSquare, Wrench, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabaseClient";
import type { Feedback, FeedbackStatus, FeedbackType } from "@shared/schema";

const typeLabels: Record<FeedbackType, { label: string; icon: typeof HelpCircle; color: string }> = {
  help: { label: "Help", icon: HelpCircle, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  feedback: { label: "Feedback", icon: MessageSquare, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
  technical_support: { label: "Technical", icon: Wrench, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" },
};

const statusColors: Record<FeedbackStatus, string> = {
  new: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
};

export default function AdminFeedbackPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);

  const { data: feedback, isLoading } = useQuery<Feedback[]>({
    queryKey: ['/api/admin/feedback', statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/admin/feedback?${params}`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) throw new Error('Failed to fetch feedback');
      return response.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: FeedbackStatus }) => {
      const response = await apiRequest('PATCH', `/api/admin/feedback/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feedback'] });
      toast({
        title: "Status updated",
        description: "Feedback status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update feedback status.",
        variant: "destructive",
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, message }: { id: number; message: string }) => {
      const response = await apiRequest('POST', `/api/admin/feedback/${id}/reply`, { message });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feedback'] });
      setReplyDialogOpen(false);
      setReplyMessage("");
      setSelectedFeedback(null);
      toast({
        title: data.emailSent ? "Reply sent & email delivered" : "Reply saved",
        description: data.emailSent 
          ? `Email sent successfully to ${data.recipientEmail}` 
          : `Reply saved but email could not be sent to ${data.recipientEmail}`,
        variant: data.emailSent ? "default" : "destructive",
      });
    },
    onError: () => {
      toast({
        title: "Reply failed",
        description: "Failed to send reply.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleReply = (item: Feedback) => {
    setSelectedFeedback(item);
    setReplyMessage("");
    setReplyDialogOpen(true);
  };

  const submitReply = () => {
    if (!selectedFeedback || !replyMessage.trim()) return;
    replyMutation.mutate({ id: selectedFeedback.id, message: replyMessage });
  };

  const counts = {
    all: feedback?.length || 0,
    new: feedback?.filter(f => f.status === 'new').length || 0,
    in_progress: feedback?.filter(f => f.status === 'in_progress').length || 0,
    resolved: feedback?.filter(f => f.status === 'resolved').length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Feedback Management</h1>
          <p className="text-muted-foreground">View and respond to user feedback, help requests, and support tickets</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className={statusFilter === 'all' ? 'ring-2 ring-primary' : ''} 
              onClick={() => setStatusFilter('all')} 
              style={{ cursor: 'pointer' }}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{counts.all}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className={statusFilter === 'new' ? 'ring-2 ring-primary' : ''} 
              onClick={() => setStatusFilter('new')} 
              style={{ cursor: 'pointer' }}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{counts.new}</div>
            <p className="text-sm text-muted-foreground">New</p>
          </CardContent>
        </Card>
        <Card className={statusFilter === 'in_progress' ? 'ring-2 ring-primary' : ''} 
              onClick={() => setStatusFilter('in_progress')} 
              style={{ cursor: 'pointer' }}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{counts.in_progress}</div>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className={statusFilter === 'resolved' ? 'ring-2 ring-primary' : ''} 
              onClick={() => setStatusFilter('resolved')} 
              style={{ cursor: 'pointer' }}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{counts.resolved}</div>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>All Submissions</CardTitle>
              <CardDescription>Click on a submission to view details and respond</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="help">Help</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                  <SelectItem value="technical_support">Technical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!feedback || feedback.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feedback submissions yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedback.map((item) => {
                const TypeIcon = typeLabels[item.type].icon;
                return (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={typeLabels[item.type].color}>
                            <TypeIcon className="h-3 w-3 mr-1" />
                            {typeLabels[item.type].label}
                          </Badge>
                          <Badge className={statusColors[item.status]}>
                            {item.status === 'new' && 'New'}
                            {item.status === 'in_progress' && 'In Progress'}
                            {item.status === 'resolved' && 'Resolved'}
                          </Badge>
                          {item.subject && (
                            <span className="font-medium">{item.subject}</span>
                          )}
                        </div>
                        
                        <p className="text-sm text-foreground whitespace-pre-wrap">{item.message}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {item.tutors?.full_name || 'Unknown User'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {item.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(item.created_at)}
                          </span>
                        </div>

                        {item.admin_response && (
                          <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300 mb-1">
                              <CheckCircle className="h-3 w-3" />
                              <span>Reply by {item.admin_responder_name || 'Admin'}</span>
                              {item.admin_responded_at && (
                                <span>• {formatDate(item.admin_responded_at)}</span>
                              )}
                            </div>
                            <p className="text-sm text-green-800 dark:text-green-200">{item.admin_response}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 flex-shrink-0">
                        {item.status !== 'resolved' && (
                          <>
                            <Select
                              value={item.status}
                              onValueChange={(value) => updateStatusMutation.mutate({ id: item.id, status: value as FeedbackStatus })}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button onClick={() => handleReply(item)} size="sm">
                              <Send className="h-4 w-4 mr-1" />
                              Reply
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reply to Feedback</DialogTitle>
            <DialogDescription>
              Your response will be saved and the user will be notified at {selectedFeedback?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFeedback && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Original message:</div>
                <p className="text-sm">{selectedFeedback.message}</p>
              </div>
            )}
            <Textarea
              placeholder="Type your response..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={submitReply} 
                disabled={!replyMessage.trim() || replyMutation.isPending}
              >
                {replyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Reply
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
