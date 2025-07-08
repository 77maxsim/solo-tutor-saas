import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { calculateExpectedEarnings } from '@/lib/earningsCalculator';
import { useEffect } from 'react';

interface ExpectedEarningsProps {
  tutor: any;
}

export default function ExpectedEarnings({ tutor }: ExpectedEarningsProps) {
  const queryClient = useQueryClient();

  // Set up Supabase realtime subscription for sessions
  useEffect(() => {
    if (!tutor?.id) return;

    const channel = supabase
      .channel(`expected-earnings-sessions-${tutor.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `tutor_id=eq.${tutor.id}`
        },
        (payload) => {
          console.log('Sessions updated, refreshing expected earnings:', payload);
          queryClient.invalidateQueries({ queryKey: ['expected-earnings', tutor.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tutor?.id, queryClient]);

  // Fetch scheduled sessions for expected earnings calculation
  const { data: expectedEarnings, isLoading, error } = useQuery({
    queryKey: ['expected-earnings', tutor?.id],
    queryFn: async () => {
      if (!tutor?.id) return { amount: 0, currency: 'USD' };

      const { data: sessions, error } = await supabase
        .from('sessions')
        .select(`
          id,
          session_start,
          session_end,
          duration,
          rate,
          status,
          tutor_id
        `)
        .eq('tutor_id', tutor.id)
        .eq('status', 'confirmed')
        .gte('session_start', new Date().toISOString())
        .order('session_start', { ascending: true });

      if (error) {
        console.error('Error fetching scheduled sessions:', error);
        throw error;
      }

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