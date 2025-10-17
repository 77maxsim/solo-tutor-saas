import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeTelegram } from "./telegram";
import helmet from "helmet";
import cors from "cors";
import { 
  authLimiter, 
  authSlowdown, 
  sessionsLimiter, 
  publicLimiter, 
  globalLimiter 
} from "./rateLimiters";

const app = express();

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({ 
  origin: true,
  credentials: true 
}));

app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Apply rate limiters to specific routes
// Auth & sensitive routes: very strict (5 requests per 15 minutes)
app.use("/api/upload", authSlowdown, authLimiter);
app.use("/api/telegram", authSlowdown, authLimiter);

// Sessions routes: moderate limits (100 requests per 15 minutes)
app.use("/api/sessions", sessionsLimiter);

// Public API routes: stricter limits (20 requests per minute)
app.use("/api/students", publicLimiter);
app.use("/api/payments", publicLimiter);
app.use("/api/dashboard", publicLimiter);

// Note: Admin routes (/api/admin/*) are rate-limited per-route in routes.ts 
// AFTER authentication middleware to enable per-user tracking

// Global fallback limiter for all other API routes (120 requests per minute)
app.use("/api", globalLimiter);

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Special handling for rate limit errors
    if (status === 429) {
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Initialize Telegram bot and notification scheduler
  await initializeTelegram();

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
