import * as Sentry from "@sentry/react";

// Fetch DSN from backend endpoint since Vite doesn't expose non-VITE_ prefixed env vars
let SENTRY_DSN: string | null = null;

export async function initSentry() {
  // Try to fetch DSN from backend
  try {
    const response = await fetch('/api/sentry-config');
    const config = await response.json();
    SENTRY_DSN = config.dsn;
  } catch (error) {
    console.warn("Could not fetch Sentry DSN from backend, error tracking disabled");
    return;
  }

  if (!SENTRY_DSN) {
    console.warn("Sentry DSN not found, error tracking disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
    tracePropagationTargets: ["localhost", /^https:\/\/.*\.replit\.dev/],
    
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% when errors occur
    
    // Environment
    environment: import.meta.env.MODE || "development",
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || "unknown",
    
    // Additional options
    beforeSend(event, hint) {
      // Filter out errors from browser extensions
      if (event.exception) {
        const error = hint.originalException;
        if (error && typeof error === "object" && "message" in error) {
          const message = String(error.message);
          if (message.includes("chrome-extension://") || message.includes("moz-extension://")) {
            return null;
          }
        }
      }
      return event;
    },
  });
}

// Helper to set user context
export function setSentryUser(user: { id: string; email: string; name?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
}

// Helper to clear user context (on logout)
export function clearSentryUser() {
  Sentry.setUser(null);
}

// Helper to capture custom errors
export function captureError(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.setContext("custom", context);
  }
  Sentry.captureException(error);
}
