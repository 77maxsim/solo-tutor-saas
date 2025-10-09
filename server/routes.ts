import type { Express } from "express";
import { createServer, type Server } from "http";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import { storage } from "./storage";
import { insertStudentSchema, insertSessionSchema, insertPaymentSchema } from "@shared/schema";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  // Admin endpoints - check if user is admin first
  app.get("/api/admin/metrics", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify admin status
      const { data: tutor } = await supabase
        .from('tutors')
        .select('is_admin')
        .eq('user_id', userId)
        .single();

      if (!tutor?.is_admin) {
        return res.status(403).json({ error: "Forbidden - Admin access required" });
      }

      // Get metrics
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Total tutors
      const { count: totalTutors } = await supabase
        .from('tutors')
        .select('*', { count: 'exact', head: true });

      // Active students (students with at least one session in last 30 days)
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      
      const { data: activeSessions } = await supabase
        .from('sessions')
        .select('student_id')
        .gte('session_start', thirtyDaysAgo.toISOString())
        .not('student_id', 'is', null);

      const activeStudents = new Set(activeSessions?.map(s => s.student_id)).size;

      // Sessions this week
      const { count: sessionsThisWeek } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gte('session_start', startOfWeek.toISOString());

      // Total earnings (paid sessions)
      const { data: paidSessions } = await supabase
        .from('sessions')
        .select('duration, rate')
        .eq('paid', true);

      const totalEarnings = paidSessions?.reduce((sum, session) => {
        return sum + (session.duration / 60) * parseFloat(session.rate);
      }, 0) || 0;

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
        totalEarnings,
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
  app.get("/api/admin/earnings-trend", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const period = (req.query.period as string) || 'week'; // week or month

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: tutor } = await supabase
        .from('tutors')
        .select('is_admin')
        .eq('user_id', userId)
        .single();

      if (!tutor?.is_admin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const now = new Date();
      let startDate: Date;
      
      if (period === 'month') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
      } else {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
      }

      const { data: sessions } = await supabase
        .from('sessions')
        .select('session_start, duration, rate, paid')
        .gte('session_start', startDate.toISOString())
        .eq('paid', true)
        .order('session_start', { ascending: true });

      // Group by date
      const earningsByDate = sessions?.reduce((acc: any, session) => {
        const date = new Date(session.session_start).toISOString().split('T')[0];
        const earnings = (session.duration / 60) * parseFloat(session.rate);
        
        if (!acc[date]) {
          acc[date] = 0;
        }
        acc[date] += earnings;
        return acc;
      }, {});

      const trendData = Object.entries(earningsByDate || {}).map(([date, earnings]) => ({
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
  app.get("/api/admin/top-tutors", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: tutor } = await supabase
        .from('tutors')
        .select('is_admin')
        .eq('user_id', userId)
        .single();

      if (!tutor?.is_admin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Get all sessions with tutor info
      const { data: sessions } = await supabase
        .from('sessions')
        .select(`
          tutor_id,
          duration,
          rate,
          paid,
          tutors (
            full_name,
            email
          )
        `)
        .eq('paid', true);

      // Aggregate by tutor
      const tutorStats = sessions?.reduce((acc: any, session: any) => {
        const tutorId = session.tutor_id;
        const earnings = (session.duration / 60) * parseFloat(session.rate);
        
        if (!acc[tutorId]) {
          acc[tutorId] = {
            tutorId,
            name: session.tutors?.full_name || 'Unknown',
            email: session.tutors?.email || '',
            totalEarnings: 0,
            sessionCount: 0
          };
        }
        
        acc[tutorId].totalEarnings += earnings;
        acc[tutorId].sessionCount += 1;
        return acc;
      }, {});

      const topTutors = Object.values(tutorStats || {})
        .sort((a: any, b: any) => b.totalEarnings - a.totalEarnings)
        .slice(0, 10);

      res.json(topTutors);
    } catch (error) {
      console.error('Top tutors error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin: Telegram broadcast
  app.post("/api/admin/broadcast", async (req, res) => {
    try {
      const { userId, message } = req.body;
      
      if (!userId || !message) {
        return res.status(400).json({ error: "User ID and message are required" });
      }

      const { data: tutor } = await supabase
        .from('tutors')
        .select('is_admin')
        .eq('user_id', userId)
        .single();

      if (!tutor?.is_admin) {
        return res.status(403).json({ error: "Forbidden" });
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

  const httpServer = createServer(app);
  return httpServer;
}
