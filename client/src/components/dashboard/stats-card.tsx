import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor,
  iconBgColor,
}: StatsCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 200);
  };

  const isLoading = value === "...";

  return (
    <Card 
      className={cn(
        "hover-lift cursor-pointer transition-all duration-300 group animate-scale-in",
        "hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-900/20 border-2 hover:border-blue-200 dark:hover:border-blue-700",
        "dark:bg-card dark:shadow-md dark:border-gray-700",
        isClicked && "animate-bounce-subtle",
        isLoading && "shimmer"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className={cn(
              "text-sm font-medium transition-colors duration-200",
              isHovered ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground dark:text-gray-400"
            )}>
              {title}
            </p>
            <p className={cn(
              "text-2xl font-bold transition-all duration-300",
              isHovered ? "text-blue-700 dark:text-blue-300 scale-105" : "text-foreground dark:text-gray-100",
              isLoading && "animate-pulse text-muted-foreground dark:text-gray-500"
            )}>
              {value}
            </p>
          </div>
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110",
            iconBgColor,
            "dark:bg-opacity-20 dark:border dark:border-gray-600",
            isHovered && "shadow-lg animate-pulse-glow dark:shadow-gray-900/50"
          )}>
            <Icon className={cn(
              "h-6 w-6 transition-all duration-300",
              iconColor,
              "dark:brightness-125",
              isHovered && "animate-bounce-subtle"
            )} />
          </div>
        </div>
        {change && !isLoading && (
          <div className="mt-3 animate-slide-up" style={{animationDelay: '0.2s'}}>
            <span
              className={cn(
                "text-sm font-medium transition-all duration-200 hover:scale-105 inline-block",
                changeType === "positive" && "text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300",
                changeType === "negative" && "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300",
                changeType === "neutral" && "text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              {change}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
