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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('No authenticated user, using default timezone Europe/Kyiv');
        setTutorTimezone('Europe/Kyiv');
        setIsLoading(false);
        return;
      }

      console.log('🔍 User authenticated, fetching tutor timezone for user_id:', user.id);

      const { data, error } = await supabase
        .from('tutors')
        .select('timezone, user_id')
        .eq('user_id', user.id)
        .single();

      console.log('🌍 Tutor query result:', { data, error });

      if (error) {
        console.error('Error fetching tutor timezone:', error);
        // Set a default timezone instead of UTC for this user
        setTutorTimezone('Europe/Kyiv');
      } else {
        const timezone = data?.timezone || 'Europe/Kyiv';
        console.log('🌍 Setting tutor timezone:', timezone);
        setTutorTimezone(timezone);
      }
    } catch (error) {
      console.error('Error in fetchTutorTimezone:', error);
      setTutorTimezone('Europe/Kyiv');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TimezoneContext.Provider value={{ tutorTimezone, isLoading, setTutorTimezone }}>
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