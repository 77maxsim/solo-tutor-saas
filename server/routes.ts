import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStudentSchema, insertSessionSchema, insertPaymentSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
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
