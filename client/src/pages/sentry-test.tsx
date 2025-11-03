import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bug, Server, AlertCircle, CheckCircle } from "lucide-react";
import { captureError } from "../sentry";

export default function SentryTest() {
  const [lastError, setLastError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const handleFrontendError = () => {
    setLastError("Frontend error triggered");
    setSuccess(false);
    
    // Trigger a frontend error
    const error = new Error("Test frontend error from Sentry test page");
    captureError(error, { 
      testType: "frontend",
      component: "SentryTestPage",
      timestamp: new Date().toISOString()
    });
    
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleFrontendCrash = () => {
    setLastError("Frontend crash triggered - this will break the component!");
    setSuccess(false);
    
    // This will cause a real crash
    setTimeout(() => {
      throw new Error("Intentional frontend crash for Sentry testing");
    }, 100);
  };

  const handleBackendError = async () => {
    setLastError("Backend error triggered");
    setSuccess(false);
    
    try {
      const response = await fetch('/api/test-sentry/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        console.log("Backend error triggered successfully");
      }
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to trigger backend error:", error);
    }
  };

  const handleBackendAuthError = async () => {
    setLastError("Backend 401 error triggered");
    setSuccess(false);
    
    try {
      const response = await fetch('/api/test-sentry/auth-error', {
        method: 'POST',
      });
      
      if (!response.ok) {
        console.log("Backend auth error triggered successfully");
      }
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to trigger auth error:", error);
    }
  };

  const handleBackendServerError = async () => {
    setLastError("Backend 500 error triggered");
    setSuccess(false);
    
    try {
      const response = await fetch('/api/test-sentry/server-error', {
        method: 'POST',
      });
      
      if (!response.ok) {
        console.log("Backend server error triggered successfully");
      }
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to trigger server error:", error);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Sentry Error Tracking Test</h1>
        <p className="text-muted-foreground">
          Test your Sentry integration by triggering different types of errors. 
          Check your Sentry dashboard to verify they appear correctly.
        </p>
      </div>

      {success && (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Error sent to Sentry! Check your dashboard.
          </AlertDescription>
        </Alert>
      )}

      {lastError && !success && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{lastError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Frontend Errors
            </CardTitle>
            <CardDescription>
              Test client-side error tracking with session replay
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={handleFrontendError}
              variant="outline"
              className="w-full"
              data-testid="button-frontend-error"
            >
              Trigger Frontend Error
            </Button>
            <Button 
              onClick={handleFrontendCrash}
              variant="destructive"
              className="w-full"
              data-testid="button-frontend-crash"
            >
              Trigger Frontend Crash
            </Button>
            <p className="text-xs text-muted-foreground">
              These errors will include session replay data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Backend Errors
            </CardTitle>
            <CardDescription>
              Test server-side error tracking with context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={handleBackendError}
              variant="outline"
              className="w-full"
              data-testid="button-backend-error"
            >
              Trigger Backend Error
            </Button>
            <Button 
              onClick={handleBackendAuthError}
              variant="outline"
              className="w-full"
              data-testid="button-backend-auth-error"
            >
              Trigger 401 Auth Error
            </Button>
            <Button 
              onClick={handleBackendServerError}
              variant="outline"
              className="w-full"
              data-testid="button-backend-server-error"
            >
              Trigger 500 Server Error
            </Button>
            <p className="text-xs text-muted-foreground">
              These will show up with request context in Sentry
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>What to Check in Sentry</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Errors appear in your Sentry Feed/Issues</li>
            <li>Session replays are attached to frontend errors</li>
            <li>Backend errors include request context (URL, headers)</li>
            <li>User context is populated (if logged in)</li>
            <li>Stack traces show correct file and line numbers</li>
            <li>Performance monitoring data is captured</li>
          </ul>
        </CardContent>
      </Card>

      <Alert className="mt-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> This is a test page for development. Remove it before deploying to production.
        </AlertDescription>
      </Alert>
    </div>
  );
}
