import { Button } from "@/components/ui/button";
import { Menu, Plus } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface MobileHeaderProps {
  title: string;
  onMenuClick: () => void;
}

export function MobileHeader({ title, onMenuClick }: MobileHeaderProps) {
  const handleScheduleSession = () => {
    // Trigger the global schedule session modal
    window.dispatchEvent(new CustomEvent('openScheduleModal'));
  };

  return (
    <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-b border-border md:hidden">
      <Button variant="ghost" size="icon" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleScheduleSession}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
