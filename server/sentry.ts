import { Sentry } from "./instrument";
import type { Express } from "express";

// Setup Sentry Express error handler
// This single function does EVERYTHING in v10+:
// - Creates isolated scopes for each request (prevents user context leaks)
// - Enables distributed tracing and performance monitoring
// - Captures errors and sends them to Sentry
// - Attaches request context to error reports
// MUST be called AFTER all routes are registered but BEFORE custom error handlers
export function setupSentryErrorHandler(app: Express) {
  Sentry.setupExpressErrorHandler(app, {
    shouldHandleError(error) {
      // Capture all errors with status >= 400
      const status = (error as any).status || (error as any).statusCode || 500;
      return status >= 400;
    },
  });
}

// Helper to set user context
export function setSentryUser(userId: string, email: string, username?: string) {
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

// Helper to clear user context
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
