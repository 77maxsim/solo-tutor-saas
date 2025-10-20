import * as Sentry from "@sentry/node";
import type { Express } from "express";

const SENTRY_DSN = process.env.SENTRY_DSN_BACKEND;

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn("⚠️  Sentry DSN not found, error tracking disabled");
    return false;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Express integration for automatic tracing
    integrations: [
      Sentry.expressIntegration(),
    ],
    
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of transactions
    
    // Environment
    environment: process.env.NODE_ENV || "development",
    
    // Release tracking
    release: process.env.APP_VERSION || "unknown",
    
    // Send default PII for better context (request headers, IP)
    sendDefaultPii: true,
    
    // Additional options
    beforeSend(event) {
      // Add server context
      if (event.request) {
        event.tags = {
          ...event.tags,
          server: "express",
        };
      }
      return event;
    },
  });

  console.log("✅ Sentry error tracking initialized");
  return true;
}

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

export { Sentry };
