import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTutor } from '@/lib/tutorHelpers';
import { useEffect } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  loading?: boolean;
}

export function StatsCard({ title, value, change, icon, loading }: StatsCardProps) {
  const { data: tutor } = useTutor();
  const queryClient = useQueryClient();

  // Set up real-time subscription for sessions changes (affects multiple stats)
  useEffect(() => {
    if (!tutor) return;

    const channel = supabase
      .channel('stats-card-sessions')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'sessions',
          filter: `tutor_id=eq.${tutor.id}`
        }, 
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tutor, queryClient]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? (
            <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
          ) : (
            value
          )}
        </div>
        {change && (
          <p className="text-xs text-muted-foreground">
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );
}