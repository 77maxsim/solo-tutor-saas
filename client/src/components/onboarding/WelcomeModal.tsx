import { useOnboarding } from '@/contexts/OnboardingContext';
import { Link } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  User, 
  Calendar, 
  MessageCircle,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const stepDetails = [
  {
    id: 'profile',
    icon: User,
    title: 'Complete Your Profile',
    description: 'Set up your name, timezone, and currency so sessions are displayed correctly.',
    time: '1 min',
  },
  {
    id: 'session',
    icon: Calendar,
    title: 'Set Up Your First Class',
    description: 'Schedule your first tutoring session to get started.',
    time: '2 min',
  },
  {
    id: 'telegram',
    icon: MessageCircle,
    title: 'Connect Telegram',
    description: 'Get daily summaries and instant booking alerts on your phone.',
    time: '2 min',
  },
];

export function WelcomeModal() {
  const { 
    showWelcomeModal, 
    setShowWelcomeModal, 
    steps,
    completedSteps,
    totalSteps,
    progressPercent,
    dismissOnboarding
  } = useOnboarding();

  const nextIncompleteStep = steps.find(s => !s.completed);

  const handleGetStarted = () => {
    setShowWelcomeModal(false);
  };

  const handleSkipOnboarding = () => {
    dismissOnboarding();
    setShowWelcomeModal(false);
  };

  // Handle all modal close paths (backdrop click, X button, escape key)
  // to persist the dismissal to database
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      dismissOnboarding();
    }
    setShowWelcomeModal(open);
  };

  return (
    <Dialog open={showWelcomeModal} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="welcome-modal">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl" data-testid="welcome-modal-title">Welcome to Classter!</DialogTitle>
          <DialogDescription className="text-base">
            Let's get your tutoring dashboard ready in just a few minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Setup Progress</span>
            <span className="text-sm font-medium">{completedSteps}/{totalSteps} completed</span>
          </div>
          <Progress value={progressPercent} className="h-2" data-testid="welcome-progress-bar" />
        </div>

        <div className="space-y-3 py-2">
          {stepDetails.map((step, index) => {
            const isCompleted = steps.find(s => s.id === step.id)?.completed;
            const Icon = step.icon;
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                  isCompleted 
                    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" 
                    : "bg-muted/30 border-muted"
                )}
                data-testid={`welcome-step-${step.id}`}
              >
                <div className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                  isCompleted 
                    ? "bg-green-500 text-white" 
                    : "bg-primary/10 text-primary"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "font-medium text-sm",
                      isCompleted && "text-green-700 dark:text-green-400"
                    )}>
                      {step.title}
                    </p>
                    {!isCompleted && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        ~{step.time}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 pt-4">
          {nextIncompleteStep ? (
            <Link href={nextIncompleteStep.href || '/'}>
              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleGetStarted}
                data-testid="button-get-started"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button 
              className="w-full" 
              size="lg" 
              onClick={handleGetStarted}
              data-testid="button-close-welcome"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground" 
            onClick={handleSkipOnboarding}
            data-testid="button-skip-onboarding"
          >
            I'll do this later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
