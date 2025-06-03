import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  LayoutDashboard, 
  Calendar, 
  DollarSign, 
  Users, 
  GraduationCap,
  Plus
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Earnings", href: "/earnings", icon: DollarSign },
  { name: "Students", href: "/students", icon: Users },
];

interface SidebarProps {
  onScheduleSession?: () => void;
}

export function Sidebar({ onScheduleSession }: SidebarProps) {
  const [location] = useLocation();

  const handleScheduleSession = () => {
    if (onScheduleSession) {
      onScheduleSession();
    } else {
      alert("Schedule Session functionality will be implemented next!");
    }
  };

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-border">
      {/* Logo/Brand Header */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <GraduationCap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground">TutorTrack</span>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-2 px-4 py-6">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </div>
            </Link>
          );
        })}

        <Separator className="my-6" />

        {/* Quick Actions */}
        <div className="space-y-2">
          <Button onClick={handleScheduleSession} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Schedule Session
          </Button>
        </div>
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>SJ</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              Sarah Johnson
            </p>
            <p className="text-xs text-muted-foreground truncate">
              English Tutor
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
