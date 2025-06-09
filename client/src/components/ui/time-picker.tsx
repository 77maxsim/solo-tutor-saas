
import React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function TimePicker({ value, onChange, placeholder = "Select time", className }: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  // Parse the current time value
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hours: 12, minutes: 0, period: 'AM' };
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    
    return { hours: displayHours, minutes, period };
  };

  const formatTime = (hours: number, minutes: number, period: string) => {
    const hour24 = period === 'AM' 
      ? (hours === 12 ? 0 : hours)
      : (hours === 12 ? 12 : hours + 12);
    
    return `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return '';
    const { hours, minutes, period } = parseTime(timeStr);
    return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const { hours: currentHours, minutes: currentMinutes, period: currentPeriod } = parseTime(value || '');

  const handleTimeChange = (newHours: number, newMinutes: number, newPeriod: string) => {
    const formattedTime = formatTime(newHours, newMinutes, newPeriod);
    onChange(formattedTime);
  };

  // Generate hour options (1-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  
  // Generate minute options (0, 15, 30, 45)
  const minuteOptions = [0, 15, 30, 45];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value ? formatDisplayTime(value) : placeholder}
          <Clock className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4">
          <div className="text-sm font-medium text-center">Select Time</div>
          
          <div className="flex items-center justify-center space-x-2">
            {/* Hours */}
            <div className="flex flex-col items-center space-y-1">
              <div className="text-xs text-muted-foreground">Hour</div>
              <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
                {hourOptions.map((hour) => (
                  <Button
                    key={hour}
                    variant={currentHours === hour ? "default" : "outline"}
                    size="sm"
                    className="w-12 h-8 text-xs"
                    onClick={() => handleTimeChange(hour, currentMinutes, currentPeriod)}
                  >
                    {hour}
                  </Button>
                ))}
              </div>
            </div>

            <div className="text-lg font-bold">:</div>

            {/* Minutes */}
            <div className="flex flex-col items-center space-y-1">
              <div className="text-xs text-muted-foreground">Min</div>
              <div className="flex flex-col gap-1">
                {minuteOptions.map((minute) => (
                  <Button
                    key={minute}
                    variant={currentMinutes === minute ? "default" : "outline"}
                    size="sm"
                    className="w-12 h-8 text-xs"
                    onClick={() => handleTimeChange(currentHours, minute, currentPeriod)}
                  >
                    {minute.toString().padStart(2, '0')}
                  </Button>
                ))}
              </div>
            </div>

            {/* AM/PM */}
            <div className="flex flex-col items-center space-y-1">
              <div className="text-xs text-muted-foreground">Period</div>
              <div className="flex flex-col gap-1">
                {['AM', 'PM'].map((period) => (
                  <Button
                    key={period}
                    variant={currentPeriod === period ? "default" : "outline"}
                    size="sm"
                    className="w-12 h-8 text-xs"
                    onClick={() => handleTimeChange(currentHours, currentMinutes, period)}
                  >
                    {period}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                const hours = now.getHours();
                const minutes = Math.round(now.getMinutes() / 15) * 15; // Round to nearest 15
                const period = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                handleTimeChange(displayHours, minutes, period);
              }}
            >
              Now
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
