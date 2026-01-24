import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { Sidebar } from "@/components/layout/sidebar";
import { FeedbackButton } from "@/components/FeedbackButton";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ScheduleSessionModal } from "@/components/modals/schedule-session-modal";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { setSentryUser, clearSentryUser } from "./sentry";
import type { User } from "@supabase/supabase-js";

// Pages
import Dashboard from "@/pages/dashboard";
import Calendar from "@/pages/calendar";
import Earnings from "@/pages/earnings";
import Students from "@/pages/students";
import Profile from "@/pages/profile";
import Activity from "@/pages/activity";
import UpcomingSessions from "./pages/upcoming-sessions";
import UnpaidSessions from "./pages/unpaid-sessions";
import Availability from "./pages/availability";
import Admin from "./pages/admin";
import AdminFeedback from "./pages/admin-feedback";
import NotFound from "./pages/not-found";
import AuthPage from "./pages/AuthPage.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import PublicBookingPage from "./pages/public-booking/[tutorId].tsx";
import PrivacyPolicy from "./pages/privacy-policy";

// VERY TOP: log first
console.log('[App boot] at', window.location.href);

// Check if we have Supabase auth tokens in the URL (from password reset email)
// This handles when Supabase redirects to the root domain with auth tokens
const checkForAuthTokensAndRedirect = () => {
  const hash = window.location.hash;
  const search = window.location.search;
  const pathname = window.location.pathname;
  
  const hasAuthTokens = hash.includes('access_token') || 
                        hash.includes('refresh_token') ||
                        hash.includes('type=recovery') ||
                        search.includes('type=recovery');
  
  // Redirect to /auth/callback if we have tokens but not on callback page
  if (hasAuthTokens && pathname !== '/auth/callback') {
    console.log('[App] Auth tokens detected, redirecting to /auth/callback');
    // Preserve the search and hash when redirecting
    window.location.href = '/auth/callback' + search + hash;
    return true;
  }
  return false;
};

// Check immediately on app load
if (checkForAuthTokensAndRedirect()) {
  // Stop further execution if we're redirecting
  // The page will reload with the new URL
}

// PUBLIC routes and recovery URL detection
const PUBLIC_PATHS = ['/auth', '/auth/callback', '/reset-password', '/booking', '/privacy-policy'];

function isPublicPath() {
  const { pathname, search, hash } = window.location;
  // Explicit public pages
  if (PUBLIC_PATHS.includes(pathname)) return true;

  // Be tolerant: any /auth/callback subpath
  if (pathname.startsWith('/auth/callback')) return true;

  // If the URL indicates a recovery flow or has tokens, don't redirect
  if (search.includes('type=recovery')) return true;
  if (hash.includes('type=recovery')) return true;
  if (hash.includes('access_token=')) return true;
  if (hash.includes('refresh_token=')) return true;

  return false;
}

// Create protected versions of each component
const ProtectedDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setAuthReady(true);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;           // wait until INITIAL_SESSION fires
    if (isPublicPath()) return;       // never hijack callback/reset/recovery

    // Check if password reset is pending
    const mustReset = localStorage.getItem('pendingPasswordReset') === '1';
    if (mustReset && location !== '/reset-password') {
      console.log("🔐 Pending password reset detected, redirecting to /reset-password");
      setLocation('/reset-password', { replace: true });
      return;
    }

    if (!user) {
      setLocation('/auth', { replace: true });
    }
  }, [user, authReady, location, setLocation]);

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
  const [authReady, setAuthReady] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setAuthReady(true);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isPublicPath()) return;
    
    // Check if password reset is pending
    const mustReset = localStorage.getItem('pendingPasswordReset') === '1';
    if (mustReset && location !== '/reset-password') {
      console.log("🔐 Pending password reset detected, redirecting to /reset-password");
      setLocation('/reset-password', { replace: true });
      return;
    }
    
    if (!user) {
      setLocation('/auth', { replace: true });
    }
  }, [user, authReady, location, setLocation]);

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setAuthReady(true);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isPublicPath()) return;
    
    // Check if password reset is pending
    const mustReset = localStorage.getItem('pendingPasswordReset') === '1';
    if (mustReset && location !== '/reset-password') {
      console.log("🔐 Pending password reset detected, redirecting to /reset-password");
      setLocation('/reset-password', { replace: true });
      return;
    }
    
    if (!user) {
      setLocation('/auth', { replace: true });
    }
  }, [user, authReady, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <Earnings /> : null;
};

const ProtectedStudents = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setAuthReady(true);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isPublicPath()) return;
    
    // Check if password reset is pending
    const mustReset = localStorage.getItem('pendingPasswordReset') === '1';
    if (mustReset && location !== '/reset-password') {
      console.log("🔐 Pending password reset detected, redirecting to /reset-password");
      setLocation('/reset-password', { replace: true });
      return;
    }
    
    if (!user) {
      setLocation('/auth', { replace: true });
    }
  }, [user, authReady, location, setLocation]);

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
  const [authReady, setAuthReady] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setAuthReady(true);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isPublicPath()) return;
    
    // Check if password reset is pending
    const mustReset = localStorage.getItem('pendingPasswordReset') === '1';
    if (mustReset && location !== '/reset-password') {
      console.log("🔐 Pending password reset detected, redirecting to /reset-password");
      setLocation('/reset-password', { replace: true });
      return;
    }
    
    if (!user) {
      setLocation('/auth', { replace: true });
    }
  }, [user, authReady, location, setLocation]);

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
  const [authReady, setAuthReady] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setAuthReady(true);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isPublicPath()) return;
    
    // Check if password reset is pending
    const mustReset = localStorage.getItem('pendingPasswordReset') === '1';
    if (mustReset && location !== '/reset-password') {
      console.log("🔐 Pending password reset detected, redirecting to /reset-password");
      setLocation('/reset-password', { replace: true });
      return;
    }
    
    if (!user) {
      setLocation('/auth', { replace: true });
    }
  }, [user, authReady, location, setLocation]);

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
  const [authReady, setAuthReady] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setAuthReady(true);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isPublicPath()) return;
    
    // Check if password reset is pending
    const mustReset = localStorage.getItem('pendingPasswordReset') === '1';
    if (mustReset && location !== '/reset-password') {
      console.log("🔐 Pending password reset detected, redirecting to /reset-password");
      setLocation('/reset-password', { replace: true });
      return;
    }
    
    if (!user) {
      setLocation('/auth', { replace: true });
    }
  }, [user, authReady, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <UpcomingSessions /> : null;
};

const ProtectedAvailability = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setAuthReady(true);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isPublicPath()) return;
    
    // Check if password reset is pending
    const mustReset = localStorage.getItem('pendingPasswordReset') === '1';
    if (mustReset && location !== '/reset-password') {
      console.log("🔐 Pending password reset detected, redirecting to /reset-password");
      setLocation('/reset-password', { replace: true });
      return;
    }
    
    if (!user) {
      setLocation('/auth', { replace: true });
    }
  }, [user, authReady, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <Availability /> : null;
};

const ProtectedAdmin = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setAuthReady(true);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isPublicPath()) return;
    
    const mustReset = localStorage.getItem('pendingPasswordReset') === '1';
    if (mustReset && location !== '/reset-password') {
      setLocation('/reset-password', { replace: true });
      return;
    }
    
    if (!user) {
      setLocation('/auth', { replace: true });
    }
  }, [user, authReady, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <Admin /> : null;
};

const ProtectedAdminFeedback = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setAuthReady(true);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isPublicPath()) return;
    
    const mustReset = localStorage.getItem('pendingPasswordReset') === '1';
    if (mustReset && location !== '/reset-password') {
      setLocation('/reset-password', { replace: true });
      return;
    }
    
    if (!user) {
      setLocation('/auth', { replace: true });
    }
  }, [user, authReady, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  return user ? <AdminFeedback /> : null;
};

function Router() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage on app startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log("✅ Session restored on reload:", session.user?.email);
      } else {
        console.log("❌ No session found on reload");
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Keep session synced with storage
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("🔄 Auth state changed:", _event, session?.user?.email);
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
      {/* 1) Force-match callback FIRST */}
      <Route path="/auth/callback">{() => <AuthCallback />}</Route>

      {/* 2) Reset password stays public */}
      <Route path="/reset-password">{() => <ResetPassword />}</Route>

      {/* 3) Auth page (sign in) */}
      <Route path="/auth">{() => <AuthPage />}</Route>

      {/* 4) Public booking */}
      <Route path="/booking/:tutorId" component={PublicBookingPage} />

      {/* 5) Privacy Policy (public) */}
      <Route path="/privacy-policy">{() => <PrivacyPolicy />}</Route>

      {/* 6) Protected routes */}
      <Route path="/" component={ProtectedDashboard} />
      <Route path="/dashboard" component={ProtectedDashboard} />
      <Route path="/calendar" component={ProtectedCalendar} />
      <Route path="/earnings" component={ProtectedEarnings} />
      <Route path="/students" component={ProtectedStudents} />
      <Route path="/profile" component={ProtectedProfile} />
      <Route path="/activity" component={ProtectedActivity} />
      <Route path="/upcoming-sessions" component={ProtectedUpcomingSessions} />
      <Route path="/unpaid-sessions" component={UnpaidSessions} />
      <Route path="/availability" component={ProtectedAvailability} />
      <Route path="/admin" component={ProtectedAdmin} />
      <Route path="/admin/feedback" component={ProtectedAdminFeedback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useLocation();

  // Track authentication state with session persistence
  useEffect(() => {
    // Restore session from localStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log("✅ AppLayout: Session restored on reload:", session.user?.email);
        // Set Sentry user context on initial session restoration
        setSentryUser({
          id: session.user.id,
          email: session.user.email || 'unknown',
          name: session.user.user_metadata?.full_name,
        });
      } else {
        console.log("❌ AppLayout: No session found on reload");
        clearSentryUser();
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Keep session synced with storage and handle PASSWORD_RECOVERY event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("🔄 AppLayout: Auth state changed:", _event, session?.user?.email);
      
      // Update Sentry user context when auth state changes
      if (session?.user) {
        setSentryUser({
          id: session.user.id,
          email: session.user.email || 'unknown',
          name: session.user.user_metadata?.full_name,
        });
      } else {
        clearSentryUser();
      }
      
      // Force password reset for recovery sessions
      if (_event === 'PASSWORD_RECOVERY') {
        console.log("🔐 PASSWORD_RECOVERY event detected, forcing password reset");
        localStorage.setItem('pendingPasswordReset', '1');
        setLocation('/reset-password', { replace: true });
      }
      
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setLocation]);

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
      case "/availability":
        return "Availability";
      case "/admin":
        return "Admin Dashboard";
      default:
        return "Classter";
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

  // Check if we're on a public page that should always be accessible
  const isPublicPage = location === '/auth' || 
                       location === '/auth/callback' || 
                       location === '/reset-password' ||
                       location.startsWith('/booking');

  // Show navigation only if user is authenticated and not on a public page
  const showNavigation = user && !isPublicPage && !loading;

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
    <div className={cn("h-screen bg-background", !showNavigation && "flex flex-col")}>
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
              <Sidebar 
                onScheduleSession={handleScheduleSession} 
                onCloseMobile={() => setSidebarOpen(false)}
              />
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

          {/* Floating Help/Feedback Button */}
          <FeedbackButton />
        </div>
      ) : (
        // Unauthenticated layout (public pages including auth/callback)
        <div className="flex flex-col h-full">
          <Router />
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="tutortrack-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TimezoneProvider>
          <OnboardingProvider>
            <TooltipProvider>
              <Toaster />
              <AppLayout />
              <WelcomeModal />
            </TooltipProvider>
          </OnboardingProvider>
        </TimezoneProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;