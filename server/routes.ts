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

  const httpServer = createServer(app);
  return httpServer;
}
