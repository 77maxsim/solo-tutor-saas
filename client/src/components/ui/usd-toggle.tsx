import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UsdToggleProps {
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

export function UsdToggle({ 
  showUsd, 
  onToggle, 
  isLoading, 
  isAvailable,
  defaultCurrency,
  rateInfo
}: UsdToggleProps) {
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
          <div className="flex items-center gap-2">
            <Switch
              id="usd-toggle"
              checked={showUsd}
              onCheckedChange={onToggle}
              disabled={isLoading}
              className="data-[state=checked]:bg-green-600"
            />
            <Label 
              htmlFor="usd-toggle" 
              className="text-xs font-medium text-muted-foreground cursor-pointer flex items-center gap-1"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <DollarSign className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">USD</span>
            </Label>
          </div>
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
