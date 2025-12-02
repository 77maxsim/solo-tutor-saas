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
  app.get("/api/admin/metrics", authenticateUser, authorizeAdmin, adminLimiter, async (req, res) => {
    try {
      // Get metrics
      const now = new Date();
      // Use Monday as start of week (matching tutor dashboards)
      // getDay() returns 0=Sunday, 1=Monday, etc.
      // To get Monday: if Sunday (0), go back 6 days; otherwise go back (day - 1) days
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Total tutors
      const { count: totalTutors } = await supabase
        .from('tutors')
        .select('*', { count: 'exact', head: true });

      // Active students (students with at least one session in last 30 days)
      // Use paginated fetch to get all sessions, as Supabase has implicit row limits
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      
      const STUDENT_BATCH_SIZE = 1000;
      const MAX_STUDENT_BATCHES = 30;
      const allStudentIds = new Set<string>();
      let studentBatch = 0;
      let hasMoreStudents = true;
      
      console.log('📊 Admin Metrics: Starting paginated fetch for active students...');
      
      while (hasMoreStudents && studentBatch < MAX_STUDENT_BATCHES) {
        const rangeStart = studentBatch * STUDENT_BATCH_SIZE;
        const rangeEnd = rangeStart + STUDENT_BATCH_SIZE - 1;
        
        const { data: studentSessions, error } = await supabase
          .from('sessions')
          .select('student_id')
          .gte('session_start', thirtyDaysAgo.toISOString())
          .lte('session_start', now.toISOString())
          .not('student_id', 'is', null)
          .order('id', { ascending: true })
          .range(rangeStart, rangeEnd);
        
        if (error) {
          console.error(`Error fetching student batch ${studentBatch}:`, error);
          break;
        }
        
        const batchCount = studentSessions?.length || 0;
        
        if (studentSessions) {
          for (const session of studentSessions) {
            if (session.student_id) {
              allStudentIds.add(session.student_id);
            }
          }
        }
        
        if (batchCount < STUDENT_BATCH_SIZE) {
          hasMoreStudents = false;
        }
        
        studentBatch++;
      }
      
      console.log(`📊 Admin Metrics: Found ${allStudentIds.size} unique active students from ${studentBatch} batches`);
      const activeStudents = allStudentIds.size;

      // Sessions this week - count only sessions that have already occurred (not future scheduled)
      const { count: sessionsThisWeek } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gte('session_start', startOfWeek.toISOString())
        .lte('session_start', now.toISOString());

      // Total earnings (paid sessions) - convert all currencies to USD
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

      // PAGINATED FETCH: Use .range() to fetch all paid sessions in batches
      // Supabase enforces an implicit ~1000 row limit despite .limit()
      // IMPORTANT: Must use .order() for deterministic pagination with .range()
      const BATCH_SIZE = 1000;
      const MAX_BATCHES = 30; // Safety limit: 30 * 1000 = 30,000 sessions max
      const allPaidSessions: any[] = [];
      const seenIds = new Set<string>();
      let currentBatch = 0;
      let hasMore = true;
      let duplicatesFound = 0;
      
      console.log('📊 Admin Metrics: Starting paginated fetch of paid sessions for total earnings...');
      
      while (hasMore && currentBatch < MAX_BATCHES) {
        const rangeStart = currentBatch * BATCH_SIZE;
        const rangeEnd = rangeStart + BATCH_SIZE - 1;
        
        const { data: batchData, error } = await supabase
          .from('sessions')
          .select('id, tutor_id, duration, rate')
          .eq('paid', true)
          .order('id', { ascending: true })
          .range(rangeStart, rangeEnd);
        
        if (error) {
          console.error(`Error fetching batch ${currentBatch}:`, error);
          break;
        }
        
        const batchCount = batchData?.length || 0;
        
        // Add unique sessions (deduplicate by ID)
        if (batchData) {
          for (const session of batchData) {
            if (!seenIds.has(session.id)) {
              seenIds.add(session.id);
              allPaidSessions.push(session);
            } else {
              duplicatesFound++;
            }
          }
        }
        
        // Check if we've reached the end
        if (batchCount < BATCH_SIZE) {
          hasMore = false;
        }
        
        currentBatch++;
      }
      
      if (duplicatesFound > 0) {
        console.warn(`⚠️ Admin Metrics: Found ${duplicatesFound} duplicate sessions during pagination`);
      }
      
      if (currentBatch >= MAX_BATCHES && hasMore) {
        console.warn(`⚠️ Admin Metrics: Reached max batch limit (${MAX_BATCHES}). Total earnings may be incomplete.`);
      }
      
      console.log(`📊 Admin Metrics: Fetched ${allPaidSessions.length} paid sessions in ${currentBatch} batches`);

      let totalEarningsUSD = 0;
      for (const session of allPaidSessions) {
        const earningsInCurrency = (session.duration / 60) * parseFloat(session.rate);
        const currency = tutorCurrencyMap[session.tutor_id] || 'USD';
        const earningsUSD = await convertToUSD(earningsInCurrency, currency);
        totalEarningsUSD += earningsUSD;
      }

      // Unpaid sessions count
      const { count: unpaidSessions } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('paid', false)
        .lte('session_end', now.toISOString());

      // Weekly Active Users (tutors with sessions in last 7 days)
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);

      const { data: weeklyActiveTutors } = await supabase
        .from('sessions')
        .select('tutor_id')
        .gte('session_start', sevenDaysAgo.toISOString());

      const weeklyActiveUsers = new Set(weeklyActiveTutors?.map(s => s.tutor_id)).size;

      // Monthly Active Users
      const { data: monthlyActiveTutors } = await supabase
        .from('sessions')
        .select('tutor_id')
        .gte('session_start', startOfMonth.toISOString());

      const monthlyActiveUsers = new Set(monthlyActiveTutors?.map(s => s.tutor_id)).size;

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

  // Admin: Get top tutors
  app.get("/api/admin/top-tutors", authenticateUser, authorizeAdmin, adminLimiter, async (req, res) => {
    try {
      // First, get all tutors with their info for reliable currency data
      const { data: tutors } = await supabase
        .from('tutors')
        .select('id, full_name, email, currency');
      
      // Create a map of tutor info by ID for fast lookup
      const tutorMap: { [id: string]: { name: string; email: string; currency: string } } = {};
      if (tutors) {
        for (const tutor of tutors) {
          tutorMap[tutor.id] = {
            name: tutor.full_name || 'Unknown',
            email: tutor.email || '',
            currency: tutor.currency || 'USD'
          };
        }
      }

      // PAGINATED FETCH: Use .range() to fetch all paid sessions in batches
      // Supabase enforces an implicit ~1000 row limit despite .limit()
      // IMPORTANT: Must use .order() for deterministic pagination with .range()
      const BATCH_SIZE = 1000;
      const MAX_BATCHES = 30; // Safety limit: 30 * 1000 = 30,000 sessions max
      const allSessions: any[] = [];
      const seenIds = new Set<string>();
      let currentBatch = 0;
      let hasMore = true;
      let duplicatesFound = 0;
      
      console.log('📊 Top Tutors: Starting paginated fetch of paid sessions...');
      
      while (hasMore && currentBatch < MAX_BATCHES) {
        const rangeStart = currentBatch * BATCH_SIZE;
        const rangeEnd = rangeStart + BATCH_SIZE - 1;
        
        const { data: batchData, error } = await supabase
          .from('sessions')
          .select('id, tutor_id, duration, rate')
          .eq('paid', true)
          .order('id', { ascending: true })
          .range(rangeStart, rangeEnd);
        
        if (error) {
          console.error(`Error fetching batch ${currentBatch}:`, error);
          break;
        }
        
        const batchCount = batchData?.length || 0;
        
        // Add unique sessions (deduplicate by ID)
        if (batchData) {
          for (const session of batchData) {
            if (!seenIds.has(session.id)) {
              seenIds.add(session.id);
              allSessions.push(session);
            } else {
              duplicatesFound++;
            }
          }
        }
        
        // Check if we've reached the end
        if (batchCount < BATCH_SIZE) {
          hasMore = false;
        }
        
        currentBatch++;
      }
      
      if (duplicatesFound > 0) {
        console.warn(`⚠️ Top Tutors: Found ${duplicatesFound} duplicate sessions during pagination`);
      }
      
      if (currentBatch >= MAX_BATCHES && hasMore) {
        console.warn(`⚠️ Top Tutors: Reached max batch limit (${MAX_BATCHES}). Earnings may be incomplete.`);
      }
      
      console.log(`📊 Top Tutors: Fetched ${allSessions.length} paid sessions in ${currentBatch} batches`);

      // Aggregate by tutor with USD conversion using reliable tutor currency data
      const tutorStatsMap: { [tutorId: string]: any } = {};
      
      for (const session of allSessions) {
        const tutorId = session.tutor_id;
        const tutorInfo = tutorMap[tutorId];
        const earningsInCurrency = (session.duration / 60) * parseFloat(session.rate);
        const currency = tutorInfo?.currency || 'USD';
        const earningsUSD = await convertToUSD(earningsInCurrency, currency);
        
        if (!tutorStatsMap[tutorId]) {
          tutorStatsMap[tutorId] = {
            tutorId,
            name: tutorInfo?.name || 'Unknown',
            email: tutorInfo?.email || '',
            totalEarnings: 0,
            sessionCount: 0
          };
        }
        
        tutorStatsMap[tutorId].totalEarnings += earningsUSD;
        tutorStatsMap[tutorId].sessionCount += 1;
      }

      const topTutors = Object.values(tutorStatsMap)
        .sort((a: any, b: any) => b.totalEarnings - a.totalEarnings)
        .slice(0, 10);

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
