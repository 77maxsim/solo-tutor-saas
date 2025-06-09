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

  // Parse the current time value and update internal state
  React.useEffect(() => {
    if (value) {
      const [hours, minutes] = value.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

      setSelectedHour(displayHours);
      setSelectedMinute(minutes);
      setSelectedPeriod(period);
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

  // Generate hour options (1-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  // Generate minute options (0-59)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i);

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
      <PopoverContent className="w-64 p-4" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div className="text-center">
            <h3 className="font-semibold">Select Time</h3>
            <div className="text-2xl font-bold text-primary mt-2">
              {selectedHour}:{selectedMinute.toString().padStart(2, '0')} {selectedPeriod}
            </div>
          </div>

          {/* Time Controls */}
          <div className="grid grid-cols-3 gap-3">
            {/* Hour */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Hour</label>
              <select
                value={selectedHour}
                onChange={(e) => handleTimeChange(parseInt(e.target.value), undefined, undefined)}
                className="w-full p-2 border rounded-md text-sm"
              >
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </div>

            {/* Minute */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Min</label>
              <select
                value={selectedMinute}
                onChange={(e) => handleTimeChange(undefined, parseInt(e.target.value), undefined)}
                className="w-full p-2 border rounded-md text-sm"
              >
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            {/* Period */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Period</label>
              <select
                value={selectedPeriod}
                onChange={(e) => handleTimeChange(undefined, undefined, e.target.value as 'AM' | 'PM')}
                className="w-full p-2 border rounded-md text-sm"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex justify-between items-center pt-3 border-t">
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