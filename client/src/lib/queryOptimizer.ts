import { supabase } from "@/lib/supabaseClient";
import { datasetMonitor } from "@/lib/datasetMonitor";

// Cache for tutor session counts to avoid repeated queries
const sessionCountCache = new Map<string, { count: number; timestamp: number; isOptimized: boolean }>();
const CACHE_DURATION = 90 * 1000; // 90 seconds

// Configuration constants for optimization thresholds
const OPTIMIZATION_THRESHOLD = 500; // Sessions count to enable optimization
const DISABLE_THRESHOLD = 470; // Sessions count to disable optimization (hysteresis buffer)
const MAX_UNPAID_SESSIONS_LIMIT = 1000; // Safety limit for unpaid sessions
const QUERY_TIMEOUT = 30000; // 30 seconds timeout for queries

// Export function to invalidate cache after session mutations
export function invalidateSessionCountCache(tutorId?: string): void {
  if (tutorId) {
    sessionCountCache.delete(tutorId);
    console.log(`Session count cache invalidated for tutor: ${tutorId}`);
  } else {
    sessionCountCache.clear();
    console.log('Session count cache cleared for all tutors');
  }
}

export async function shouldUseOptimizedQuery(tutorId: string): Promise<boolean> {
  // Check cache first
  const cached = sessionCountCache.get(tutorId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    // Use hysteresis logic: maintain current optimization state unless crossing the opposite threshold
    let shouldOptimize: boolean;
    
    if (cached.isOptimized) {
      // Currently optimized: only disable if count drops below DISABLE_THRESHOLD
      shouldOptimize = cached.count >= DISABLE_THRESHOLD;
    } else {
      // Currently not optimized: only enable if count reaches OPTIMIZATION_THRESHOLD
      shouldOptimize = cached.count >= OPTIMIZATION_THRESHOLD;
    }
    
    console.log(`Using cached count for tutor: ${cached.count} sessions, optimized: ${shouldOptimize} (hysteresis: was ${cached.isOptimized})`);
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
    
    // Determine optimization state using hysteresis
    const previousState = cached?.isOptimized ?? false;
    let shouldOptimize: boolean;
    
    if (previousState) {
      // Was optimized: only disable if below DISABLE_THRESHOLD
      shouldOptimize = sessionCount >= DISABLE_THRESHOLD;
    } else {
      // Was not optimized: only enable if at or above OPTIMIZATION_THRESHOLD
      shouldOptimize = sessionCount >= OPTIMIZATION_THRESHOLD;
    }
    
    // Cache the result with optimization state
    sessionCountCache.set(tutorId, {
      count: sessionCount,
      timestamp: now,
      isOptimized: shouldOptimize
    });

    console.log(`Dataset analysis: ${sessionCount} sessions, optimization ${shouldOptimize ? 'enabled' : 'disabled'} (threshold: enable≥${OPTIMIZATION_THRESHOLD}, disable<${DISABLE_THRESHOLD})`);
    
    return shouldOptimize;
  } catch (error) {
    console.error('Error in shouldUseOptimizedQuery:', error);
    return false;
  }
}

export async function getOptimizedSessions(tutorId: string) {
  const startTime = Date.now();
  console.log('🔥 OPTIMIZED QUERY: Starting PAGINATED fetch for tutor', tutorId.substring(0, 8) + '...');
  
  try {
    // PAGINATED FETCH: Supabase enforces an implicit ~1000 row limit despite .limit()
    // We use .range() to fetch in batches of 1000 and combine all results
    const BATCH_SIZE = 1000;
    const MAX_BATCHES = 20; // Safety limit: 20 * 1000 = 20,000 sessions max
    const allSessions: any[] = [];
    const seenIds = new Set<string>(); // For deduplication
    let currentBatch = 0;
    let hasMore = true;
    
    console.log('🔥 PAGINATED FETCH: Starting batch retrieval...');
    
    while (hasMore && currentBatch < MAX_BATCHES) {
      const rangeStart = currentBatch * BATCH_SIZE;
      const rangeEnd = rangeStart + BATCH_SIZE - 1;
      
      const { data: batchData, error } = await supabase
        .from('sessions')
        .select('id, student_id, session_start, session_end, duration, rate, paid, notes, color, recurrence_id, created_at, status, unassigned_name')
        .eq('tutor_id', tutorId)
        .order('created_at', { ascending: false })
        .range(rangeStart, rangeEnd);
      
      if (error) {
        console.error(`Error fetching batch ${currentBatch}:`, error);
        if (currentBatch === 0) {
          // First batch failed, fall back to standard query
          console.log('Falling back to standard query due to pagination error');
          return await getStandardSessions(tutorId);
        }
        // Partial data retrieved, continue with what we have
        break;
      }
      
      const batchCount = batchData?.length || 0;
      console.log(`🔥 Batch ${currentBatch + 1}: Retrieved ${batchCount} sessions (range ${rangeStart}-${rangeEnd})`);
      
      // Add unique sessions to our collection (deduplicate by ID)
      if (batchData) {
        for (const session of batchData) {
          if (!seenIds.has(session.id)) {
            seenIds.add(session.id);
            allSessions.push(session);
          }
        }
      }
      
      // Check if we should continue fetching
      if (batchCount < BATCH_SIZE) {
        // Got fewer than requested, we've reached the end
        hasMore = false;
        console.log(`🔥 Pagination complete: Last batch had ${batchCount} rows (< ${BATCH_SIZE})`);
      }
      
      currentBatch++;
    }
    
    if (currentBatch >= MAX_BATCHES) {
      console.warn(`⚠️ Reached maximum batch limit (${MAX_BATCHES}). Some sessions may be missing.`);
    }
    
    const rowCount = allSessions.length;
    
    // Calculate date range of returned sessions for debugging
    let minDate = null;
    let maxDate = null;
    let paidCount = 0;
    let paidTrueCount = 0;
    let paidStringTrueCount = 0;
    
    if (allSessions.length > 0) {
      const dates = allSessions.map(s => new Date(s.session_start).getTime());
      minDate = new Date(Math.min(...dates)).toISOString();
      maxDate = new Date(Math.max(...dates)).toISOString();
      
      // Count paid sessions with detailed type checking
      allSessions.forEach(s => {
        if (s.paid === true) paidTrueCount++;
        if (s.paid === 'true') paidStringTrueCount++;
        if (s.paid === true || s.paid === 'true') paidCount++;
      });
    }
    
    console.log('🔥 PAGINATED QUERY COMPLETE:', {
      totalRowsReturned: rowCount,
      batchesFetched: currentBatch,
      deduplicatedCount: seenIds.size,
      DATE_RANGE: {
        oldest: minDate,
        newest: maxDate,
        spanMonths: minDate && maxDate ? Math.ceil((new Date(maxDate).getTime() - new Date(minDate).getTime()) / (30 * 24 * 60 * 60 * 1000)) : 0
      },
      PAID_ANALYSIS: {
        totalPaid: paidCount,
        paidBooleanTrue: paidTrueCount,
        paidStringTrue: paidStringTrueCount,
        unpaid: rowCount - paidCount
      },
      firstSession: allSessions[0] ? {
        id: allSessions[0].id?.substring(0, 8) + '...',
        session_start: allSessions[0].session_start,
        paid: allSessions[0].paid
      } : null,
      lastSession: allSessions[allSessions.length - 1] ? {
        id: allSessions[allSessions.length - 1].id?.substring(0, 8) + '...',
        session_start: allSessions[allSessions.length - 1].session_start,
        paid: allSessions[allSessions.length - 1].paid
      } : null
    });

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
    console.log('📊 STANDARD QUERY: Starting for tutor', tutorId.substring(0, 8) + '...');
    
    // Use .limit(10000) to override Supabase's default 1000-row limit
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
      .order('session_start', { ascending: false })
      .limit(10000);

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

    const rowCount = data?.length || 0;
    console.log('📊 STANDARD QUERY RESULT:', {
      totalRowsReturned: rowCount,
      queryHadLimit10000: true,
      POTENTIAL_TRUNCATION: rowCount === 1000 ? '⚠️ EXACTLY 1000 ROWS - POSSIBLE TRUNCATION!' : 'OK',
      firstRow: data?.[0] ? {
        id: data[0].id?.substring(0, 8) + '...',
        status: data[0].status,
        session_start: data[0].session_start
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
    console.log('Returning empty sessions array to prevent application crash');
    return [];
  }
}