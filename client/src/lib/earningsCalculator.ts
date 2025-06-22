// Shared earnings calculation logic for Dashboard and Earnings page
export function calculateEarnings(sessions: any[]) {
  const now = new Date();
  
  // Current week boundaries (Sunday to Saturday)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  // Current month boundaries
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  // Today boundaries
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  
  // 30 days ago for active students
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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
    // Standardized paid session check (consistent with other components)
    const isPaid = session.paid === true;
    
    // Total earnings (only from paid sessions)
    if (isPaid) {
      totalEarnings += earnings;
    }
    
    // Today earnings (only from paid sessions today)
    if (isPaid && sessionDate >= startOfToday && sessionDate <= endOfToday) {
      todayEarnings += earnings;
    }
    
    // This week earnings (only from paid sessions in current week)
    if (isPaid && sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
      thisWeekEarnings += earnings;
    }
    
    // This month earnings (only from paid sessions in current month)
    if (isPaid && sessionDate >= firstDayOfMonth && sessionDate <= lastDayOfMonth) {
      thisMonthEarnings += earnings;
    }
    
    // This month sessions count (all sessions in current month regardless of payment)
    if (sessionDate >= firstDayOfMonth && sessionDate <= lastDayOfMonth) {
      thisMonthSessions++;
    }
    
    // Active students (sessions in last 30 days, regardless of payment)
    if (sessionDate >= thirtyDaysAgo) {
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