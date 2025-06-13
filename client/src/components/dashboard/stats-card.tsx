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
        "hover:shadow-lg hover:shadow-blue-100/50 border-2 hover:border-blue-200",
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
              isHovered ? "text-blue-600" : "text-muted-foreground"
            )}>
              {title}
            </p>
            <p className={cn(
              "text-2xl font-bold transition-all duration-300",
              isHovered ? "text-blue-700 scale-105" : "text-foreground",
              isLoading && "animate-pulse text-muted-foreground"
            )}>
              {value}
            </p>
          </div>
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110",
            iconBgColor,
            isHovered && "shadow-lg animate-pulse-glow"
          )}>
            <Icon className={cn(
              "h-6 w-6 transition-all duration-300",
              iconColor,
              isHovered && "animate-bounce-subtle"
            )} />
          </div>
        </div>
        {change && !isLoading && (
          <div className="mt-3 animate-slide-up" style={{animationDelay: '0.2s'}}>
            <span
              className={cn(
                "text-sm font-medium transition-all duration-200 hover:scale-105 inline-block",
                changeType === "positive" && "text-green-600 hover:text-green-700",
                changeType === "negative" && "text-red-600 hover:text-red-700",
                changeType === "neutral" && "text-muted-foreground hover:text-foreground"
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
