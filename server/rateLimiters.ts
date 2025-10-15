import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import type { Request } from "express";

// Helper: use per-user if available, else IP
const userOrIpKey = (req: Request) => {
  const user = (req as any).user;
  if (user?.id) {
    return `u:${user.id}`;
  }
  // Since we have trust proxy enabled, req.ip should be properly set
  return `ip:${req.ip || 'unknown'}`;
};

// 1️⃣ Auth & sensitive routes: very strict
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in 15 minutes." },
});

export const authSlowdown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3,
  delayMs: () => 500,
});

// 2️⃣ Sessions routes: moderate limits (IP-based since no auth)
export const sessionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many session requests. Please try again later." },
});

// 3️⃣ Admin routes: moderate limits with per-user tracking (must apply AFTER auth)
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many admin requests. Please try again later." },
  validate: { keyGeneratorIpFallback: false },
});

// 4️⃣ Public API routes: stricter limits
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// 5️⃣ Global fallback limiter
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
