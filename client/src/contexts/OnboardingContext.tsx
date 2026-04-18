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
  // Track locally dismissed state for optimistic UI updates only
  const [locallyDismissed, setLocallyDismissed] = useState(false);

  const { data: onboardingData, isLoading, refetch } = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const tutorId = await getCurrentTutorId();
      if (!tutorId) return null;

      const { data: tutor, error: tutorError } = await supabase
        .from('tutors')
        .select('id, full_name, avatar_url, timezone, currency, telegram_chat_id, google_calendar_connected, onboarding_completed, onboarding_dismissed, created_at')
        .eq('user_id', user.id)
        .single();

      if (tutorError) {
        console.error('Error fetching tutor for onboarding:', tutorError);
        return null;
      }

      const { count: sessionsCount, error: sessionsError } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('tutor_id', tutorId);

      if (sessionsError) {
        console.error('Error counting sessions for onboarding:', sessionsError);
      }

      const { count: studentsCount, error: studentsError } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('tutor_id', tutorId);

      if (studentsError) {
        console.error('Error counting students for onboarding:', studentsError);
      }

      const hasSessions = (sessionsCount ?? 0) > 0;
      const hasStudents = (studentsCount ?? 0) > 0;
      const hasProfileCompleted = !!(tutor.full_name && tutor.full_name.trim() && tutor.timezone && tutor.currency);
      const hasTelegram = !!tutor.telegram_chat_id;

      // An account is "established" (past onboarding) if it has any sessions,
      // any students, or was created more than 7 days ago. Once established,
      // onboarding is considered complete forever — regardless of optional
      // integrations like Telegram.
      const ESTABLISHED_GRACE_DAYS = 7;
      const accountAgeMs = tutor.created_at
        ? Date.now() - new Date(tutor.created_at).getTime()
        : 0;
      const accountIsOld = accountAgeMs > ESTABLISHED_GRACE_DAYS * 24 * 60 * 60 * 1000;
      const isEstablished = hasSessions || hasStudents || accountIsOld;

      return {
        tutor,
        hasProfileCompleted,
        hasSessions,
        hasStudents,
        hasTelegram,
        isEstablished,
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
  // Onboarding is "complete" if the DB flag is set, OR the account is past
  // its new-user grace window, OR every visible step is checked off. The DB
  // flag and "established" check make this a one-way door: once an account
  // is past onboarding, it never reverts to the checklist again.
  const isOnboardingComplete =
    (onboardingData?.onboardingCompleted ?? false) ||
    (onboardingData?.isEstablished ?? false) ||
    completedSteps === totalSteps;
  
  // Derive dismissed state from database (primary source) OR local optimistic state
  // This ensures the dismissed state is always correct after re-login
  const isOnboardingDismissed = locallyDismissed || (onboardingData?.onboardingDismissed ?? false);

  // Auto-mark onboarding as complete for any "established" account.
  // Onboarding is a one-time lifecycle event, not a live derived status:
  // once a user has any sessions, any students, or an account older than the
  // grace window, we permanently flip onboarding_completed = true so they
  // never see the checklist or welcome modal again — regardless of optional
  // integrations like Telegram or any flaky live data reads.
  useEffect(() => {
    const autoCompleteOnboarding = async () => {
      if (!onboardingData || isLoading) return;

      if (onboardingData.isEstablished && !onboardingData.onboardingCompleted) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { error } = await supabase
            .from('tutors')
            .update({ onboarding_completed: true })
            .eq('user_id', user.id);
          
          if (error) {
            console.error('Error auto-completing onboarding:', error);
            return;
          }
          
          refetch();
        } catch (err) {
          console.error('Error in autoCompleteOnboarding:', err);
        }
      }
    };

    autoCompleteOnboarding();
  }, [onboardingData, isLoading, refetch]);

  useEffect(() => {
    if (
      !isLoading &&
      onboardingData &&
      !onboardingData.onboardingCompleted &&
      !onboardingData.onboardingDismissed &&
      !onboardingData.isEstablished
    ) {
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

    // Optimistically update local state immediately for instant UI feedback
    setLocallyDismissed(true);

    await supabase
      .from('tutors')
      .update({ onboarding_dismissed: true })
      .eq('user_id', user.id);

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
