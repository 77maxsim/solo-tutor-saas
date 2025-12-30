import { Link } from 'wouter';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Circle, 
  User, 
  Calendar, 
  Users, 
  MessageCircle,
  Sparkles,
  X,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const stepIcons: Record<string, React.ElementType> = {
  profile: User,
  availability: Calendar,
  student: Users,
  telegram: MessageCircle,
};

export function OnboardingChecklist() {
  const { 
    steps, 
    completedSteps, 
    totalSteps, 
    progressPercent, 
    isOnboardingComplete,
    isOnboardingDismissed,
    dismissOnboarding,
    isLoading
  } = useOnboarding();

  if (isLoading || isOnboardingComplete || isOnboardingDismissed) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-lg" data-testid="onboarding-checklist">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Getting Started</CardTitle>
              <Badge variant="secondary" className="ml-2" data-testid="onboarding-progress-badge">
                {completedSteps}/{totalSteps} complete
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={dismissOnboarding}
              data-testid="button-dismiss-onboarding"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progressPercent} className="h-2 mt-3" data-testid="onboarding-progress-bar" />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <AnimatePresence>
              {steps.map((step, index) => {
                const Icon = stepIcons[step.id] || Circle;
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link href={step.href || '#'}>
                      <div 
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer group",
                          step.completed 
                            ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900" 
                            : "bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/20"
                        )}
                        data-testid={`onboarding-step-${step.id}`}
                      >
                        <div className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                          step.completed 
                            ? "bg-green-500 text-white" 
                            : "bg-primary/10 text-primary"
                        )}>
                          {step.completed ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium text-sm",
                            step.completed && "text-green-700 dark:text-green-400"
                          )}>
                            {step.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {step.description}
                          </p>
                        </div>
                        {!step.completed && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
