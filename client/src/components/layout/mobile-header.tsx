import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface MobileHeaderProps {
  title: string;
  onMenuClick: () => void;
}

export function MobileHeader({ title, onMenuClick }: MobileHeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 bg-white border-b border-border md:hidden">
      <Button variant="ghost" size="icon" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <div className="w-8" />
    </header>
  );
}
