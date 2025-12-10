import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCancellationStats, useCancellationDetails, formatCancellationRate } from "@/hooks/useCancellationStats";
import { User, UserX, Info, TrendingDown, Calendar, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUtcToTutorTimezone } from "@/lib/dateUtils";
import { useTimezone } from "@/contexts/TimezoneContext";

interface CancellationRateCardProps {
  className?: string;
}

export function CancellationRateCard({ className }: CancellationRateCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: stats, isLoading, error } = useCancellationStats();
  const { data: details, isLoading: isLoadingDetails } = useCancellationDetails({ 
    enabled: isModalOpen,
    daysBack: stats?.daysBack 
  });
  const { tutorTimezone } = useTimezone();

  if (error) {
    return null;
  }

  const displayRate = stats
    ? formatCancellationRate(stats.cancellationRate, stats.hasEnoughData, stats.rawCounts)
    : "...";

  const getRateColor = (rate: number) => {
    if (rate <= 5) return "text-green-600 dark:text-green-400";
    if (rate <= 15) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatReasonLabel = (reason: string) => {
    switch (reason) {
      case "tutor": return "By Tutor";
      case "student": return "By Student";
      case "unspecified": return "Unspecified";
      default: return reason.charAt(0).toUpperCase() + reason.slice(1);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-tooltip-trigger]')) {
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <>
      <Card
        onClick={handleCardClick}
        className={cn(
          "hover-lift cursor-pointer transition-all duration-300 group",
          "hover:shadow-lg hover:shadow-orange-100/50 dark:hover:shadow-orange-900/20 border-2 hover:border-orange-200 dark:hover:border-orange-700",
          "dark:bg-card dark:shadow-md dark:border-gray-700",
          className
        )}
        data-testid="card-cancellation-rate"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200 dark:text-gray-200">
              Cancellation Rate
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild data-tooltip-trigger>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    {stats?.hasEnoughData
                      ? `Based on the last ${stats.daysBack} days. Click for details.`
                      : `Need at least 5 sessions to calculate rate. Currently showing raw count.`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                  <TrendingDown className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p
                    className={cn(
                      "text-2xl font-bold transition-all duration-300",
                      isLoading && "animate-pulse text-muted-foreground",
                      stats?.hasEnoughData && getRateColor(stats.cancellationRate)
                    )}
                  >
                    {isLoading ? "..." : displayRate}
                  </p>
                  {stats?.hasEnoughData && (
                    <p className="text-xs text-muted-foreground">
                      {stats.totalCancelled} cancelled / {stats.totalCancelled + stats.totalCompleted} total
                      <span className="ml-1 text-muted-foreground/70">(last {stats.daysBack} days)</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {stats && stats.totalCancelled > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">By tutor</p>
                    <p className="text-sm font-medium">{stats.tutorCancelled}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <UserX className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">By student</p>
                    <p className="text-sm font-medium">{stats.studentCancelled}</p>
                  </div>
                </div>
              </div>
            )}

            {stats && stats.totalCancelled === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No cancellations recorded yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-orange-500" />
              Cancellation Details
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (last {stats?.daysBack || 90} days)
              </span>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className={cn("text-2xl font-bold", stats?.hasEnoughData && getRateColor(stats.cancellationRate))}>
                    {displayRate}
                  </p>
                  <p className="text-xs text-muted-foreground">Rate</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats?.tutorCancelled || 0}</p>
                  <p className="text-xs text-muted-foreground">By Tutor</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats?.studentCancelled || 0}</p>
                  <p className="text-xs text-muted-foreground">By Student</p>
                </div>
              </div>

              {/* Reason Breakdown */}
              {details?.reasonBreakdown && details.reasonBreakdown.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Breakdown by Reason
                  </h4>
                  <div className="space-y-2">
                    {details.reasonBreakdown.map(({ reason, count }) => (
                      <div key={reason} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                        <span className="text-sm">{formatReasonLabel(reason)}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Students */}
              {details?.topStudents && details.topStudents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Students with Most Cancellations
                  </h4>
                  <div className="space-y-2">
                    {details.topStudents.map(({ studentId, studentName, count }, index) => (
                      <div key={studentId} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                          <span className="text-sm">{studentName}</span>
                        </div>
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Cancellations */}
              {details?.cancelledSessions && details.cancelledSessions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Recent Cancellations
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {details.cancelledSessions.slice(0, 10).map((session) => (
                      <div key={session.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{session.student_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {tutorTimezone 
                              ? formatUtcToTutorTimezone(session.session_start, tutorTimezone, 'MMM d, yyyy')
                              : new Date(session.session_start).toLocaleDateString()}
                          </span>
                        </div>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          session.cancellation_reason === "tutor" 
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : session.cancellation_reason === "student"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        )}>
                          {formatReasonLabel(session.cancellation_reason || "unspecified")}
                        </span>
                      </div>
                    ))}
                    {details.cancelledSessions.length > 10 && (
                      <p className="text-xs text-center text-muted-foreground py-2">
                        + {details.cancelledSessions.length - 10} more cancellations
                      </p>
                    )}
                  </div>
                </div>
              )}

              {isLoadingDetails && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              )}

              {!isLoadingDetails && details?.cancelledSessions?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No cancellations in this time period
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
