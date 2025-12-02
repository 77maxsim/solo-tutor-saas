import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCancellationStats, formatCancellationRate } from "@/hooks/useCancellationStats";
import { XCircle, User, UserX, Info, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CancellationRateCardProps {
  className?: string;
}

export function CancellationRateCard({ className }: CancellationRateCardProps) {
  const { data: stats, isLoading, error } = useCancellationStats();

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

  return (
    <Card
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
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  {stats?.hasEnoughData
                    ? "Percentage of sessions cancelled vs. completed"
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
  );
}
