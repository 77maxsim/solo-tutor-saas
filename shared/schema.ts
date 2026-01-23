import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("tutor"),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  tutorId: integer("tutor_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  tags: text("tags").array(),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  tutorId: integer("tutor_id").notNull(),
  studentId: integer("student_id"),
  title: text("title"),
  description: text("description"),
  // DEPRECATED: date field - migrated to session_start/session_end UTC timestamps
  // date: text("date").notNull(),
  // DEPRECATED: time field - migrated to session_start/session_end UTC timestamps
  // time: text("time").notNull(),
  sessionStart: text("session_start").notNull(), // UTC timestamp
  sessionEnd: text("session_end").notNull(), // UTC timestamp
  duration: integer("duration").notNull(),
  rate: decimal("rate", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled, pending
  paid: boolean("paid").notNull().default(false),
  recurrenceId: text("recurrence_id"), // UUID for grouping recurring sessions
  notes: text("notes"), // Optional notes for the session
  unassignedName: text("unassigned_name"), // For public bookings without student_id
  color: text("color"),
  // Cancellation tracking fields
  cancellationReason: text("cancellation_reason"), // 'tutor' or 'student' - who cancelled
  cancelledAt: timestamp("cancelled_at"), // When the session was cancelled
  cancellationNote: text("cancellation_note"), // Optional note explaining cancellation
  cancellationSource: text("cancellation_source"), // 'single' or 'bulk' - how it was cancelled
  bulkExcluded: boolean("bulk_excluded").default(false), // Exclude from cancellation rate calculations
});

export const bookingSlots = pgTable("booking_slots", {
  id: serial("id").primaryKey(),
  tutorId: integer("tutor_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  method: text("method").notNull().default("cash"), // cash, bank_transfer, paypal, etc.
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
});

export const insertBookingSlotSchema = createInsertSchema(bookingSlots).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertBookingSlot = z.infer<typeof insertBookingSlotSchema>;
export type BookingSlot = typeof bookingSlots.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Tutor type for Supabase tutors table (not managed by Drizzle)
export interface Tutor {
  id: number;
  email: string;
  full_name: string;
  user_id: string;
  timezone: string;
  sync_google_calendar: boolean;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_token_expires_at?: string | null;
  google_calendar_connected: boolean;
  avatar_url?: string | null;
  currency?: string;
  time_format?: string;
  is_admin?: boolean;
  created_at?: string;
  onboarding_completed?: boolean;
  onboarding_dismissed?: boolean;
  // USD exchange rate caching for tutor toggle
  usd_exchange_rate?: number | null;
  usd_rate_fetched_at?: string | null;
}

// Cancellation tracking types
export type CancellationReason = 'tutor' | 'student';
export type CancellationSource = 'single' | 'bulk';

export interface CancellationData {
  cancellation_reason: CancellationReason;
  cancelled_at: string;
  cancellation_note?: string;
  cancellation_source: CancellationSource;
  bulk_excluded?: boolean;
}

export interface CancellationStats {
  totalCancelled: number;
  totalCompleted: number;
  tutorCancelled: number;
  studentCancelled: number;
  cancellationRate: number;
  tutorCancellationRate: number;
  studentCancellationRate: number;
}
