import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    (async () => {
      console.log('[AuthCallback] landed on:', window.location.href);
      
      // Handle malformed URLs that include full Supabase verification URL
      const currentUrl = window.location.href;
      let cleanedUrl = currentUrl;
      
      // If URL contains a Supabase verification URL in the path, extract it
      if (currentUrl.includes('supabase.co/auth/v1/verify')) {
        const match = currentUrl.match(/https:\/\/[^\/]+\.supabase\.co\/auth\/v1\/verify[^?]*\?[^&]*(&.*)?/);
        if (match) {
          cleanedUrl = match[0];
          console.log('[AuthCallback] extracted Supabase verification URL:', cleanedUrl);
          
          // Update the browser URL to be clean
          window.history.replaceState({}, '', '/auth/callback' + window.location.search + window.location.hash);
        }
      }

      // PKCE/code flow (no-op if none) - use cleaned URL
      try { 
        await supabase.auth.exchangeCodeForSession(cleanedUrl); 
        console.log('[AuthCallback] exchangeCodeForSession completed');
      } catch (e) {
        console.warn('[AuthCallback] exchangeCodeForSession error:', e);
      }

      // Hash tokens
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const h = new URLSearchParams(hash);
      const access_token = h.get('access_token');
      const refresh_token = h.get('refresh_token');
      const hashType = h.get('type');

      console.log('[AuthCallback] hash params:', { 
        access_token: !!access_token, 
        refresh_token: !!refresh_token, 
        hashType 
      });

      if (access_token && refresh_token) {
        try {
          await supabase.auth.setSession({ access_token, refresh_token });
          console.log('[AuthCallback] session set from hash tokens');
        } catch (e) {
          console.error('[AuthCallback] setSession error:', e);
        }
      }

      const searchType = new URLSearchParams(window.location.search).get('type');
      const isRecovery = (hashType || searchType) === 'recovery';

      const { data: { session } } = await supabase.auth.getSession();
      console.log('[AuthCallback] isRecovery:', isRecovery, 'session?', !!session);

      // If recovery, go to reset page regardless of session status
      if (isRecovery) {
        console.log('[AuthCallback] redirecting to reset password page');
        setLocation('/reset-password', { replace: true });
        return;
      }

      // Fallback: if session present go home, else go auth
      console.log('[AuthCallback] redirecting to:', session ? '/' : '/auth');
      setLocation(session ? '/' : '/auth', { replace: true });
    })();
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
    </div>
  );
}