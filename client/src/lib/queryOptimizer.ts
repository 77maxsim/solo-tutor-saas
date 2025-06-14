import { supabase } from "@/lib/supabaseClient";

// Cache for tutor session counts to avoid repeated queries
const sessionCountCache = new Map<string, { count: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function shouldUseOptimizedQuery(tutorId: string): Promise<boolean> {
  // Check cache first
  const cached = sessionCountCache.get(tutorId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.count > 500; // Threshold for optimization
  }

  try {
    // Get session count for this tutor
    const { count, error } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('tutor_id', tutorId);

    if (error) {
      console.error('Error checking session count:', error);
      return false; // Fall back to standard query on error
    }

    const sessionCount = count || 0;
    
    // Cache the result
    sessionCountCache.set(tutorId, {
      count: sessionCount,
      timestamp: now
    });

    // Use optimized query if session count exceeds threshold
    return sessionCount > 500;
  } catch (error) {
    console.error('Error in shouldUseOptimizedQuery:', error);
    return false;
  }
}

export async function getOptimizedSessions(tutorId: string) {
  console.log('🔧 Using optimized query pattern for large dataset');
  
  // Get paid sessions
  const { data: paidSessions, error: paidError } = await supabase
    .from('sessions')
    .select('id, student_id, date, time, duration, rate, paid, notes, color, recurrence_id, created_at')
    .eq('tutor_id', tutorId)
    .eq('paid', true)
    .order('date', { ascending: true });

  if (paidError) {
    console.error('Error fetching paid sessions:', paidError);
    throw paidError;
  }

  // Get recent unpaid sessions for context (limit to avoid performance issues)
  const { data: unpaidSessions, error: unpaidError } = await supabase
    .from('sessions')
    .select('id, student_id, date, time, duration, rate, paid, notes, color, recurrence_id, created_at')
    .eq('tutor_id', tutorId)
    .eq('paid', false)
    .order('date', { ascending: false })
    .limit(200);

  if (unpaidError) {
    console.error('Error fetching unpaid sessions:', unpaidError);
  }

  // Get student data separately
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, name')
    .eq('tutor_id', tutorId);

  if (studentsError) {
    console.error('Error fetching students:', studentsError);
    throw studentsError;
  }

  // Create student name map
  const studentNameMap = new Map();
  students?.forEach(student => {
    studentNameMap.set(student.id, student.name);
  });

  // Combine paid and unpaid sessions with student names
  const allSessions = [
    ...(paidSessions || []),
    ...(unpaidSessions || [])
  ].map((session: any) => ({
    ...session,
    student_name: studentNameMap.get(session.student_id) || 'Unknown Student'
  }));

  console.log('🔧 Optimized query results:', {
    totalSessions: allSessions.length,
    paidSessions: allSessions.filter(s => s.paid === true).length,
    unpaidSessions: allSessions.filter(s => s.paid === false).length
  });

  return allSessions;
}

export async function getStandardSessions(tutorId: string) {
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
      notes,
      color,
      recurrence_id,
      created_at,
      students (
        name
      )
    `)
    .eq('tutor_id', tutorId)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching sessions:', error);
    throw error;
  }

  // Transform the data to include student_name
  const sessionsWithNames = data?.map((session: any) => ({
    ...session,
    student_name: session.students?.name || 'Unknown Student'
  })) || [];

  return sessionsWithNames;
}