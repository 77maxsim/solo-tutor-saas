import { supabase } from "@/lib/supabaseClient";
import { datasetMonitor } from "@/lib/datasetMonitor";

// Cache for tutor session counts to avoid repeated queries
const sessionCountCache = new Map<string, { count: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Configuration constants for optimization thresholds
const OPTIMIZATION_THRESHOLD = 500; // Sessions count to trigger optimization
const MAX_UNPAID_SESSIONS_LIMIT = 1000; // Safety limit for unpaid sessions
const QUERY_TIMEOUT = 30000; // 30 seconds timeout for queries

export async function shouldUseOptimizedQuery(tutorId: string): Promise<boolean> {
  // Check cache first
  const cached = sessionCountCache.get(tutorId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    const shouldOptimize = cached.count > OPTIMIZATION_THRESHOLD;
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
    const shouldOptimize = sessionCount > OPTIMIZATION_THRESHOLD;
    console.log(`📊 Dataset analysis: ${sessionCount} sessions, optimization ${shouldOptimize ? 'enabled' : 'disabled'}`);
    
    return shouldOptimize;
  } catch (error) {
    console.error('Error in shouldUseOptimizedQuery:', error);
    return false;
  }
}

export async function getOptimizedSessions(tutorId: string) {
  const startTime = Date.now();
  console.log('Using optimized query pattern for large dataset, tutor:', tutorId);
  
  try {
    // Get ALL sessions without joins to avoid performance issues
    const { data: allSessions, error } = await supabase
      .from('sessions')
      .select('id, student_id, session_start, session_end, duration, rate, paid, notes, color, recurrence_id, created_at, status, unassigned_name')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching optimized sessions:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      // Fallback to standard query on error
      console.log('Falling back to standard query due to optimization error');
      return await getStandardSessions(tutorId);
    }

    console.log('Optimized query raw data:', {
      totalRows: allSessions?.length || 0,
      firstRow: allSessions?.[0] ? {
        id: allSessions[0].id?.substring(0, 8) + '...',
        status: allSessions[0].status,
        session_start: allSessions[0].session_start,
        session_end: allSessions[0].session_end,
        unassigned_name: allSessions[0].unassigned_name,
        student_id: allSessions[0].student_id
      } : null
    });

    // Safety check: If we get an unexpectedly large dataset, log a warning
    if (allSessions && allSessions.length > 10000) {
      console.warn(`⚠️ Very large dataset detected: ${allSessions.length} sessions. Consider additional optimization.`);
    }

    // Get student data separately
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, avatar_url')
      .eq('tutor_id', tutorId);

    if (studentsError) {
      console.error('Error fetching students for optimization:', studentsError);
      // Continue with sessions data but without student names
      return (allSessions || []).map((session: any) => ({
        ...session,
        student_name: 'Loading...'
      }));
    }

    // Create student data map
    const studentDataMap = new Map();
    students?.forEach(student => {
      studentDataMap.set(student.id, {
        name: student.name,
        avatar_url: student.avatar_url
      });
    });

    // Add student names and avatars to all sessions (including pending ones)
    const sessionsWithNames = (allSessions || []).map((session: any) => {
      const studentData = studentDataMap.get(session.student_id);
      
      // Handle pending sessions without assigned students
      let displayName = 'Unknown Student';
      if (session.status === 'pending' && !session.student_id) {
        displayName = session.unassigned_name || 'Pending Request';
      } else if (studentData?.name) {
        displayName = studentData.name;
      } else if (session.unassigned_name) {
        displayName = session.unassigned_name;
      }
      
      return {
        ...session,
        student_name: displayName,
        avatarUrl: studentData?.avatar_url
      };
    });

    // Track performance metrics
    await datasetMonitor.trackQueryPerformance(tutorId, 'optimized', startTime, sessionsWithNames.length);

    // Check if archiving is recommended
    datasetMonitor.checkArchivingRecommendation(tutorId);

    // Debug: Check for booking requests specifically
    const bookingRequests = sessionsWithNames.filter(s => 
      s.unassigned_name && s.unassigned_name.includes('Booking request from')
    );
    
    console.log('Optimized query results:', {
      totalSessions: sessionsWithNames.length,
      paidSessions: sessionsWithNames.filter(s => s.paid === true).length,
      unpaidSessions: sessionsWithNames.filter(s => s.paid === false).length,
      pendingSessions: sessionsWithNames.filter(s => s.status === 'pending').length,
      confirmedSessions: sessionsWithNames.filter(s => s.status === 'confirmed').length,
      bookingRequests: bookingRequests.length,
      studentsCount: students?.length || 0,
      recentBookingRequests: bookingRequests.slice(0, 3).map(s => ({
        id: s.id?.substring(0, 8) + '...',
        student_name: s.student_name,
        unassigned_name: s.unassigned_name,
        status: s.status,
        session_start: s.session_start,
        session_end: s.session_end,
        has_timestamps: !!(s.session_start && s.session_end)
      })),
      recentSessions: sessionsWithNames.slice(0, 3).map(s => ({
        id: s.id,
        student_name: s.student_name,
        unassigned_name: s.unassigned_name,
        status: s.status,
        session_start: s.session_start,
        session_end: s.session_end
      }))
    });

    return sessionsWithNames;
  } catch (error) {
    console.error('Critical error in optimized query:', error);
    // Ultimate fallback to standard query
    console.log('Critical fallback to standard query');
    return await getStandardSessions(tutorId);
  }
}

export async function getStandardSessions(tutorId: string) {
  const startTime = Date.now();
  
  try {
    console.log('Standard query - fetching sessions for tutor:', tutorId);
    
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        student_id,
        session_start,
        session_end,
        duration,
        rate,
        paid,
        notes,
        color,
        recurrence_id,
        created_at,
        status,
        unassigned_name,
        students (
          id,
          name,
          avatar_url
        )
      `)
      .eq('tutor_id', tutorId)
      .order('session_start', { ascending: false });
        session_end,
        duration,
        rate,
        paid,
        notes,
        color,
        recurrence_id,
        created_at,
        status,
        unassigned_name,
        students (
          id,
          name,
          avatar_url
        )
      `)
      .eq('tutor_id', tutorId)
      .order('session_start', { ascending: false });

    if (error) {
      console.error('Error fetching standard sessions:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    console.log('Standard query raw data:', {
      totalRows: data?.length || 0,
      firstRow: data?.[0] ? {
        id: data[0].id?.substring(0, 8) + '...',
        status: data[0].status,
        session_start: data[0].session_start,
        session_end: data[0].session_end,
        unassigned_name: data[0].unassigned_name,
        student_id: data[0].student_id
      } : null
    });

    // Transform the data to include student_name and avatarUrl (including pending sessions)
    const sessionsWithNames = data?.map((session: any) => {
      // Handle pending sessions without assigned students
      let displayName = 'Unknown Student';
      if (session.status === 'pending' && !session.student_id) {
        displayName = session.unassigned_name || 'Pending Request';
      } else if (session.students?.name) {
        displayName = session.students.name;
      } else if (session.unassigned_name) {
        displayName = session.unassigned_name;
      }
      
      return {
        ...session,
        student_name: displayName,
        avatarUrl: session.students?.avatar_url
      };
    }) || [];

    console.log('Standard query results:', {
      totalSessions: sessionsWithNames.length,
      recentSessions: sessionsWithNames.slice(0, 5).map(s => ({
        id: s.id,
        student_name: s.student_name,
        status: s.status,
        session_start: s.session_start,
        session_end: s.session_end,
        has_timestamps: !!(s.session_start && s.session_end)
      }))
    });

    // Track performance metrics
    await datasetMonitor.trackQueryPerformance(tutorId, 'standard', startTime, sessionsWithNames.length);

    return sessionsWithNames;
  } catch (error) {
    console.error('Critical error in standard query:', error);
    // Last resort fallback - return empty array to prevent app crash
    console.log('Returning empty sessions array to prevent application crash');
    return [];
  }
}