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

  const fetchTutorTimezone = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('tutors')
        .select('timezone')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching tutor timezone:', error);
        // Fallback to UTC if no timezone found
        setTutorTimezone('UTC');
      } else {
        const timezone = data?.timezone || 'UTC';
        console.log('🌍 Fetched tutor timezone from database:', timezone);
        console.log('🌍 Full tutor data:', data);
        setTutorTimezone(timezone);
      }
    } catch (error) {
      console.error('Error in fetchTutorTimezone:', error);
      setTutorTimezone('UTC');
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