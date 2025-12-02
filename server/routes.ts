import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import { storage } from "./storage";
import { insertStudentSchema, insertSessionSchema, insertPaymentSchema } from "@shared/schema";
import { convertToUSD } from "./services/currencyConverter";
import { adminLimiter } from "./rateLimiters";
import { setSentryUser, clearSentryUser } from "./sentry";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, bulkSyncSessions, isSyncEnabled, getAuthorizationUrl, handleOAuthCallback, disconnectGoogleCalendar } from "./googleCalendarSync";
import { Sentry } from "./instrument";
import fs from "fs";
import path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Authentication middleware to validate Supabase JWT token
async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    console.log(`🔐 Auth attempt for ${req.path}, header present: ${!!authHeader}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ No valid Authorization header for ${req.path}`);
      return res.status(401).json({ error: "No authentication token provided" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Validate the JWT token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log(`❌ Invalid token for ${req.path}:`, error);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    console.log(`✅ Authenticated user ${user.email} for ${req.path}`);
    
    // Set Sentry user context for this request only
    // Clear it when response finishes to prevent context leaking to other requests
    setSentryUser(user.id, user.email || 'unknown', user.user_metadata?.full_name);
    
    res.on('finish', () => {
      // Clear Sentry user context after response is sent
      clearSentryUser();
    });
    
    // Attach user to request for use in route handlers
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ error: "Authentication failed" });
  }
}

// Admin authorization middleware - must be used after authenticateUser
async function authorizeAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if user has admin privileges
    const { data: tutor, error } = await supabase
      .from('tutors')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (error || !tutor?.is_admin) {
      return res.status(403).json({ error: "Forbidden - Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Authorization error:", error);
    return res.status(403).json({ error: "Authorization failed" });
  }
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  const serverStartTime = Date.now();
  app.get("/api/health", (req, res) => {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000); // uptime in seconds
    res.json({
      status: "ok",
      uptime,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  });

  // Sentry configuration endpoint for frontend
  app.get("/api/sentry-config", (req, res) => {
    res.json({
      dsn: process.env.SENTRY_DSN_FRONTEND || '',
    });
  });

  // Google Calendar OAuth endpoints
  app.get("/api/auth/google/connect", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Get tutor ID from user
      const { data: tutor, error } = await supabase
        .from('tutors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error || !tutor) {
        return res.status(404).json({ error: "Tutor not found" });
      }

      const authUrl = getAuthorizationUrl(tutor.id);
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Google OAuth URL:", error);
      res.status(500).json({ error: "Failed to generate authorization URL" });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).send("Missing authorization code or state");
      }

      // Validate state token and exchange for tokens
      const success = await handleOAuthCallback(code as string, state as string);

      if (success) {
        // Redirect back to settings page with success message
        res.redirect('/?googleCalendarConnected=true');
      } else {
        res.redirect('/?googleCalendarError=true');
      }
    } catch (error) {
      console.error("Error handling Google OAuth callback:", error);
      res.redirect('/?googleCalendarError=true');
    }
  });

  app.post("/api/auth/google/disconnect", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Get tutor ID from user
      const { data: tutor, error } = await supabase
        .from('tutors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error || !tutor) {
        return res.status(404).json({ error: "Tutor not found" });
      }

      const success = await disconnectGoogleCalendar(tutor.id);

      if (success) {
        res.json({ success: true, message: "Google Calendar disconnected successfully" });
      } else {
        res.status(500).json({ error: "Failed to disconnect Google Calendar" });
      }
    } catch (error) {
      console.error("Error disconnecting Google Calendar:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Avatar upload endpoint
  app.post("/api/upload/avatar", upload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Get file extension from original filename
      const fileExt = req.file.originalname.split('.').pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      console.log('Backend upload - User ID:', userId);
      console.log('Backend upload - File path:', filePath);

      // Upload to Supabase Storage using service role (bypasses RLS)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tutor-avatars')
        .upload(filePath, req.file.buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: req.file.mimetype
        });

      if (uploadError) {
        console.error('Backend upload error:', uploadError);
        return res.status(500).json({ error: "Upload failed", details: uploadError });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tutor-avatars')
        .getPublicUrl(filePath);

      console.log('Backend upload successful, public URL:', publicUrl);

      // Update tutor profile with avatar_url
      const { error: updateError } = await supabase
        .from('tutors')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Database update error:', updateError);
        return res.status(500).json({ error: "Failed to update profile", details: updateError });
      }

      res.json({ 
        success: true, 
        avatarUrl: publicUrl,
        message: "Avatar uploaded successfully" 
      });

    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/dashboard/stats/:tutorId", async (req, res) => {
    try {
      const tutorId = parseInt(req.params.tutorId);
      const stats = await storage.getDashboardStats(tutorId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Students endpoints
  app.get("/api/students/:tutorId", async (req, res) => {
    try {
      const tutorId = parseInt(req.params.tutorId);
      const students = await storage.getStudentsByTutorId(tutorId);
      res.json(students);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  app.post("/api/students", async (req, res) => {
    try {
      const validatedData = insertStudentSchema.parse(req.body);
      const student = await storage.createStudent(validatedData);
      res.status(201).json(student);
    } catch (error) {
      res.status(400).json({ message: "Invalid student data" });
    }
  });

  // Sessions endpoints
  app.get("/api/sessions/:tutorId", async (req, res) => {
    try {
      const tutorId = parseInt(req.params.tutorId);
      const sessions = await storage.getSessionsByTutorId(tutorId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/:tutorId/upcoming", async (req, res) => {
    try {
      const tutorId = parseInt(req.params.tutorId);
      const limit = parseInt(req.query.limit as string) || 5;
      const sessions = await storage.getUpcomingSessions(tutorId, limit);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch upcoming sessions" });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      const validatedData = insertSessionSchema.parse(req.body);
      const session = await storage.createSession(validatedData);
      res.status(201).json(session);
    } catch (error) {
      res.status(400).json({ message: "Invalid session data" });
    }
  });

  // Payments endpoints
  app.get("/api/payments/:tutorId", async (req, res) => {
    try {
      const tutorId = parseInt(req.params.tutorId);
      const payments = await storage.getPaymentsByTutorId(tutorId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const validatedData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(validatedData);
      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ message: "Invalid payment data" });
    }
  });

  app.get("/api/telegram/status", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const { data, error } = await supabase
        .from('tutors')
        .select('telegram_chat_id')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching telegram status:', error);
        return res.status(500).json({ error: "Failed to fetch subscription status" });
      }

      res.json({ 
        subscribed: !!data?.telegram_chat_id,
        telegram_chat_id: data?.telegram_chat_id 
      });
    } catch (error) {
      console.error('Telegram status error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin endpoints - check if user is admin first, then apply rate limiting
  // Uses server-side SQL aggregation for scalability (handles millions of sessions)
  app.get("/api/admin/metrics", authenticateUser, authorizeAdmin, adminLimiter, async (req, res) => {
    try {
      const now = new Date();
      const startTime = Date.now();
      
      // Use Monday as start of week (matching tutor dashboards)
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      console.log('📊 Admin Metrics: Using SQL aggregation for scalable metrics...');
      
      // Try to use RPC functions for aggregation (scalable approach)
      // Falls back to direct queries if RPC functions don't exist
      let activeStudents = 0;
      let totalEarningsUSD = 0;
      let weeklyActiveUsers = 0;
      let monthlyActiveUsers = 0;
      let unpaidSessions = 0;
      let useRpcFunctions = true;

      // 1. Total tutors (simple count, always works)
      const { count: totalTutors } = await supabase
        .from('tutors')
        .select('*', { count: 'exact', head: true });

      // 2. Sessions this week (simple count with filter, always works)
      const { count: sessionsThisWeek } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gte('session_start', startOfWeek.toISOString())
        .lte('session_start', now.toISOString());

      // 3. Try RPC function for active students (COUNT DISTINCT)
      const { data: activeStudentsResult, error: activeStudentsError } = await supabase
        .rpc('get_active_students_count', { days_back: 30 });
      
      if (activeStudentsError) {
        console.log('📊 RPC get_active_students_count not available, using fallback...');
        useRpcFunctions = false;
      } else {
        activeStudents = activeStudentsResult || 0;
      }

      // 4. Try RPC function for earnings aggregation
      const { data: earningsData, error: earningsError } = await supabase
        .rpc('get_earnings_by_tutor', { paid_only: true });
      
      if (earningsError) {
        console.log('📊 RPC get_earnings_by_tutor not available, using fallback...');
        useRpcFunctions = false;
      } else if (earningsData) {
        // Convert earnings from each tutor's currency to USD
        for (const tutorEarnings of earningsData) {
          const earningsUSD = await convertToUSD(
            parseFloat(tutorEarnings.total_earnings) || 0,
            tutorEarnings.tutor_currency || 'USD'
          );
          totalEarningsUSD += earningsUSD;
        }
      }

      // 5. Try RPC for unpaid sessions
      const { data: unpaidResult, error: unpaidError } = await supabase
        .rpc('get_unpaid_sessions_count');
      
      if (unpaidError) {
        // Fallback to direct count
        const { count } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('paid', false)
          .lte('session_end', now.toISOString());
        unpaidSessions = count || 0;
      } else {
        unpaidSessions = unpaidResult || 0;
      }

      // 6. Try RPC for weekly active tutors
      const { data: weeklyResult, error: weeklyError } = await supabase
        .rpc('get_active_tutors_count', { days_back: 7 });
      
      if (weeklyError) {
        // Fallback
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        const { data: weeklyTutors } = await supabase
          .from('sessions')
          .select('tutor_id')
          .gte('session_start', sevenDaysAgo.toISOString());
        weeklyActiveUsers = new Set(weeklyTutors?.map(s => s.tutor_id)).size;
      } else {
        weeklyActiveUsers = weeklyResult || 0;
      }

      // 7. Monthly active users (use start of month)
      const { data: monthlyTutors } = await supabase
        .from('sessions')
        .select('tutor_id')
        .gte('session_start', startOfMonth.toISOString());
      monthlyActiveUsers = new Set(monthlyTutors?.map(s => s.tutor_id)).size;

      // If RPC functions aren't available, use fallback for remaining metrics
      if (!useRpcFunctions) {
        console.log('📊 Admin Metrics: RPC functions not available. Please run create-admin-aggregate-functions.sql in Supabase SQL Editor.');
        console.log('📊 Admin Metrics: Using paginated fallback (slower, limited to 30k sessions)...');
        
        // Fallback: Active students via pagination
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        
        const BATCH_SIZE = 1000;
        const MAX_BATCHES = 30;
        const allStudentIds = new Set<string>();
        let batch = 0;
        let hasMore = true;
        
        while (hasMore && batch < MAX_BATCHES) {
          const { data: sessions } = await supabase
            .from('sessions')
            .select('student_id')
            .gte('session_start', thirtyDaysAgo.toISOString())
            .lte('session_start', now.toISOString())
            .not('student_id', 'is', null)
            .order('id', { ascending: true })
            .range(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE - 1);
          
          if (!sessions || sessions.length < BATCH_SIZE) hasMore = false;
          sessions?.forEach(s => s.student_id && allStudentIds.add(s.student_id));
          batch++;
        }
        activeStudents = allStudentIds.size;

        // Fallback: Earnings via pagination
        const { data: allTutors } = await supabase
          .from('tutors')
          .select('id, currency');
        
        const tutorCurrencyMap: { [id: string]: string } = {};
        allTutors?.forEach(t => tutorCurrencyMap[t.id] = t.currency || 'USD');

        batch = 0;
        hasMore = true;
        totalEarningsUSD = 0;
        const seenIds = new Set<string>();
        
        while (hasMore && batch < MAX_BATCHES) {
          const { data: sessions } = await supabase
            .from('sessions')
            .select('id, tutor_id, duration, rate')
            .eq('paid', true)
            .order('id', { ascending: true })
            .range(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE - 1);
          
          if (!sessions || sessions.length < BATCH_SIZE) hasMore = false;
          
          if (sessions) {
            for (const s of sessions) {
              if (!seenIds.has(s.id)) {
                seenIds.add(s.id);
                const earnings = (s.duration / 60) * parseFloat(s.rate);
                const currency = tutorCurrencyMap[s.tutor_id] || 'USD';
                totalEarningsUSD += await convertToUSD(earnings, currency);
              }
            }
          }
          batch++;
        }
        
        if (batch >= MAX_BATCHES && hasMore) {
          console.warn('⚠️ Admin Metrics: Reached 30k session limit. Install RPC functions for unlimited scalability.');
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`📊 Admin Metrics: Completed in ${elapsed}ms (RPC: ${useRpcFunctions})`);

      res.json({
        totalTutors,
        activeStudents,
        sessionsThisWeek,
        totalEarnings: totalEarningsUSD,
        unpaidSessions,
        weeklyActiveUsers,
        monthlyActiveUsers
      });
    } catch (error) {
      console.error('Admin metrics error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin: Get earnings trend data
  app.get("/api/admin/earnings-trend", authenticateUser, authorizeAdmin, adminLimiter, async (req, res) => {
    try {
      const period = (req.query.period as string) || 'week'; // week or month
      const now = new Date();
      let startDate: Date;
      
      if (period === 'month') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
      } else {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
      }

      // First get all tutors to map their currencies reliably
      const { data: allTutors } = await supabase
        .from('tutors')
        .select('id, currency');
      
      const tutorCurrencyMap: { [id: string]: string } = {};
      if (allTutors) {
        for (const tutor of allTutors) {
          tutorCurrencyMap[tutor.id] = tutor.currency || 'USD';
        }
      }

      const { data: sessions } = await supabase
        .from('sessions')
        .select('tutor_id, session_start, duration, rate')
        .gte('session_start', startDate.toISOString())
        .eq('paid', true)
        .order('session_start', { ascending: true });

      // Group by date and convert to USD
      const earningsByDate: { [date: string]: number } = {};
      
      if (sessions) {
        for (const session of sessions) {
          const date = new Date(session.session_start).toISOString().split('T')[0];
          const earningsInCurrency = (session.duration / 60) * parseFloat(session.rate);
          const currency = tutorCurrencyMap[session.tutor_id] || 'USD';
          const earningsUSD = await convertToUSD(earningsInCurrency, currency);
          
          if (!earningsByDate[date]) {
            earningsByDate[date] = 0;
          }
          earningsByDate[date] += earningsUSD;
        }
      }

      const trendData = Object.entries(earningsByDate).map(([date, earnings]) => ({
        date,
        earnings
      }));

      res.json(trendData);
    } catch (error) {
      console.error('Earnings trend error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin: Get top tutors - uses SQL aggregation for scalability
  app.get("/api/admin/top-tutors", authenticateUser, authorizeAdmin, adminLimiter, async (req, res) => {
    try {
      const startTime = Date.now();
      console.log('📊 Top Tutors: Fetching with SQL aggregation...');
      
      // Try RPC function first (returns pre-aggregated data)
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('get_top_tutors_earnings', { limit_count: 10 });
      
      if (!rpcError && rpcResult) {
        // RPC function available - convert to USD and return
        const topTutors = [];
        for (const tutor of rpcResult) {
          const earningsUSD = await convertToUSD(
            parseFloat(tutor.total_earnings) || 0,
            tutor.tutor_currency || 'USD'
          );
          topTutors.push({
            tutorId: tutor.tutor_id,
            name: tutor.tutor_name,
            email: tutor.tutor_email,
            totalEarnings: earningsUSD,
            sessionCount: parseInt(tutor.session_count) || 0
          });
        }
        
        // Sort by USD earnings (may differ from original currency order)
        topTutors.sort((a, b) => b.totalEarnings - a.totalEarnings);
        
        const elapsed = Date.now() - startTime;
        console.log(`📊 Top Tutors: Completed via RPC in ${elapsed}ms`);
        return res.json(topTutors);
      }
      
      // Fallback: paginated batch fetch
      console.log('📊 Top Tutors: RPC not available, using paginated fallback...');
      
      const { data: tutors } = await supabase
        .from('tutors')
        .select('id, full_name, email, currency');
      
      const tutorMap: { [id: string]: { name: string; email: string; currency: string } } = {};
      tutors?.forEach(t => {
        tutorMap[t.id] = {
          name: t.full_name || 'Unknown',
          email: t.email || '',
          currency: t.currency || 'USD'
        };
      });

      const BATCH_SIZE = 1000;
      const MAX_BATCHES = 30;
      const seenIds = new Set<string>();
      const tutorStatsMap: { [tutorId: string]: any } = {};
      let batch = 0;
      let hasMore = true;
      
      while (hasMore && batch < MAX_BATCHES) {
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id, tutor_id, duration, rate')
          .eq('paid', true)
          .order('id', { ascending: true })
          .range(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE - 1);
        
        if (!sessions || sessions.length < BATCH_SIZE) hasMore = false;
        
        if (sessions) {
          for (const s of sessions) {
            if (!seenIds.has(s.id)) {
              seenIds.add(s.id);
              const tutorInfo = tutorMap[s.tutor_id];
              const earnings = (s.duration / 60) * parseFloat(s.rate);
              const earningsUSD = await convertToUSD(earnings, tutorInfo?.currency || 'USD');
              
              if (!tutorStatsMap[s.tutor_id]) {
                tutorStatsMap[s.tutor_id] = {
                  tutorId: s.tutor_id,
                  name: tutorInfo?.name || 'Unknown',
                  email: tutorInfo?.email || '',
                  totalEarnings: 0,
                  sessionCount: 0
                };
              }
              tutorStatsMap[s.tutor_id].totalEarnings += earningsUSD;
              tutorStatsMap[s.tutor_id].sessionCount += 1;
            }
          }
        }
        batch++;
      }
      
      if (batch >= MAX_BATCHES && hasMore) {
        console.warn('⚠️ Top Tutors: Reached 30k limit. Install RPC functions for unlimited scalability.');
      }

      const topTutors = Object.values(tutorStatsMap)
        .sort((a: any, b: any) => b.totalEarnings - a.totalEarnings)
        .slice(0, 10);

      const elapsed = Date.now() - startTime;
      console.log(`📊 Top Tutors: Completed via fallback in ${elapsed}ms`);
      
      res.json(topTutors);
    } catch (error) {
      console.error('Top tutors error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin: Telegram broadcast
  app.post("/api/admin/broadcast", authenticateUser, authorizeAdmin, adminLimiter, async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Get all tutors with telegram subscriptions
      const { data: tutors } = await supabase
        .from('tutors')
        .select('telegram_chat_id, full_name')
        .not('telegram_chat_id', 'is', null);

      if (!tutors || tutors.length === 0) {
        return res.json({ success: true, sent: 0, failed: 0 });
      }

      // Import bot from telegram module
      const { sendBroadcast } = await import('./telegram.js');
      const result = await sendBroadcast(message, tutors);

      res.json(result);
    } catch (error) {
      console.error('Broadcast error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Google Calendar sync endpoints
  app.post("/api/google-calendar/sync-session", async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      // Fetch session with student name
      const { data: session, error } = await supabase
        .from('sessions')
        .select(`
          id,
          session_start,
          session_end,
          tutor_id,
          student_id,
          notes,
          status,
          google_calendar_event_id,
          unassigned_name,
          students (name)
        `)
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const sessionData = {
        ...session,
        student_name: (session as any).students?.name
      };

      // If session already has a calendar event, update it; otherwise create new
      let result;
      if (session.google_calendar_event_id) {
        result = await updateCalendarEvent(sessionData);
        res.json({ success: result, action: 'updated' });
      } else {
        result = await createCalendarEvent(sessionData);
        res.json({ success: !!result, action: 'created', eventId: result });
      }
    } catch (error) {
      console.error('Session sync error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/google-calendar/sync-session/:eventId", async (req, res) => {
    try {
      const { eventId } = req.params;
      
      if (!eventId) {
        return res.status(400).json({ error: "Event ID is required" });
      }

      // Look up session to get tutor_id
      const { data: session, error } = await supabase
        .from('sessions')
        .select('tutor_id')
        .eq('google_calendar_event_id', eventId)
        .single();

      if (error || !session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const result = await deleteCalendarEvent(session.tutor_id, eventId);
      res.json({ success: result });
    } catch (error) {
      console.error('Delete calendar event error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/google-calendar/bulk-sync", async (req, res) => {
    try {
      const { tutorId } = req.body;
      
      if (!tutorId) {
        return res.status(400).json({ error: "Tutor ID is required" });
      }

      const result = await bulkSyncSessions(tutorId);
      res.json(result);
    } catch (error) {
      console.error('Bulk sync error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Server-Sent Events endpoint for bulk sync with progress
  app.get("/api/google-calendar/bulk-sync-stream/:tutorId", async (req, res) => {
    const tutorId = parseInt(req.params.tutorId);
    
    if (!tutorId) {
      return res.status(400).json({ error: "Tutor ID is required" });
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      // Send progress updates
      const result = await bulkSyncSessions(tutorId, (progress) => {
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      });

      // Send final result
      res.write(`data: ${JSON.stringify({ ...result, done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error('Bulk sync stream error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Internal server error', done: true })}\n\n`);
      res.end();
    }
  });

  app.get("/api/google-calendar/sync-status/:tutorId", async (req, res) => {
    try {
      const tutorId = parseInt(req.params.tutorId);
      const enabled = await isSyncEnabled(tutorId);
      res.json({ enabled });
    } catch (error) {
      console.error('Sync status error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/google-calendar/toggle-sync", async (req, res) => {
    try {
      const { tutorId, enabled } = req.body;
      
      if (!tutorId || enabled === undefined) {
        return res.status(400).json({ error: "Tutor ID and enabled status required" });
      }

      const { error } = await supabase
        .from('tutors')
        .update({ sync_google_calendar: enabled })
        .eq('id', tutorId);

      if (error) {
        console.error('Toggle sync error:', error);
        return res.status(500).json({ error: "Failed to update sync preference" });
      }

      res.json({ success: true, enabled });
    } catch (error) {
      console.error('Toggle sync error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/logo", (req, res) => {
    try {
      const logoPath = path.join(process.cwd(), 'attached_assets', 'Blue and Light Gray Modern Company Logo (2)_1760973142069.png');
      
      if (!fs.existsSync(logoPath)) {
        return res.status(404).json({ error: "Logo not found" });
      }
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      const logoBuffer = fs.readFileSync(logoPath);
      res.send(logoBuffer);
    } catch (error) {
      console.error('Logo serving error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
