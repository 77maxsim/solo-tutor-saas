import { supabase } from "@/lib/supabaseClient";
import { shouldUseOptimizedQuery } from "@/lib/queryOptimizer";

export async function getOptimizedDashboardStats(tutorId: string) {
  const useOptimized = await shouldUseOptimizedQuery(tutorId);
  
  if (!useOptimized) {
    return getStandardDashboardStats(tutorId);
  }

  console.log('🔧 Using optimized dashboard calculation for large dataset');

  // DEPRECATED: This optimizer is no longer used - dashboard now uses shared earningsCalculator
  // with proper timezone handling via queryOptimizer system
  console.log('⚠️ dashboardOptimizer is deprecated - should use shared earningsCalculator');
  
  // Fallback to standard approach
  return getStandardDashboardStats(tutorId);

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
  // DEPRECATED: This function uses old date comparison logic
  // Dashboard now uses shared earningsCalculator with proper timezone handling
  console.log('⚠️ calculateDashboardStats is deprecated');
  
  return {
    sessionsThisWeek: 0,
    todayEarnings: 0,
    currentWeekEarnings: 0,
    currentMonthEarnings: 0,
    lastMonthEarnings: 0
  };
}