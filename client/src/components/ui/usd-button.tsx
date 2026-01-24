import { DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface UsdButtonProps {
  showUsd: boolean;
  onToggle: () => void;
  isLoading?: boolean;
  isAvailable: boolean;
  defaultCurrency: string;
  rateInfo?: {
    rate: number;
    cached: boolean;
    expiresIn?: number;
  };
}

export function UsdButton({ 
  showUsd, 
  onToggle, 
  isLoading, 
  isAvailable,
  defaultCurrency,
  rateInfo
}: UsdButtonProps) {
  if (!isAvailable) {
    return null;
  }

  const formatExpiryTime = (minutes?: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            disabled={isLoading}
            className={cn(
              "h-6 w-6 p-0 rounded-full transition-all",
              showUsd 
                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-400 dark:hover:bg-green-900/70" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <DollarSign className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          <div className="text-xs">
            <p className="font-medium mb-1">
              {showUsd ? `Showing in USD` : `Show in USD`}
            </p>
            {rateInfo && showUsd && (
              <div className="text-muted-foreground">
                <p>1 USD = {rateInfo.rate.toFixed(2)} {defaultCurrency}</p>
                {rateInfo.expiresIn && (
                  <p className="text-[10px] mt-1">
                    {rateInfo.cached ? 'Cached' : 'Fresh'} rate
                    {rateInfo.expiresIn > 0 && ` (expires in ${formatExpiryTime(rateInfo.expiresIn)})`}
                  </p>
                )}
              </div>
            )}
            {!showUsd && (
              <p className="text-muted-foreground">
                Convert {defaultCurrency} amounts to USD
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
