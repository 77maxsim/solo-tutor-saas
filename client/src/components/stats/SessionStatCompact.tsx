import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  CalendarDays, 
  CalendarRange, 
  Hash, 
  Clock, 
  MoreHorizontal 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStats, TimeframeType, MetricType } from "@/hooks/useSessionStats";

interface SessionStatCompactProps {
  tutorId?: string;
  className?: string;
}

export function SessionStatCompact({ tutorId, className }: SessionStatCompactProps) {
  // State with localStorage persistence
  const [timeframe, setTimeframe] = useState<TimeframeType>(() => {
    const saved = localStorage.getItem('stat_tf');
    return (saved as TimeframeType) || 'month';
  });

  const [metric, setMetric] = useState<MetricType>(() => {
    const saved = localStorage.getItem('stat_metric');
    return (saved as MetricType) || 'sessions';
  });

  // Persist to localStorage when state changes
  useEffect(() => {
    localStorage.setItem('stat_tf', timeframe);
  }, [timeframe]);

  useEffect(() => {
    localStorage.setItem('stat_metric', metric);
  }, [metric]);

  // Fetch data using the hook
  const { completed, total, isLoading } = useSessionStats(timeframe, metric);

  // Calculate progress percentage
  const progressPercentage = total > 0 ? Math.min(Math.max((completed / total) * 100, 0), 100) : 0;

  // Generate display values
  const title = `${metric === 'hours' ? 'Hours' : 'Sessions'} ${timeframe === 'week' ? 'This Week' : 'This Month'}`;
  const displayValue = isLoading ? "..." : `${completed}${metric === 'hours' ? ' h' : ''}`;
  const chipText = `of ${total}${metric === 'hours' ? ' h' : ''}`;

  // Handle toggle functions
  const toggleTimeframe = (newTimeframe: TimeframeType) => {
    setTimeframe(newTimeframe);
  };

  const toggleMetric = (newMetric: MetricType) => {
    setMetric(newMetric);
  };

  return (
    <TooltipProvider>
      <Card 
        className={cn(
          "hover-lift cursor-pointer transition-all duration-300 group animate-scale-in",
          "hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-900/20 border-2 hover:border-blue-200 dark:hover:border-blue-700",
          "dark:bg-card dark:shadow-md dark:border-gray-700",
          className
        )}
        data-testid="card-sessions-compact"
      >
        <CardHeader className="p-3 md:p-3 lg:p-4 pb-2">
          <div className="flex items-center justify-between">
            {/* Title */}
            <h3 className="text-sm text-muted-foreground font-medium truncate">
              {title}
            </h3>

            {/* Desktop Controls */}
            <div className="hidden md:flex items-center gap-2">
              {/* Timeframe Control */}
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 w-7 p-0 rounded-md border text-xs font-semibold",
                        timeframe === 'week'
                          ? "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
                          : "hover:bg-accent"
                      )}
                      onClick={() => toggleTimeframe('week')}
                      aria-label="Week"
                      aria-pressed={timeframe === 'week'}
                      data-testid="toggle-week"
                    >
                      W
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Week</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 w-7 p-0 rounded-md border text-xs font-semibold",
                        timeframe === 'month'
                          ? "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
                          : "hover:bg-accent"
                      )}
                      onClick={() => toggleTimeframe('month')}
                      aria-label="Month"
                      aria-pressed={timeframe === 'month'}
                      data-testid="toggle-month"
                    >
                      M
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Month</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Subtle Divider */}
              <div className="w-px h-4 bg-border/50" />

              {/* Metric Control */}
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 w-7 p-0 rounded-md border",
                        metric === 'sessions'
                          ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
                          : "hover:bg-accent"
                      )}
                      onClick={() => toggleMetric('sessions')}
                      aria-label="Sessions"
                      aria-pressed={metric === 'sessions'}
                      data-testid="toggle-sessions"
                    >
                      <Hash className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sessions</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 w-7 p-0 rounded-md border",
                        metric === 'hours'
                          ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
                          : "hover:bg-accent"
                      )}
                      onClick={() => toggleMetric('hours')}
                      aria-label="Hours"
                      aria-pressed={metric === 'hours'}
                      data-testid="toggle-hours"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Hours</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Mobile Controls */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 rounded-full border hover:bg-accent"
                    aria-label="More options"
                    data-testid="mobile-menu-trigger"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Timeframe</div>
                  <DropdownMenuItem
                    onClick={() => toggleTimeframe('week')}
                    className={timeframe === 'week' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : ''}
                    data-testid="mobile-week"
                  >
                    <div className="mr-2 h-4 w-4 flex items-center justify-center text-xs font-semibold">W</div>
                    Week
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toggleTimeframe('month')}
                    className={timeframe === 'month' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : ''}
                    data-testid="mobile-month"
                  >
                    <div className="mr-2 h-4 w-4 flex items-center justify-center text-xs font-semibold">M</div>
                    Month
                  </DropdownMenuItem>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Metric</div>
                  <DropdownMenuItem
                    onClick={() => toggleMetric('sessions')}
                    className={metric === 'sessions' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : ''}
                    data-testid="mobile-sessions"
                  >
                    <Hash className="mr-2 h-4 w-4" />
                    Sessions
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toggleMetric('hours')}
                    className={metric === 'hours' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : ''}
                    data-testid="mobile-hours"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Hours
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 md:p-3 lg:p-4 pt-0">
          {/* Main Value with Chip */}
          <div className="flex items-baseline gap-2 mb-2">
            <div className={cn(
              "text-2xl md:text-3xl font-semibold transition-all duration-300",
              "group-hover:text-blue-700 dark:group-hover:text-blue-300 group-hover:scale-105",
              isLoading && "animate-pulse text-muted-foreground"
            )} data-testid="stat-value">
              {displayValue}
            </div>
            {!isLoading && total > 0 && (
              <div className="rounded-full bg-muted text-[10px] px-2 py-[2px] text-muted-foreground" data-testid="stat-chip">
                {chipText}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {!isLoading && total > 0 && (
            <Progress 
              value={progressPercentage} 
              className="h-[2px]" 
              data-testid="stat-progress"
            />
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}