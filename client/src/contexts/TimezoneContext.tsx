import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface TimezoneContextType {
  tutorTimezone: string | null;
  isLoading: boolean;
  setTutorTimezone: (timezone: string) => void;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [tutorTimezone, setTutorTimezone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTutorTimezone();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event, !!session?.user);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchTutorTimezone();
      } else if (event === 'SIGNED_OUT') {
        setTutorTimezone('Europe/Kyiv');
      }
    });

    // Force refresh timezone after a delay to handle timing issues
    const timer = setTimeout(() => {
      fetchTutorTimezone();
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const fetchTutorTimezone = async () => {
    try {
      console.log('🔍 Starting timezone fetch...');
      
      // Try multiple authentication methods
      const [sessionResult, userResult] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser()
      ]);
      
      const session = sessionResult.data?.session;
      const user = userResult.data?.user || session?.user;
      
      console.log('🔍 Auth state check:', {
        hasSession: !!session,
        hasUser: !!user,
        userId: user?.id,
        sessionError: sessionResult.error,
        userError: userResult.error
      });
      
      if (!user) {
        console.log('No authenticated user found, using default timezone Europe/Kyiv');
        setTutorTimezone('Europe/Kyiv');
        setIsLoading(false);
        return;
      }

      console.log('🔍 User authenticated, fetching tutor timezone for user_id:', user.id);

      const { data, error } = await supabase
        .from('tutors')
        .select('timezone, user_id, full_name')
        .eq('user_id', user.id)
        .single();

      console.log('🌍 Tutor query result:', { data, error, user_id: user.id });

      if (error) {
        console.error('Error fetching tutor timezone:', error);
        setTutorTimezone('Europe/Kyiv');
      } else {
        const timezone = data?.timezone || 'Europe/Kyiv';
        console.log('🌍 Successfully set tutor timezone:', timezone, 'for tutor:', data?.full_name);
        setTutorTimezone(timezone);
      }
    } catch (error) {
      console.error('Error in fetchTutorTimezone:', error);
      setTutorTimezone('Europe/Kyiv');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTimezone = (timezone: string) => {
    console.log('🔄 Manually updating timezone to:', timezone);
    setTutorTimezone(timezone);
  };

  return (
    <TimezoneContext.Provider value={{ 
      tutorTimezone, 
      isLoading, 
      setTutorTimezone: updateTimezone 
    }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}