import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Parse both hash and search parameters for robustness
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        
        // Get tokens and type from hash (Supabase recovery flow)
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');
        
        // Also check search params for type (backup)
        const searchType = searchParams.get('type');
        const type = hashType || searchType;

        // Try to exchange code for session (no-op if not needed)
        try {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        } catch (exchangeError) {
          // Silently ignore exchange errors as this is a fallback
          console.log('Code exchange not needed or failed:', exchangeError);
        }

        // Handle recovery flow - set session if tokens are present
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Error setting session:', error);
            toast({
              variant: "destructive",
              title: "Authentication Error",
              description: "Failed to process recovery link. Please try again.",
            });
            setLocation('/auth', { replace: true });
            return;
          }
        }

        // Navigate based on type
        if (type === 'recovery') {
          toast({
            title: "Recovery Link Verified",
            description: "Please set your new password.",
          });
          setLocation('/reset-password', { replace: true });
        } else if (type === 'signup') {
          toast({
            title: "Email Verified",
            description: "Your email has been verified successfully.",
          });
          setLocation('/auth', { replace: true });
        } else {
          // Invalid or missing callback type
          console.error('Invalid callback type or missing tokens');
          setLocation('/auth', { replace: true });
        }
      } catch (error) {
        console.error('Callback handling error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "An error occurred processing the authentication link.",
        });
        setLocation('/auth', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [setLocation, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">Processing authentication link...</p>
        </div>
      </div>
    );
  }

  return null;
}