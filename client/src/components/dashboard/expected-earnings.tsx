import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { useTutor } from '@/lib/tutorHelpers';
import { calculateExpectedEarnings } from '@/lib/earningsCalculator';
import { useEffect } from 'react';

export default function ExpectedEarnings() {
  const { data: tutor } = useTutor();
  const queryClient = useQueryClient();

  // Set up real-time subscription for sessions changes
  useEffect(() => {
    if (!tutor) return;

    const channel = supabase
      .channel('expected-earnings-sessions')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'sessions',
          filter: `tutor_id=eq.${tutor.id}`
        }, 
        () => {
          queryClient.invalidateQueries({ queryKey: ['expected-earnings'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tutor, queryClient]);

  const { data: expectedEarnings, isLoading, error } = useQuery({
    queryKey: ['expected-earnings', tutor?.id],
    queryFn: async () => {
      if (!tutor) return { amount: 0, currency: 'USD' };

      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('tutor_id', tutor.id)
        .eq('status', 'scheduled');

      if (error) throw error;

      return calculateExpectedEarnings(sessions || [], tutor);
    },
    enabled: !!tutor,
  });

  if (error) {
    console.error('Error fetching expected earnings:', error);
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-green-800">
          Expected Earnings (Next 30 Days)
        </CardTitle>
        <TrendingUp className="h-4 w-4 text-green-600" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-green-900">
          {isLoading ? (
            <div className="animate-pulse bg-green-200 h-6 w-24 rounded"></div>
          ) : (
            formatCurrency(expectedEarnings?.amount || 0, expectedEarnings?.currency || tutor?.currency || 'USD')
          )}
        </div>
        <p className="text-xs text-green-600 mt-1">
          Based on scheduled sessions
        </p>
      </CardContent>
    </Card>
  );
}