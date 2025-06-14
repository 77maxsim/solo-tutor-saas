import { supabase } from "@/lib/supabaseClient";
import { shouldUseOptimizedQuery } from "@/lib/queryOptimizer";

export async function getOptimizedDashboardStats(tutorId: string) {
  const useOptimized = await shouldUseOptimizedQuery(tutorId);
  
  if (!useOptimized) {
    return getStandardDashboardStats(tutorId);
  }

  console.log('🔧 Using optimized dashboard calculation for large dataset');

  // Get paid sessions for current month
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const { data: paidSessions, error: paidError } = await supabase
    .from('sessions')
    .select('id, date, time, duration, rate, paid, student_id')
    .eq('tutor_id', tutorId)
    .eq('paid', true)
    .gte('date', firstDayOfMonth.toISOString().split('T')[0])
    .lte('date', lastDayOfMonth.toISOString().split('T')[0]);

  if (paidError) {
    console.error('Error fetching paid sessions:', paidError);
    throw paidError;
  }

  // Get unpaid sessions count
  const { count: unpaidCount, error: unpaidError } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tutor_id', tutorId)
    .eq('paid', false);

  if (unpaidError) {
    console.error('Error counting unpaid sessions:', unpaidError);
  }

  // Get active students count
  const { count: activeStudents, error: studentsError } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('tutor_id', tutorId);

  if (studentsError) {
    console.error('Error counting students:', studentsError);
  }

  // Calculate statistics from paid sessions
  const stats = calculateDashboardStats(paidSessions || [], now);
  
  return {
    ...stats,
    pendingPayments: unpaidCount || 0,
    unpaidStudentsCount: unpaidCount || 0,
    activeStudents: activeStudents || 0
  };
}

async function getStandardDashboardStats(tutorId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id,
      student_id,
      date,
      time,
      duration,
      rate,
      paid,
      created_at,
      students (
        name
      )
    `)
    .eq('tutor_id', tutorId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }

  const now = new Date();
  const stats = calculateDashboardStats(data || [], now);

  // Count students
  const uniqueStudents = new Set(data?.map(s => s.student_id) || []);

  return {
    ...stats,
    pendingPayments: data?.filter(s => !s.paid).length || 0,
    unpaidStudentsCount: data?.filter(s => !s.paid).length || 0,
    activeStudents: uniqueStudents.size
  };
}

function calculateDashboardStats(sessions: any[], now: Date) {
  // Calculate week boundaries (Sunday to Saturday)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Calculate month boundaries
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  // Calculate last month boundaries
  const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const today = now.toISOString().split('T')[0];

  let sessionsThisWeek = 0;
  let todayEarnings = 0;
  let currentWeekEarnings = 0;
  let currentMonthEarnings = 0;
  let lastMonthEarnings = 0;

  sessions.forEach(session => {
    const sessionDate = new Date(session.date);
    const isPaid = session.paid === true;
    const earnings = (session.duration / 60) * session.rate;

    if (!isPaid) return; // Only count paid sessions for earnings

    // Today's earnings
    if (session.date === today) {
      todayEarnings += earnings;
    }

    // This week's earnings and sessions
    if (sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
      currentWeekEarnings += earnings;
      sessionsThisWeek++;
    }

    // This month's earnings
    if (sessionDate >= firstDayOfMonth && sessionDate <= lastDayOfMonth) {
      currentMonthEarnings += earnings;
    }

    // Last month's earnings
    if (sessionDate >= firstDayOfLastMonth && sessionDate <= lastDayOfLastMonth) {
      lastMonthEarnings += earnings;
    }
  });

  return {
    sessionsThisWeek,
    todayEarnings,
    currentWeekEarnings,
    currentMonthEarnings,
    lastMonthEarnings
  };
}