import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  LayoutDashboard, 
  Calendar, 
  DollarSign, 
  Users, 
  Plus,
  LogOut,
  Settings,
  Shield
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentTutorId } from "@/lib/tutorHelpers";
import classterLogo from "@assets/Blue and Light Gray Modern Company Logo (2)_1760973142069.png";

import { usePendingSessions } from "@/hooks/use-pending-sessions";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Earnings", href: "/earnings", icon: DollarSign },
  { name: "Students", href: "/students", icon: Users },
  { name: "Availability", href: "/availability", icon: Calendar },
];

interface SidebarProps {
  onScheduleSession?: () => void;
  onCloseMobile?: () => void;
}

export function Sidebar({ onScheduleSession, onCloseMobile }: SidebarProps) {
  const [location] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { data: pendingCount = 0, isLoading: isPendingLoading } = usePendingSessions();
  


  // Handle navigation click on mobile
  const handleNavClick = () => {
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  // Handle schedule session with mobile close
  const handleScheduleSessionClick = () => {
    if (onScheduleSession) {
      onScheduleSession();
    }
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  // Fetch tutor profile data including avatar and admin status
  const { data: tutorProfile } = useQuery({
    queryKey: ['tutor-profile-sidebar'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('tutors')
        .select('id, full_name, email, avatar_url, is_admin')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor profile:', error);
        throw error;
      }

      return data;
    },
  });



  const handleLogout = async () => {
    try {
      // Clear all cached queries to prevent data leakage between users
      queryClient.clear();
      
      // Clear session-specific localStorage items for fresh login experience
      sessionStorage.removeItem("confettiShown");
      localStorage.removeItem("dashboardBannerDismissedAt");
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          variant: "destructive",
          title: "Logout Failed",
          description: error.message,
        });
      } else {
        toast({
          title: "Logged out successfully",
          description: "You have been signed out of your account.",
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during logout.",
      });
    }
  };

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r border-border animate-slide-up">
      {/* Logo/Brand Header with Hover Effect */}
      <Link href="/dashboard">
        <div className="flex items-center justify-center px-4 py-6 border-b border-border hover-lift cursor-pointer group" onClick={handleNavClick}>
          <img 
            src={classterLogo} 
            alt="Classter" 
            className="w-full max-w-[180px] h-auto transition-all duration-300 group-hover:scale-105"
          />
        </div>
      </Link>

      {/* Navigation Menu with Enhanced Interactions */}
      <nav className="flex-1 space-y-2 px-4 py-6">
        {navigation.map((item, index) => {
          // Handle dashboard route matching for both "/" and "/dashboard"
          const isActive = item.href === "/" ? (location === "/" || location === "/dashboard") : location === item.href;
          const isCalendar = item.name === "Calendar";
          const showBadge = isCalendar && pendingCount > 0;
          
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 group hover-lift relative overflow-hidden",
                  "animate-slide-up",
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md"
                )}
                style={{animationDelay: `${index * 0.1}s`}}
                onClick={handleNavClick}
              >
                <item.icon className={cn(
                  "h-4 w-4 transition-all duration-300",
                  isActive ? "animate-bounce-subtle" : "group-hover:scale-110"
                )} />
                <span className="group-hover:translate-x-1 transition-transform duration-200">
                  {item.name}
                </span>
                {showBadge && (
                  <Badge 
                    variant="destructive" 
                    className="ml-auto text-xs px-1.5 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center"
                  >
                    {pendingCount}
                  </Badge>
                )}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse" />
                )}
              </div>
            </Link>
          );
        })}

        {/* Admin Dashboard Link - Only for Admin Users */}
        {tutorProfile?.is_admin && (
          <Link href="/admin">
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 group hover-lift relative overflow-hidden mt-2",
                location === "/admin"
                  ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md"
              )}
              onClick={handleNavClick}
              data-testid="link-admin-dashboard"
            >
              <Shield className={cn(
                "h-4 w-4 transition-all duration-300",
                location === "/admin" ? "animate-bounce-subtle" : "group-hover:scale-110"
              )} />
              <span className="group-hover:translate-x-1 transition-transform duration-200">
                Admin Dashboard
              </span>
              {location === "/admin" && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 animate-pulse" />
              )}
            </div>
          </Link>
        )}

        <Separator className="my-6 animate-fade-in" style={{animationDelay: '0.5s'}} />

        {/* Quick Actions with Enhanced Styling */}
        <div className="space-y-2 animate-slide-up" style={{animationDelay: '0.6s'}}>
          <Button 
            onClick={handleScheduleSessionClick} 
            className="w-full hover-lift click-scale bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2 animate-bounce-subtle" />
            Schedule Session
          </Button>
        </div>
      </nav>

      {/* User Profile Section with Micro-interactions */}
      <div className="border-t border-border p-4 animate-fade-in" style={{animationDelay: '0.8s'}}>
        <Link href="/profile">
          <div 
            className="flex items-center gap-3 mb-3 group hover-lift cursor-pointer p-2 rounded-lg transition-all duration-200 hover:bg-accent/50"
            onClick={handleNavClick}
          >
            <Avatar className="h-10 w-10 hover-scale transition-all duration-300 group-hover:shadow-lg">
              {tutorProfile?.avatar_url ? (
                <AvatarImage 
                  src={tutorProfile.avatar_url} 
                  alt={tutorProfile.full_name || "Profile"} 
                  className="transition-all duration-300"
                />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white font-semibold">
                {tutorProfile?.full_name 
                  ? tutorProfile.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                  : 'TU'
                }
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors duration-200">
                {tutorProfile?.full_name || 'Tutor'}
              </p>
              <p className="text-xs text-muted-foreground truncate group-hover:text-muted-foreground/80 transition-colors duration-200">
                {tutorProfile?.email || 'Classter User'}
              </p>
            </div>
            <Settings className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:rotate-[360deg] transition-all duration-500" />
          </div>
        </Link>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex-1 text-xs mr-2"
            >
              <LogOut className="h-3 w-3 mr-2" />
              Sign Out
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
