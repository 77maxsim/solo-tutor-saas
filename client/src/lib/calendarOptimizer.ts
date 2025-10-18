import { supabase } from "@/lib/supabaseClient";
import { shouldUseOptimizedQuery } from "@/lib/queryOptimizer";

export interface CalendarSession {
  id: string;
  student_id: string | null;
  student_name: string;
  session_start: string;
  session_end: string;
  duration: number;
  rate: number;
  tuition_fee: number;
  notes: string;
  paid: boolean;
  created_at: string;
  tutor_id?: string;
  avatarUrl?: string;
  color?: string;
  recurrence_id?: string;
  status?: string;
  unassigned_name?: string;
  isPastSession?: boolean;
}

/**
 * Fetches calendar sessions with dataset optimization
 * @param tutorId - The tutor's ID
 * @param tz - The tutor's timezone (not used in this function but kept for API consistency)
 * @returns Array of sessions with student names
 */
export async function fetchCalendarSessions(
  tutorId: string,
  tz: string
): Promise<CalendarSession[]> {
  console.log('📅 fetchCalendarSessions called for tutor:', tutorId, 'timezone:', tz);
  
  // Step 1: Check if we should use optimization
  const shouldOptimize = await shouldUseOptimizedQuery(tutorId);
  
  let sessions: CalendarSession[] = [];
  
  if (shouldOptimize) {
    // Step 2a: Optimized query - fetch sessions and students separately
    console.log('🔧 Using optimized query pattern for calendar');
    
    // Fetch sessions with minimal columns
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, student_id, tutor_id, session_start, session_end, paid, status, rate, duration, notes, color, recurrence_id, unassigned_name, created_at')
      .eq('tutor_id', tutorId);
    
    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw sessionsError;
    }
    
    // Fetch students separately
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, name')
      .eq('tutor_id', tutorId);
    
    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      throw studentsError;
    }
    
    // Create student map for fast lookup
    const studentMap = new Map<string, string>();
    studentsData?.forEach((student: { id: string; name: string }) => {
      studentMap.set(student.id, student.name);
    });
    
    // Merge sessions with student names
    sessions = (sessionsData || []).map((session: any) => {
      const rateNum = parseFloat(session.rate || '0');
      const durationNum = session.duration || 60;
      return {
        id: session.id,
        student_id: session.student_id,
        tutor_id: session.tutor_id,
        session_start: session.session_start,
        session_end: session.session_end,
        paid: session.paid,
        status: session.status,
        rate: rateNum,
        student_name: session.student_id ? (studentMap.get(session.student_id) || 'Unknown') : 'Unassigned',
        duration: durationNum,
        tuition_fee: (durationNum / 60) * rateNum,
        notes: session.notes || '',
        color: session.color,
        recurrence_id: session.recurrence_id,
        unassigned_name: session.unassigned_name,
        avatarUrl: undefined,
        created_at: session.created_at || ''
      };
    });
    
    console.log('✅ Optimized query returned:', sessions.length, 'sessions');
  } else {
    // Step 2b: Standard query - use JOIN for small datasets
    console.log('📊 Using standard query with JOIN for calendar');
    
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        student_id,
        tutor_id,
        session_start,
        session_end,
        paid,
        status,
        rate,
        duration,
        notes,
        color,
        recurrence_id,
        unassigned_name,
        created_at,
        students (
          id,
          name
        )
      `)
      .eq('tutor_id', tutorId);
    
    if (error) {
      console.error('Error fetching sessions:', error);
      throw error;
    }
    
    // Transform to include student_name
    sessions = (data || []).map((session: any) => {
      const rateNum = parseFloat(session.rate || '0');
      const durationNum = session.duration || 60;
      return {
        id: session.id,
        student_id: session.student_id,
        tutor_id: session.tutor_id,
        session_start: session.session_start,
        session_end: session.session_end,
        paid: session.paid,
        status: session.status,
        rate: rateNum,
        student_name: session.students?.name || 'Unassigned',
        duration: durationNum,
        tuition_fee: (durationNum / 60) * rateNum,
        notes: session.notes || '',
        color: session.color,
        recurrence_id: session.recurrence_id,
        unassigned_name: session.unassigned_name,
        avatarUrl: undefined,
        created_at: session.created_at || ''
      };
    });
    
    console.log('✅ Standard query returned:', sessions.length, 'sessions');
  }
  
  return sessions;
}
