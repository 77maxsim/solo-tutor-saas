
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [selectedHour, setSelectedHour] = React.useState(12);
  const [selectedMinute, setSelectedMinute] = React.useState(0);
  const [selectedPeriod, setSelectedPeriod] = React.useState<'AM' | 'PM'>('AM');
  const [minuteInput, setMinuteInput] = React.useState('00');
  
  // Parse the current time value and update internal state
  React.useEffect(() => {
    if (value) {
      const [hours, minutes] = value.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      
      setSelectedHour(displayHours);
      setSelectedMinute(minutes);
      setSelectedPeriod(period);
      setMinuteInput(minutes.toString().padStart(2, '0'));
    }
  }, [value]);

  const formatTime = (hours: number, minutes: number, period: 'AM' | 'PM') => {
    const hour24 = period === 'AM' 
      ? (hours === 12 ? 0 : hours)
      : (hours === 12 ? 12 : hours + 12);
    
    return `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const handleTimeChange = (newHours?: number, newMinutes?: number, newPeriod?: 'AM' | 'PM') => {
    const hours = newHours ?? selectedHour;
    const minutes = newMinutes ?? selectedMinute;
    const period = newPeriod ?? selectedPeriod;
    
    setSelectedHour(hours);
    setSelectedMinute(minutes);
    setSelectedPeriod(period);
    
    const formattedTime = formatTime(hours, minutes, period);
    onChange(formattedTime);
  };

  const handleMinuteInputChange = (inputValue: string) => {
    setMinuteInput(inputValue);
    
    // Only update if it's a valid minute (0-59)
    const minute = parseInt(inputValue, 10);
    if (!isNaN(minute) && minute >= 0 && minute <= 59) {
      handleTimeChange(undefined, minute, undefined);
    }
  };

  const handleMinuteInputBlur = () => {
    // Ensure the input shows the correct format on blur
    const minute = parseInt(minuteInput, 10);
    if (!isNaN(minute) && minute >= 0 && minute <= 59) {
      setMinuteInput(minute.toString().padStart(2, '0'));
    } else {
      // Reset to current selected minute if invalid
      setMinuteInput(selectedMinute.toString().padStart(2, '0'));
    }
  };

  // Generate hour options (1-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const quickMinutes = [0, 15, 30, 45];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-10",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value ? formatDisplayTime(value) : placeholder}
          <Clock className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center">
            <h3 className="text-lg font-semibold">Select Time</h3>
            <p className="text-sm text-muted-foreground mt-1">Choose hour, minute, and period</p>
          </div>
          
          {/* Time Display */}
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">
              {selectedHour}:{selectedMinute.toString().padStart(2, '0')} {selectedPeriod}
            </div>
          </div>

          {/* Hour Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Hour</label>
            <div className="grid grid-cols-4 gap-2">
              {hourOptions.map((hour) => (
                <Button
                  key={hour}
                  variant={selectedHour === hour ? "default" : "outline"}
                  size="sm"
                  className="h-10 text-sm font-medium"
                  onClick={() => handleTimeChange(hour, undefined, undefined)}
                >
                  {hour}
                </Button>
              ))}
            </div>
          </div>

          {/* Minute Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Minute</label>
            
            {/* Custom minute input */}
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min="0"
                max="59"
                value={minuteInput}
                onChange={(e) => handleMinuteInputChange(e.target.value)}
                onBlur={handleMinuteInputBlur}
                className="w-20 text-center"
                placeholder="00"
              />
              <span className="text-sm text-muted-foreground">or choose preset:</span>
            </div>
            
            {/* Quick minute buttons */}
            <div className="grid grid-cols-4 gap-2">
              {quickMinutes.map((minute) => (
                <Button
                  key={minute}
                  variant={selectedMinute === minute ? "default" : "outline"}
                  size="sm"
                  className="h-10 text-sm font-medium"
                  onClick={() => {
                    handleTimeChange(undefined, minute, undefined);
                    setMinuteInput(minute.toString().padStart(2, '0'));
                  }}
                >
                  :{minute.toString().padStart(2, '0')}
                </Button>
              ))}
            </div>
          </div>

          {/* Period Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Period</label>
            <div className="grid grid-cols-2 gap-2">
              {(['AM', 'PM'] as const).map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? "default" : "outline"}
                  size="sm"
                  className="h-10 text-sm font-medium"
                  onClick={() => handleTimeChange(undefined, undefined, period)}
                >
                  {period}
                </Button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                const hours = now.getHours();
                const minutes = now.getMinutes();
                const period = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                handleTimeChange(displayHours, minutes, period);
                setMinuteInput(minutes.toString().padStart(2, '0'));
              }}
            >
              Current Time
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
