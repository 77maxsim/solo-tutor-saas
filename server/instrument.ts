import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env.SENTRY_DSN_BACKEND;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
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
} else {
  console.warn("⚠️  Sentry DSN not found, error tracking disabled");
}

export { Sentry };
