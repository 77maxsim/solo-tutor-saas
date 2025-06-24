import { ReactNode, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getAvatarDisplay } from "@/lib/avatarUtils";
import { Student } from "@shared/schema";
import { cn } from "@/lib/utils";

interface StudentAvatarTooltipProps {
  student: Student;
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  showStats?: boolean;
  className?: string;
  onClick?: () => void;
}

interface StudentStats {
  totalSessions?: number;
  upcomingSessions?: number;
  lastSessionDate?: string;
}

export function StudentAvatarTooltip({ 
  student, 
  children, 
  size = 'md', 
  showName = true,
  showStats = false,
  className,
  onClick 
}: StudentAvatarTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-lg', 
    lg: 'w-12 h-12 text-xl'
  };

  const avatarDisplay = getAvatarDisplay(student.avatar_url);

  const renderAvatar = () => {
    const baseClasses = cn(
      "rounded-full transition-all duration-300 ease-in-out cursor-pointer",
      "hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-blue-200 dark:hover:ring-blue-400",
      "transform-gpu", // Use GPU acceleration for smooth animations
      sizeClasses[size],
      isHovered && "scale-105 shadow-md ring-1 ring-blue-100 dark:ring-blue-800",
      className
    );

    if (avatarDisplay.type === 'image') {
      return (
        <img
          src={`${avatarDisplay.content}?t=${Date.now()}`}
          alt={`${student.name}'s avatar`}
          className={cn(baseClasses, "object-cover")}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/default-avatar.svg';
          }}
        />
      );
    } else if (avatarDisplay.type === 'emoji') {
      return (
        <div className={cn(
          baseClasses, 
          "bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900",
          "flex items-center justify-center border border-blue-200 dark:border-blue-700"
        )}>
          <span className="animate-bounce-subtle">{avatarDisplay.content}</span>
        </div>
      );
    } else {
      return (
        <img
          src="/default-avatar.svg"
          alt={`${student.name}'s avatar`}
          className={cn(baseClasses, "object-cover bg-gray-100 dark:bg-gray-800")}
        />
      );
    }
  };

  const tooltipContent = (
    <div className="text-center space-y-2 max-w-xs">
      <div className="flex items-center justify-center gap-2">
        <div className="relative">
          {renderAvatar()}
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"></div>
        </div>
      </div>
      
      {showName && (
        <div>
          <p className="font-semibold text-sm text-foreground">{student.name}</p>
          {student.tags && student.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center mt-1">
              {student.tags.slice(0, 3).map((tag, index) => (
                <span 
                  key={tag}
                  className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full animate-in fade-in-0 slide-in-from-bottom-2"
                  style={{animationDelay: `${index * 100}ms`}}
                >
                  {tag}
                </span>
              ))}
              {student.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{student.tags.length - 3} more</span>
              )}
            </div>
          )}
        </div>
      )}

      {showStats && (
        <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-2">
          <p>Click to view session history</p>
          <p>Last session: Recently</p>
        </div>
      )}
    </div>
  );

  if (children) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="inline-block"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={onClick}
            >
              {children}
            </div>
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"
          >
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="inline-block"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
          >
            {renderAvatar()}
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"
        >
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}