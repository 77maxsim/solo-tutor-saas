import { supabase } from "@/lib/supabaseClient";

// Cache for tutor session counts to avoid repeated queries
const sessionCountCache = new Map<string, { count: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function shouldUseOptimizedQuery(tutorId: string): Promise<boolean> {
  // Check cache first
  const cached = sessionCountCache.get(tutorId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    const shouldOptimize = cached.count > 500;
    console.log(`📊 Using cached count for tutor: ${cached.count} sessions, optimized: ${shouldOptimize}`);
    return shouldOptimize;
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
    const shouldOptimize = sessionCount > 500;
    console.log(`📊 Dataset analysis: ${sessionCount} sessions, optimization ${shouldOptimize ? 'enabled' : 'disabled'}`);
    
    return shouldOptimize;
  } catch (error) {
    console.error('Error in shouldUseOptimizedQuery:', error);
    return false;
  }
}

export async function getOptimizedSessions(tutorId: string) {
  console.log('🔧 Using optimized query pattern for large dataset');
  
  // Get ALL sessions without joins to avoid performance issues
  const { data: allSessions, error } = await supabase
    .from('sessions')
    .select('id, student_id, date, time, duration, rate, paid, notes, color, recurrence_id, created_at')
    .eq('tutor_id', tutorId)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching sessions:', error);
    throw error;
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

  // Add student names to all sessions
  const sessionsWithNames = (allSessions || []).map((session: any) => ({
    ...session,
    student_name: studentNameMap.get(session.student_id) || 'Unknown Student'
  }));

  console.log('🔧 Optimized query results:', {
    totalSessions: sessionsWithNames.length,
    paidSessions: sessionsWithNames.filter(s => s.paid === true).length,
    unpaidSessions: sessionsWithNames.filter(s => s.paid === false).length
  });

  return sessionsWithNames;
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