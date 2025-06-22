// Import dayjs for timezone handling
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

// Shared earnings calculation logic for Dashboard and Earnings page
export function calculateEarnings(sessions: any[], tutorTimezone?: string) {
  console.log('📦 EarningsCalculator: Starting with', sessions.length, 'sessions', tutorTimezone ? `in timezone ${tutorTimezone}` : '');
  
  // Use tutor's timezone if provided, otherwise use local time
  const getTimezoneBoundaries = () => {
    if (!tutorTimezone) {
      // Fallback to local time (for backwards compatibility)
      const now = new Date();
      return {
        startOfWeek: (() => {
          const date = new Date(now);
          date.setDate(now.getDate() - now.getDay());
          date.setHours(0, 0, 0, 0);
          return date;
        })(),
        endOfWeek: (() => {
          const date = new Date(now);
          date.setDate(now.getDate() - now.getDay() + 6);
          date.setHours(23, 59, 59, 999);
          return date;
        })(),
        firstDayOfMonth: new Date(now.getFullYear(), now.getMonth(), 1),
        lastDayOfMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        startOfToday: (() => {
          const date = new Date(now);
          date.setHours(0, 0, 0, 0);
          return date;
        })(),
        endOfToday: (() => {
          const date = new Date(now);
          date.setHours(23, 59, 59, 999);
          return date;
        })(),
        thirtyDaysAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      };
    }
    
    // Use timezone-aware boundaries - convert to UTC for comparison with UTC session_start
    const nowInTimezone = dayjs().tz(tutorTimezone);
    
    return {
      startOfWeek: nowInTimezone.startOf('week').utc().toDate(),
      endOfWeek: nowInTimezone.endOf('week').utc().toDate(), 
      firstDayOfMonth: nowInTimezone.startOf('month').utc().toDate(),
      lastDayOfMonth: nowInTimezone.endOf('month').utc().toDate(),
      startOfToday: nowInTimezone.startOf('day').utc().toDate(),
      endOfToday: nowInTimezone.endOf('day').utc().toDate(),
      thirtyDaysAgo: nowInTimezone.subtract(30, 'day').utc().toDate()
    };
  };
  
  const boundaries = getTimezoneBoundaries();
  console.log('📦 EarningsCalculator: Using boundaries', {
    timezone: tutorTimezone || 'local',
    month: `${boundaries.firstDayOfMonth.toISOString()} to ${boundaries.lastDayOfMonth.toISOString()}`,
    week: `${boundaries.startOfWeek.toISOString()} to ${boundaries.endOfWeek.toISOString()}`,
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
  const studentEarningsMap = new Map<string, { total: number; count: number }>();
  const activeStudentsSet = new Set<string>();

  sessions.forEach(session => {
    const sessionDate = new Date(session.session_start);
    const earnings = (session.duration / 60) * session.rate;
    
    // Resilient paid session check - handle both boolean and string values
    const isPaid = session.paid === true || session.paid === 'true';
    
    // Debug earnings calculation logic for Oliver's sessions
    if (session.student_name && ['LittleSix', 'Eric', 'CoCo', 'Max New', 'Zoey', 'Vince', 'Victor', 'Ron'].includes(session.student_name)) {
      const sessionInTimezone = tutorTimezone ? dayjs.utc(session.session_start).tz(tutorTimezone) : dayjs(session.session_start);
      const nowInTimezone = tutorTimezone ? dayjs().tz(tutorTimezone) : dayjs();
      const isSameMonth = sessionInTimezone.isSame(nowInTimezone, 'month');
      
      console.log('[EARNINGS DEBUG]', {
        student: session.student_name,
        session_start: session.session_start,
        paid: session.paid,
        isPaid,
        tutorTimezone,
        sessionInTz: sessionInTimezone.format('YYYY-MM-DD HH:mm:ss'),
        nowInTz: nowInTimezone.format('YYYY-MM-DD HH:mm:ss'),
        isSameMonth,
        included: isPaid && isSameMonth
      });
    }
    
    // const inMonth = sessionDate >= boundaries.firstDayOfMonth && sessionDate <= boundaries.lastDayOfMonth;
    // console.log('[Debug] session_start:', session.session_start, 'sessionDate:', sessionDate.toISOString(), 'included:', inMonth, 'paid:', isPaid, 'student:', session.student_name, 'earnings:', earnings);
    
    // Total earnings (only from paid sessions)
    if (isPaid) {
      totalEarnings += earnings;
    }
    
    // Today earnings - use proper timezone-aware comparison
    const isSameDay = sessionInTimezone.isSame(nowInTimezone, 'day');
    if (isPaid && isSameDay) {
      todayEarnings += earnings;
    }
    
    // This week earnings - use proper timezone-aware comparison
    const isSameWeek = sessionInTimezone.isSame(nowInTimezone, 'week');
    if (isPaid && isSameWeek) {
      thisWeekEarnings += earnings;
    }
    
    // This month earnings - use proper timezone-aware comparison
    const sessionInTimezone = tutorTimezone ? dayjs.utc(session.session_start).tz(tutorTimezone) : dayjs(session.session_start);
    const nowInTimezone = tutorTimezone ? dayjs().tz(tutorTimezone) : dayjs();
    const isSameMonth = sessionInTimezone.isSame(nowInTimezone, 'month');
    
    if (isPaid && isSameMonth) {
      thisMonthEarnings += earnings;
      console.log('[MONTH EARNINGS]', earnings, 'added for', session.student_name, 'total now:', thisMonthEarnings);
    }
    
    // This month sessions count (all sessions in current month regardless of payment)
    if (isSameMonth) {
      thisMonthSessions++;
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

  console.log('📦 EarningsCalculator: Final month earnings:', thisMonthEarnings, 'from', sessions.filter(s => s.paid === true).length, 'paid sessions');

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
    activeStudentsCount: activeStudentsSet.size,
    studentEarnings
  };
}