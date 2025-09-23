import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStats, TimeframeType, MetricType } from "@/hooks/useSessionStats";

interface StatsCardSessionsProps {
  className?: string;
}

export function StatsCardSessions({ className }: StatsCardSessionsProps) {
  const [timeframe, setTimeframe] = useState<TimeframeType>('month');
  const [metric, setMetric] = useState<MetricType>('sessions');
  
  const { completed, total, isLoading } = useSessionStats(timeframe, metric);
  
  // Calculate progress percentage
  const progressPercentage = total > 0 ? (completed / total) * 100 : 0;
  
  // Format the display value
  const displayValue = isLoading ? '...' : completed.toString();
  const displayLabel = `${metric === 'sessions' ? 'Sessions' : 'Hours'} This ${timeframe === 'week' ? 'Week' : 'Month'}`;
  const captionText = isLoading ? 'Loading...' : `of ${total} total this ${timeframe}`;

  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 200);
  };

  return (
    <Card 
      className={cn(
        "hover-lift cursor-pointer transition-all duration-300 group animate-scale-in",
        "hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-900/20 border-2 hover:border-blue-200 dark:hover:border-blue-700",
        "dark:bg-card dark:shadow-md dark:border-gray-700",
        isClicked && "animate-bounce-subtle",
        isLoading && "shimmer",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      data-testid="card-sessions"
    >
      <CardContent className="p-6">
        {/* Header with Title and Icon */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <p className={cn(
              "text-sm font-medium transition-colors duration-200",
              isHovered ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground dark:text-gray-400"
            )}>
              {displayLabel}
            </p>
          </div>
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110",
            "bg-purple-100 dark:bg-purple-900/20 dark:border dark:border-gray-600",
            isHovered && "shadow-lg animate-pulse-glow dark:shadow-gray-900/50"
          )}>
            <Calendar className={cn(
              "h-6 w-6 transition-all duration-300 text-purple-600 dark:text-purple-400",
              "dark:brightness-125",
              isHovered && "animate-bounce-subtle"
            )} />
          </div>
        </div>

        {/* Toggle Controls */}
        <div className="mb-4 space-y-3">
          {/* Timeframe Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Timeframe:</span>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "px-3 py-1 text-xs rounded-none border-none h-8",
                  timeframe === 'week' 
                    ? "bg-blue-500 text-white hover:bg-blue-600" 
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setTimeframe('week');
                }}
                data-testid="toggle-timeframe-week"
              >
                Week
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "px-3 py-1 text-xs rounded-none border-none h-8",
                  timeframe === 'month' 
                    ? "bg-blue-500 text-white hover:bg-blue-600" 
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setTimeframe('month');
                }}
                data-testid="toggle-timeframe-month"
              >
                Month
              </Button>
            </div>
          </div>
          
          {/* Metric Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Metric:</span>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "px-3 py-1 text-xs rounded-none border-none h-8",
                  metric === 'sessions' 
                    ? "bg-purple-500 text-white hover:bg-purple-600" 
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setMetric('sessions');
                }}
                data-testid="toggle-metric-sessions"
              >
                Sessions
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "px-3 py-1 text-xs rounded-none border-none h-8",
                  metric === 'hours' 
                    ? "bg-purple-500 text-white hover:bg-purple-600" 
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setMetric('hours');
                }}
                data-testid="toggle-metric-hours"
              >
                Hours
              </Button>
            </div>
          </div>
        </div>

        {/* Main Display Value */}
        <div className="mb-2">
          <p className={cn(
            "text-2xl font-bold transition-all duration-300",
            isHovered ? "text-blue-700 dark:text-blue-300 scale-105" : "text-foreground dark:text-gray-100",
            isLoading && "animate-pulse text-muted-foreground dark:text-gray-500"
          )} data-testid="text-main-value">
            {displayValue}
          </p>
        </div>

        {/* Caption */}
        <div className="mb-3">
          <p className="text-sm text-muted-foreground" data-testid="text-caption">
            {captionText}
          </p>
        </div>

        {/* Progress Bar - Only show if total > 0 */}
        {!isLoading && total > 0 && (
          <div className="animate-slide-up" style={{animationDelay: '0.2s'}}>
            <Progress 
              value={progressPercentage} 
              className="h-2" 
              data-testid="progress-sessions"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}