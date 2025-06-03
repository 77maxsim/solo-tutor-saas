import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ScheduleSessionModal } from "@/components/modals/schedule-session-modal";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

// Pages
import Dashboard from "@/pages/dashboard";
import Calendar from "@/pages/calendar";
import Earnings from "@/pages/earnings";
import Students from "@/pages/students";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/earnings" component={Earnings} />
      <Route path="/students" component={Students} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!loading && !user) {
      setLocation('/auth');
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      {user ? <Route path="/*" component={AuthenticatedRouter} /> : null}
    </Switch>
  );
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case "/":
        return "Dashboard";
      case "/calendar":
        return "Calendar";
      case "/earnings":
        return "Earnings";
      case "/students":
        return "Students";
      default:
        return "TutorTrack";
    }
  };

  const handleScheduleSession = () => {
    setIsScheduleModalOpen(true);
  };

  // Listen for custom events to open the schedule modal from anywhere in the app
  useEffect(() => {
    const handleOpenScheduleModal = () => {
      setIsScheduleModalOpen(true);
    };

    window.addEventListener('openScheduleModal', handleOpenScheduleModal);
    
    return () => {
      window.removeEventListener('openScheduleModal', handleOpenScheduleModal);
    };
  }, []);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar onScheduleSession={handleScheduleSession} />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <div className="md:hidden">
            <MobileHeader
              title={getPageTitle(window.location.pathname)}
              onMenuClick={() => setSidebarOpen(true)}
            />
          </div>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar onScheduleSession={handleScheduleSession} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Router />
      </div>

      {/* Global Schedule Session Modal */}
      <ScheduleSessionModal 
        open={isScheduleModalOpen} 
        onOpenChange={setIsScheduleModalOpen} 
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppLayout />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
