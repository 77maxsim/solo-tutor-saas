import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentTutorId } from '@/lib/tutorHelpers';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href?: string;
  action?: string;
}

interface OnboardingContextType {
  steps: OnboardingStep[];
  completedSteps: number;
  totalSteps: number;
  progressPercent: number;
  isOnboardingComplete: boolean;
  isLoading: boolean;
  showWelcomeModal: boolean;
  setShowWelcomeModal: (show: boolean) => void;
  refreshProgress: () => void;
  dismissOnboarding: () => void;
  isOnboardingDismissed: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);

  const { data: onboardingData, isLoading, refetch } = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const tutorId = await getCurrentTutorId();
      if (!tutorId) return null;

      const { data: tutor, error: tutorError } = await supabase
        .from('tutors')
        .select('id, full_name, avatar_url, timezone, currency, telegram_chat_id, google_calendar_connected, onboarding_completed, onboarding_dismissed')
        .eq('user_id', user.id)
        .single();

      if (tutorError) {
        console.error('Error fetching tutor for onboarding:', tutorError);
        return null;
      }

      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id')
        .eq('tutor_id', tutorId)
        .limit(1);

      const hasSessions = sessions && sessions.length > 0;
      const hasProfileCompleted = !!(tutor.full_name && tutor.full_name.trim() && tutor.timezone && tutor.currency);
      const hasTelegram = !!tutor.telegram_chat_id;

      return {
        tutor,
        hasProfileCompleted,
        hasSessions,
        hasTelegram,
        onboardingCompleted: tutor.onboarding_completed || false,
        onboardingDismissed: tutor.onboarding_dismissed || false,
      };
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const steps: OnboardingStep[] = [
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Add your name, timezone, and currency preferences',
      completed: onboardingData?.hasProfileCompleted || false,
      href: '/profile',
      action: 'Go to Profile',
    },
    {
      id: 'session',
      title: 'Set Up Your First Class',
      description: 'Schedule your first tutoring session to get started',
      completed: onboardingData?.hasSessions || false,
      href: '/calendar',
      action: 'Schedule Class',
    },
    {
      id: 'telegram',
      title: 'Connect Telegram Notifications',
      description: 'Get daily summaries and booking alerts on Telegram',
      completed: onboardingData?.hasTelegram || false,
      href: '/profile',
      action: 'Connect Telegram',
    },
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);
  const isOnboardingComplete = completedSteps === totalSteps;

  useEffect(() => {
    if (onboardingData?.onboardingDismissed) {
      setIsOnboardingDismissed(true);
    }
  }, [onboardingData?.onboardingDismissed]);

  // Auto-mark onboarding as complete for existing users who already have 
  // a complete profile and sessions (fixes issue for users who registered 
  // before onboarding feature was added)
  useEffect(() => {
    const autoCompleteOnboarding = async () => {
      if (!onboardingData || isLoading) return;
      
      // If user already has all steps completed but onboarding_completed is not set,
      // automatically update it in the database
      if (
        onboardingData.hasProfileCompleted && 
        onboardingData.hasSessions && 
        !onboardingData.onboardingCompleted
      ) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
          .from('tutors')
          .update({ onboarding_completed: true })
          .eq('user_id', user.id);
        
        refetch();
      }
    };

    autoCompleteOnboarding();
  }, [onboardingData, isLoading, refetch]);

  useEffect(() => {
    if (!isLoading && onboardingData && !onboardingData.onboardingCompleted && !onboardingData.onboardingDismissed) {
      const hasSeenWelcome = localStorage.getItem('onboarding-welcome-seen');
      if (!hasSeenWelcome && completedSteps < totalSteps) {
        setShowWelcomeModal(true);
      }
    }
  }, [isLoading, onboardingData, completedSteps, totalSteps]);

  const refreshProgress = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['tutor-profile'] });
    queryClient.invalidateQueries({ queryKey: ['tutor-info'] });
  }, [refetch, queryClient]);

  const dismissOnboarding = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('tutors')
      .update({ onboarding_dismissed: true })
      .eq('user_id', user.id);

    setIsOnboardingDismissed(true);
    refetch();
  }, [refetch]);

  const handleSetShowWelcomeModal = useCallback((show: boolean) => {
    setShowWelcomeModal(show);
    if (!show) {
      localStorage.setItem('onboarding-welcome-seen', 'true');
    }
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        steps,
        completedSteps,
        totalSteps,
        progressPercent,
        isOnboardingComplete,
        isLoading,
        showWelcomeModal,
        setShowWelcomeModal: handleSetShowWelcomeModal,
        refreshProgress,
        dismissOnboarding,
        isOnboardingDismissed,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
