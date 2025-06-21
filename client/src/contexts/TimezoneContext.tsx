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
  }, []);

  // Force refresh timezone on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTutorTimezone();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const fetchTutorTimezone = async () => {
    try {
      console.log('🔍 Starting timezone fetch...');
      
      // Get current session instead of just user
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session?.user) {
        console.log('No authenticated session, using default timezone Europe/Kyiv');
        setTutorTimezone('Europe/Kyiv');
        setIsLoading(false);
        return;
      }

      const user = session.user;
      console.log('🔍 User session found, fetching tutor timezone for user_id:', user.id);

      const { data, error } = await supabase
        .from('tutors')
        .select('timezone, user_id, full_name')
        .eq('user_id', user.id)
        .single();

      console.log('🌍 Tutor query result:', { data, error, user_id: user.id });

      if (error) {
        console.error('Error fetching tutor timezone:', error);
        // Retry with a small delay in case of timing issues
        setTimeout(() => {
          fetchTutorTimezone();
        }, 1000);
        return;
      } else {
        const timezone = data?.timezone || 'Europe/Kyiv';
        console.log('🌍 Setting tutor timezone from profile:', timezone, 'for tutor:', data?.full_name);
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