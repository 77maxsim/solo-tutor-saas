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
        // Get the hash fragment from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (type === 'recovery' && accessToken) {
          // Set the session from the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error) {
            console.error('Error setting session:', error);
            toast({
              variant: "destructive",
              title: "Authentication Error",
              description: "Failed to process recovery link. Please try again.",
            });
            setLocation('/auth');
          } else if (data.session) {
            toast({
              title: "Recovery Link Verified",
              description: "Please set your new password.",
            });
            // Redirect to reset password page
            setLocation('/reset-password');
          }
        } else if (type === 'signup') {
          // Handle email confirmation
          toast({
            title: "Email Verified",
            description: "Your email has been verified successfully.",
          });
          setLocation('/auth');
        } else {
          // Invalid or missing callback type
          console.error('Invalid callback type or missing tokens');
          setLocation('/auth');
        }
      } catch (error) {
        console.error('Callback handling error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "An error occurred processing the authentication link.",
        });
        setLocation('/auth');
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