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
            variant="outline"
            size="sm"
            onClick={onToggle}
            disabled={isLoading}
            className={cn(
              "h-6 px-1.5 py-0 text-[10px] font-medium rounded transition-all border",
              showUsd 
                ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/70" 
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <DollarSign className="h-3 w-3" />
                <span className="ml-0.5">USD</span>
              </>
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
