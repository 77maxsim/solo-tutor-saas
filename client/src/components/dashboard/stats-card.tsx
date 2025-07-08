The StatsCard props interface is updated to include change, changeType, iconColor, and iconBgColor.
```
```replit_final_file
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { useTutor } from '@/lib/tutorHelpers';
import { useEffect } from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative";
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  iconBgColor?: string;
  subtitle?: string;
  className?: string;
}

export function StatsCard({ title, value, change, changeType, icon: Icon, iconColor, iconBgColor, subtitle, className = "" }: StatsCardProps) {
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
    <Card className={`${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}