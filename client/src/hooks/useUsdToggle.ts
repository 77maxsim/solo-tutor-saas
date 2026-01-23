import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

interface UsdRateResponse {
  rate: number;
  currency: string;
  cached: boolean;
  fetchedAt?: string;
  expiresIn?: number;
  message?: string;
}

export function useUsdToggle(defaultCurrency: string = 'USD') {
  const [showUsd, setShowUsd] = useState<boolean>(() => {
    const saved = localStorage.getItem('show-usd-toggle');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('show-usd-toggle', showUsd.toString());
  }, [showUsd]);

  const { data: rateData, isLoading: isLoadingRate, error: rateError, refetch } = useQuery<UsdRateResponse>({
    queryKey: ['usd-exchange-rate', defaultCurrency],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/tutor/usd-rate', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch exchange rate');
      }

      return response.json();
    },
    enabled: showUsd && defaultCurrency !== 'USD',
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 12 * 60 * 60 * 1000,
    retry: 1,
  });

  const convertToUsd = useCallback((amount: number): number => {
    if (!showUsd || defaultCurrency === 'USD' || !rateData?.rate) {
      return amount;
    }
    return amount / rateData.rate;
  }, [showUsd, defaultCurrency, rateData?.rate]);

  const getDisplayCurrency = useCallback((): string => {
    if (showUsd && defaultCurrency !== 'USD') {
      return 'USD';
    }
    return defaultCurrency;
  }, [showUsd, defaultCurrency]);

  const toggle = useCallback(() => {
    setShowUsd(prev => !prev);
  }, []);

  const isUsdAvailable = defaultCurrency !== 'USD';

  return {
    showUsd,
    toggle,
    convertToUsd,
    getDisplayCurrency,
    isLoadingRate,
    rateError,
    rateData,
    isUsdAvailable,
    refetchRate: refetch,
  };
}
