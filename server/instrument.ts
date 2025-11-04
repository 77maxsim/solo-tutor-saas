import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env.SENTRY_DSN_BACKEND;

if (SENTRY_DSN) {
  // Extract project ID from DSN for logging
  const projectIdMatch = SENTRY_DSN.match(/\/(\d+)$/);
  const projectId = projectIdMatch ? projectIdMatch[1] : 'unknown';
  
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

  console.log("✅ Sentry backend error tracking initialized");
  console.log(`📊 Sentry Project ID: ${projectId}`);
  console.log(`   Expected: 4510221095010304 (node-express)`);
  console.log(`   NOT: 4510221082558464 (javascript-react)`);
} else {
  console.warn("⚠️  Sentry DSN not found, error tracking disabled");
}

export { Sentry };
