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
import EarningsTest from "@/pages/earnings-test";
import Students from "@/pages/students";
import Profile from "@/pages/profile";
import Activity from "@/pages/activity";
import UpcomingSessions from "./pages/upcoming-sessions";
import UnpaidSessions from "./pages/unpaid-sessions";
import NotFound from "./pages/not-found";
import AuthPage from "./pages/AuthPage.tsx";

// Create protected versions of each component
const ProtectedDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <Dashboard /> : null;
};

const ProtectedCalendar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <Calendar /> : null;
};

const ProtectedEarnings = () => {
  console.log("🧪 [ProtectedEarnings] Wrapper component mounting - ENTRY POINT");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log("🧪 [ProtectedEarnings] useEffect running, checking auth session");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("🧪 [ProtectedEarnings] Auth session result:", session?.user?.id);
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        console.log("🧪 [ProtectedEarnings] No user found, redirecting to auth");
        setLocation('/auth');
      } else {
        console.log("🧪 [ProtectedEarnings] User authenticated, proceeding to Earnings");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [setLocation]);

  if (loading) {
    console.log("🧪 [ProtectedEarnings] Still loading, showing spinner");
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  console.log("🧪 [ProtectedEarnings] Loading complete, user:", user?.id, "rendering:", user ? "Earnings component" : "null");
  return user ? <Earnings /> : null;
};

const ProtectedStudents = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <Students /> : null;
};

const ProtectedProfile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <Profile /> : null;
};

const ProtectedActivity = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <Activity /> : null;
};

const ProtectedUpcomingSessions = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        setLocation('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <UpcomingSessions /> : null;
};

function Router() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      <Route path="/" component={ProtectedDashboard} />
      <Route path="/dashboard" component={ProtectedDashboard} />
      <Route path="/calendar" component={ProtectedCalendar} />
      <Route path="/earnings" component={EarningsTest} />
      <Route path="/students" component={ProtectedStudents} />
      <Route path="/profile" component={ProtectedProfile} />
      <Route path="/activity" component={ProtectedActivity} />
      <Route path="/upcoming-sessions" component={ProtectedUpcomingSessions} />
      <Route path="/unpaid-sessions" component={UnpaidSessions} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [location] = useLocation();

  // Track authentication state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      case "/profile":
        return "Profile";
      case "/activity":
        return "Activity";
      case "/upcoming-sessions":
        return "Upcoming Sessions";
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

  // Check if we're on the auth page
  const isAuthPage = location === '/auth';

  // Show navigation only if user is authenticated and not on auth page
  const showNavigation = user && !isAuthPage && !loading;

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
    <div className={cn("h-screen bg-slate-50", !showNavigation && "flex flex-col")}>
      {showNavigation ? (
        // Authenticated layout with sidebar
        <div className="flex h-full">
          {/* Desktop Sidebar */}
          <div className="hidden md:flex md:w-64 md:flex-shrink-0">
            <Sidebar onScheduleSession={handleScheduleSession} />
          </div>

          {/* Mobile Sidebar */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <div className="md:hidden fixed top-0 left-0 right-0 z-40">
                <MobileHeader
                  title={getPageTitle(location)}
                  onMenuClick={() => setSidebarOpen(true)}
                />
              </div>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar onScheduleSession={handleScheduleSession} />
            </SheetContent>
          </Sheet>

          {/* Main Content - Full width on mobile, reduced width on desktop */}
          <div className="flex-1 flex flex-col min-w-0 w-full md:w-[calc(100%-16rem)] pt-16 md:pt-0">
            <Router />
          </div>

          {/* Global Schedule Session Modal */}
          <ScheduleSessionModal 
            open={isScheduleModalOpen} 
            onOpenChange={setIsScheduleModalOpen} 
          />
        </div>
      ) : (
        // Unauthenticated layout (auth page)
        <div className="flex flex-col h-full">
          <Router />
        </div>
      )}
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