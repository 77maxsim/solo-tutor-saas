// Import dayjs for timezone handling
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

// Import the new Monday-Sunday date range helpers
import { weekRange, monthRange, APP_TIMEZONE } from './dateRange';

// Shared earnings calculation logic for Dashboard and Earnings page
export function calculateEarnings(sessions: any[], tutorTimezone?: string) {
  console.log('📦 EarningsCalculator: Starting with', sessions.length, 'sessions', tutorTimezone ? `in timezone ${tutorTimezone}` : '');
  
  // Use tutor's timezone if provided, otherwise use local time with Monday-Sunday weeks
  const getTimezoneBoundaries = () => {
    const timezone = tutorTimezone || APP_TIMEZONE;
    const now = new Date();
    
    // Use the new Monday-Sunday aware date range helpers
    const { startUtc: startOfWeek, endUtc: endOfWeek } = weekRange(now, timezone);
    const { startUtc: firstDayOfMonth, endUtc: lastDayOfMonth } = monthRange(now, timezone);
    
    // Calculate today's boundaries in the specified timezone
    const nowInTimezone = dayjs().tz(timezone);
    const startOfToday = nowInTimezone.startOf('day').utc().toDate();
    const endOfToday = nowInTimezone.endOf('day').utc().toDate();
    const thirtyDaysAgo = nowInTimezone.subtract(30, 'day').utc().toDate();
    
    return {
      startOfWeek,
      endOfWeek, 
      firstDayOfMonth,
      lastDayOfMonth,
      startOfToday,
      endOfToday,
      thirtyDaysAgo
    };
  };
  
  // Calculate previous week boundaries for delta comparison using Monday-Sunday weeks
  const getPreviousWeekBoundaries = () => {
    const timezone = tutorTimezone || APP_TIMEZONE;
    
    // Get previous week's date (7 days ago)
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    
    // Use the new Monday-Sunday aware date range helpers for previous week
    const { startUtc: lastWeekStart, endUtc: lastWeekEnd } = weekRange(lastWeekDate, timezone);
    
    return { lastWeekStart, lastWeekEnd };
  };

  const boundaries = getTimezoneBoundaries();
  const previousWeekBoundaries = getPreviousWeekBoundaries();
  
  console.log('📦 EarningsCalculator: Using boundaries', {
    timezone: tutorTimezone || 'local',
    month: `${boundaries.firstDayOfMonth.toISOString()} to ${boundaries.lastDayOfMonth.toISOString()}`,
    week: `${boundaries.startOfWeek.toISOString()} to ${boundaries.endOfWeek.toISOString()}`,
    lastWeek: `${previousWeekBoundaries.lastWeekStart.toISOString()} to ${previousWeekBoundaries.lastWeekEnd.toISOString()}`,
    today: `${boundaries.startOfToday.toISOString()} to ${boundaries.endOfToday.toISOString()}`
  });
  
  console.log('[Debug] tutor timezone:', tutorTimezone);
  console.log('[Debug] startOfMonthUtc:', boundaries.firstDayOfMonth.toISOString());
  console.log('[Debug] endOfMonthUtc:', boundaries.lastDayOfMonth.toISOString());

  let totalEarnings = 0;
  let todayEarnings = 0;
  let thisWeekEarnings = 0;
  let thisMonthEarnings = 0;
  let thisMonthSessions = 0;
  let thisWeekSessions = 0;
  let lastWeekSessions = 0;
  const studentEarningsMap = new Map<string, { total: number; count: number }>();
  const activeStudentsSet = new Set<string>();

  sessions.forEach(session => {
    const sessionDate = new Date(session.session_start);
    const earnings = (session.duration / 60) * session.rate;
    
    // Resilient paid session check - handle both boolean and string values from different query paths
    const isPaid = session.paid === true || session.paid === 'true';
    
    // const inMonth = sessionDate >= boundaries.firstDayOfMonth && sessionDate <= boundaries.lastDayOfMonth;
    // console.log('[Debug] session_start:', session.session_start, 'sessionDate:', sessionDate.toISOString(), 'included:', inMonth, 'paid:', isPaid, 'student:', session.student_name, 'earnings:', earnings);
    
    // Total earnings (only from paid sessions)
    if (isPaid) {
      totalEarnings += earnings;
    }
    
    // Today earnings (only from paid sessions today)
    if (isPaid && sessionDate >= boundaries.startOfToday && sessionDate <= boundaries.endOfToday) {
      todayEarnings += earnings;
    }
    
    // This week earnings (only from paid sessions in current week)
    if (isPaid && sessionDate >= boundaries.startOfWeek && sessionDate <= boundaries.endOfWeek) {
      thisWeekEarnings += earnings;
    }
    
    // This month earnings (only from paid sessions in current month)
    if (isPaid && sessionDate >= boundaries.firstDayOfMonth && sessionDate <= boundaries.lastDayOfMonth) {
      thisMonthEarnings += earnings;
      // console.log('[Debug] Added to month earnings:', earnings, 'total now:', thisMonthEarnings, 'for student:', session.student_name);
    }
    
    // This month sessions count (all sessions in current month regardless of payment)
    if (sessionDate >= boundaries.firstDayOfMonth && sessionDate <= boundaries.lastDayOfMonth) {
      thisMonthSessions++;
    }
    
    // This week sessions count (all sessions in current week regardless of payment)
    if (sessionDate >= boundaries.startOfWeek && sessionDate <= boundaries.endOfWeek) {
      thisWeekSessions++;
    }
    
    // Last week sessions count (all sessions in previous week regardless of payment)
    if (sessionDate >= previousWeekBoundaries.lastWeekStart && sessionDate <= previousWeekBoundaries.lastWeekEnd) {
      lastWeekSessions++;
    }
    
    // Active students (sessions in last 30 days, regardless of payment)
    if (sessionDate >= boundaries.thirtyDaysAgo) {
      activeStudentsSet.add(session.student_name);
    }
    
    // Student earnings (only from paid sessions)
    if (isPaid) {
      const existing = studentEarningsMap.get(session.student_name) || { total: 0, count: 0 };
      studentEarningsMap.set(session.student_name, {
        total: existing.total + earnings,
        count: existing.count + 1
      });
    }
  });

  console.log('📦 EarningsCalculator: Final month earnings:', thisMonthEarnings, 'from', sessions.filter(s => s.paid === true || s.paid === 'true').length, 'paid sessions');

  const studentEarnings = Array.from(studentEarningsMap.entries())
    .map(([name, data]) => ({
      student_name: name,
      total_earnings: data.total,
      session_count: data.count
    }))
    .sort((a, b) => b.total_earnings - a.total_earnings);

  return {
    totalEarnings,
    todayEarnings,
    thisWeekEarnings,
    thisMonthEarnings,
    thisMonthSessions,
    thisWeekSessions,
    lastWeekSessions,
    weeklySessionsDelta: thisWeekSessions - lastWeekSessions,
    activeStudentsCount: activeStudentsSet.size,
    studentEarnings
  };
}