import { 
  users, students, sessions, payments,
  type User, type InsertUser,
  type Student, type InsertStudent,
  type Session, type InsertSession,
  type Payment, type InsertPayment
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Student methods
  getStudentsByTutorId(tutorId: number): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student | undefined>;
  
  // Session methods
  getSessionsByTutorId(tutorId: number): Promise<Session[]>;
  getUpcomingSessions(tutorId: number, limit?: number): Promise<Session[]>;
  getSession(id: number): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: number, session: Partial<InsertSession>): Promise<Session | undefined>;
  
  // Payment methods
  getPaymentsByTutorId(tutorId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  
  // Dashboard stats
  getDashboardStats(tutorId: number): Promise<{
    sessionsThisWeek: number;
    totalEarnings: number;
    pendingPayments: number;
    activeStudents: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private students: Map<number, Student>;
  private sessions: Map<number, Session>;
  private payments: Map<number, Payment>;
  private currentId: number;
  private currentStudentId: number;
  private currentSessionId: number;
  private currentPaymentId: number;

  constructor() {
    this.users = new Map();
    this.students = new Map();
    this.sessions = new Map();
    this.payments = new Map();
    this.currentId = 1;
    this.currentStudentId = 1;
    this.currentSessionId = 1;
    this.currentPaymentId = 1;
    
    // Initialize with a sample user
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Create sample tutor
    const sampleUser: User = {
      id: 1,
      username: "sarah.johnson",
      password: "password123",
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah@example.com",
      role: "tutor"
    };
    this.users.set(1, sampleUser);
    this.currentId = 2;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getStudentsByTutorId(tutorId: number): Promise<Student[]> {
    return Array.from(this.students.values()).filter(
      (student) => student.tutorId === tutorId && student.isActive
    );
  }

  async getStudent(id: number): Promise<Student | undefined> {
    return this.students.get(id);
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const id = this.currentStudentId++;
    const student: Student = { ...insertStudent, id };
    this.students.set(id, student);
    return student;
  }

  async updateStudent(id: number, updateData: Partial<InsertStudent>): Promise<Student | undefined> {
    const existing = this.students.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.students.set(id, updated);
    return updated;
  }

  async getSessionsByTutorId(tutorId: number): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (session) => session.tutorId === tutorId
    );
  }

  async getUpcomingSessions(tutorId: number, limit: number = 5): Promise<Session[]> {
    const now = new Date();
    return Array.from(this.sessions.values())
      .filter((session) => session.tutorId === tutorId && new Date(session.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, limit);
  }

  async getSession(id: number): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = this.currentSessionId++;
    const session: Session = { ...insertSession, id };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(id: number, updateData: Partial<InsertSession>): Promise<Session | undefined> {
    const existing = this.sessions.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updateData };
    this.sessions.set(id, updated);
    return updated;
  }

  async getPaymentsByTutorId(tutorId: number): Promise<Payment[]> {
    const tutorSessions = await this.getSessionsByTutorId(tutorId);
    const sessionIds = tutorSessions.map(s => s.id);
    
    return Array.from(this.payments.values()).filter(
      (payment) => sessionIds.includes(payment.sessionId)
    );
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = this.currentPaymentId++;
    const payment: Payment = { ...insertPayment, id };
    this.payments.set(id, payment);
    return payment;
  }

  async getDashboardStats(tutorId: number): Promise<{
    sessionsThisWeek: number;
    totalEarnings: number;
    pendingPayments: number;
    activeStudents: number;
  }> {
    const sessions = await this.getSessionsByTutorId(tutorId);
    const students = await this.getStudentsByTutorId(tutorId);
    const payments = await this.getPaymentsByTutorId(tutorId);
    
    // Calculate stats
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const sessionsThisWeek = sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    }).length;
    
    const totalEarnings = payments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount.toString());
    }, 0);
    
    const unpaidSessions = sessions.filter(session => !session.isPaid && session.status === 'completed');
    const pendingPayments = unpaidSessions.reduce((sum, session) => {
      return sum + parseFloat(session.rate.toString());
    }, 0);
    
    const activeStudents = students.length;
    
    return {
      sessionsThisWeek,
      totalEarnings,
      pendingPayments,
      activeStudents
    };
  }
}

export const storage = new MemStorage();
