import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ScheduleSessionModal } from "@/components/modals/schedule-session-modal";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Pages
import Dashboard from "@/pages/dashboard";
import Calendar from "@/pages/calendar";
import Earnings from "@/pages/earnings";
import Students from "@/pages/students";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/earnings" component={Earnings} />
      <Route path="/students" component={Students} />
      <Route component={NotFound} />
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
