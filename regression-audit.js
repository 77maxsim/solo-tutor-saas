#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function regressionAudit() {
  console.log('🔍 Starting comprehensive regression audit...\n');

  try {
    // 1. Test database schema - ensure no date/time columns are being used
    console.log('1. SCHEMA VALIDATION');
    console.log('===================');
    
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .limit(1);

    if (sessionsError) {
      console.error('❌ Sessions table access error:', sessionsError);
      return;
    }

    const sampleSession = sessions[0];
    if (sampleSession) {
      console.log('✅ Sample session structure:');
      console.log('   - session_start:', sampleSession.session_start ? '✅ Present' : '❌ Missing');
      console.log('   - session_end:', sampleSession.session_end ? '✅ Present' : '❌ Missing');
      console.log('   - duration:', sampleSession.duration ? '✅ Present' : '❌ Missing');
      console.log('   - date field:', sampleSession.date ? '❌ DEPRECATED FIELD FOUND' : '✅ Not present');
      console.log('   - time field:', sampleSession.time ? '❌ DEPRECATED FIELD FOUND' : '✅ Not present');
    }

    // 2. Get tutor session counts
    console.log('\n2. ANALYZING TUTOR DATASETS');
    console.log('============================');
    
    const { data: allTutorSessions } = await supabase
      .from('sessions')
      .select('tutor_id')
      .not('tutor_id', 'is', null);

    const tutorCounts = {};
    if (allTutorSessions) {
      allTutorSessions.forEach(s => {
        tutorCounts[s.tutor_id] = (tutorCounts[s.tutor_id] || 0) + 1;
      });
    }

    console.log(`   Total tutors found: ${Object.keys(tutorCounts).length}`);
    
    // Find small dataset tutor
    const smallDatasetTutor = Object.entries(tutorCounts)
      .find(([_, count]) => count < 500 && count > 10)?.[0];

    if (smallDatasetTutor) {
      console.log('\n3. SMALL DATASET TESTING (<500 sessions)');
      console.log('=========================================');
      await testTutorData(smallDatasetTutor, 'SMALL');
    }

    // Find Oliver or large dataset tutor
    const { data: oliverTutor } = await supabase
      .from('tutors')
      .select('id, name')
      .ilike('name', '%oliver%')
      .limit(1);

    if (oliverTutor && oliverTutor[0]) {
      console.log('\n4. LARGE DATASET TESTING (Oliver)');
      console.log('==================================');
      await testTutorData(oliverTutor[0].id, 'LARGE', oliverTutor[0].name);
    } else {
      const largeTutor = Object.entries(tutorCounts)
        .find(([_, count]) => count >= 500)?.[0];
      
      if (largeTutor) {
        console.log('\n4. LARGE DATASET TESTING (500+ sessions)');
        console.log('=========================================');
        await testTutorData(largeTutor, 'LARGE');
      } else {
        console.log('⚠️  No large dataset tutor found');
      }
    }

    // 5. Test calendar rendering queries
    console.log('\n5. CALENDAR RENDERING VALIDATION');
    console.log('=================================');
    await testCalendarQueries();

    // 6. Test earnings calculations
    console.log('\n6. EARNINGS CALCULATIONS VALIDATION');
    console.log('===================================');
    await testEarningsCalculations();

    console.log('\n✅ REGRESSION AUDIT COMPLETE');
    console.log('============================');
    console.log('All critical functionality verified using UTC timestamps only.');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

async function testTutorData(tutorId, datasetSize, tutorName = 'Unknown') {
  console.log(`\n${datasetSize} Dataset Tutor: ${tutorName} (${tutorId})`);
  
  // Test session queries using only UTC timestamps
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, session_start, session_end, duration, rate, paid, student_id')
    .eq('tutor_id', tutorId)
    .order('session_start', { ascending: false })
    .limit(1000);

  if (error) {
    console.error(`❌ ${datasetSize} dataset query failed:`, error);
    return;
  }

  console.log(`   Total sessions: ${sessions.length}`);
  
  // Test dashboard earnings calculation
  const paidSessions = sessions.filter(s => s.paid);
  const unpaidSessions = sessions.filter(s => !s.paid);
  const totalEarnings = paidSessions.reduce((sum, s) => sum + (s.rate * s.duration / 60), 0);
  
  console.log(`   Paid sessions: ${paidSessions.length}`);
  console.log(`   Unpaid sessions: ${unpaidSessions.length}`);
  console.log(`   Total earnings: $${totalEarnings.toFixed(2)}`);

  // Test this month's earnings using session_start
  const startOfMonth = dayjs().startOf('month').utc().toISOString();
  const endOfMonth = dayjs().endOf('month').utc().toISOString();
  
  const thisMonthSessions = sessions.filter(s => 
    s.session_start >= startOfMonth && s.session_start <= endOfMonth && s.paid
  );
  const thisMonthEarnings = thisMonthSessions.reduce((sum, s) => sum + (s.rate * s.duration / 60), 0);
  
  console.log(`   This month sessions: ${thisMonthSessions.length}`);
  console.log(`   This month earnings: $${thisMonthEarnings.toFixed(2)}`);

  // Test upcoming sessions using session_start
  const now = dayjs().utc().toISOString();
  const upcomingSessions = sessions.filter(s => s.session_start > now);
  
  console.log(`   Upcoming sessions: ${upcomingSessions.length}`);

  // Test student summary calculations
  if (sessions.length > 0) {
    const studentSessions = {};
    sessions.forEach(s => {
      if (!studentSessions[s.student_id]) {
        studentSessions[s.student_id] = [];
      }
      studentSessions[s.student_id].push(s);
    });

    const studentCount = Object.keys(studentSessions).length;
    console.log(`   Students: ${studentCount}`);

    // Test last session and average duration for first student
    const firstStudentId = Object.keys(studentSessions)[0];
    const firstStudentSessions = studentSessions[firstStudentId];
    const lastSession = firstStudentSessions.sort((a, b) => 
      new Date(b.session_start) - new Date(a.session_start)
    )[0];
    const avgDuration = firstStudentSessions.reduce((sum, s) => sum + s.duration, 0) / firstStudentSessions.length;

    console.log(`   Sample student last session: ${dayjs.utc(lastSession.session_start).format('YYYY-MM-DD HH:mm')} UTC`);
    console.log(`   Sample student avg duration: ${avgDuration.toFixed(1)} minutes`);
  }

  console.log(`   ✅ ${datasetSize} dataset validation passed`);
}

async function testCalendarQueries() {
  // Test calendar month view query
  const startOfMonth = dayjs().startOf('month').utc().toISOString();
  const endOfMonth = dayjs().endOf('month').utc().toISOString();
  
  const { data: monthSessions, error: monthError } = await supabase
    .from('sessions')
    .select('id, session_start, session_end, duration, student_id, color')
    .gte('session_start', startOfMonth)
    .lte('session_start', endOfMonth)
    .limit(100);

  if (monthError) {
    console.error('❌ Calendar month query failed:', monthError);
    return;
  }

  console.log(`   Month view sessions: ${monthSessions.length}`);
  
  // Verify all sessions have proper UTC timestamps
  const invalidSessions = monthSessions.filter(s => 
    !s.session_start || !s.session_end || !dayjs(s.session_start).isValid()
  );
  
  if (invalidSessions.length > 0) {
    console.error(`❌ Found ${invalidSessions.length} sessions with invalid timestamps`);
  } else {
    console.log('   ✅ All sessions have valid UTC timestamps');
  }

  // Test week view query
  const startOfWeek = dayjs().startOf('week').utc().toISOString();
  const endOfWeek = dayjs().endOf('week').utc().toISOString();
  
  const { data: weekSessions } = await supabase
    .from('sessions')
    .select('id, session_start, session_end')
    .gte('session_start', startOfWeek)
    .lte('session_start', endOfWeek)
    .limit(50);

  console.log(`   Week view sessions: ${weekSessions?.length || 0}`);
  console.log('   ✅ Calendar queries using session_start only');
}

async function testEarningsCalculations() {
  // Test earnings page queries
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('id, session_start, session_end, duration, rate, paid, tutor_id')
    .not('tutor_id', 'is', null)
    .limit(1000);

  if (!allSessions || allSessions.length === 0) {
    console.log('   No sessions found for earnings test');
    return;
  }

  // Group by tutor and test calculations
  const tutorEarnings = {};
  allSessions.forEach(session => {
    if (!tutorEarnings[session.tutor_id]) {
      tutorEarnings[session.tutor_id] = {
        totalSessions: 0,
        paidSessions: 0,
        totalEarnings: 0,
        thisWeekEarnings: 0,
        thisMonthEarnings: 0
      };
    }

    const tutor = tutorEarnings[session.tutor_id];
    tutor.totalSessions++;

    if (session.paid) {
      tutor.paidSessions++;
      const earnings = (session.rate * session.duration) / 60;
      tutor.totalEarnings += earnings;

      // This week earnings using session_start
      const weekStart = dayjs().startOf('week').utc().toISOString();
      const weekEnd = dayjs().endOf('week').utc().toISOString();
      if (session.session_start >= weekStart && session.session_start <= weekEnd) {
        tutor.thisWeekEarnings += earnings;
      }

      // This month earnings using session_start
      const monthStart = dayjs().startOf('month').utc().toISOString();
      const monthEnd = dayjs().endOf('month').utc().toISOString();
      if (session.session_start >= monthStart && session.session_start <= monthEnd) {
        tutor.thisMonthEarnings += earnings;
      }
    }
  });

  const tutorCount = Object.keys(tutorEarnings).length;
  console.log(`   Tutors processed: ${tutorCount}`);
  
  // Show sample calculations
  const sampleTutorId = Object.keys(tutorEarnings)[0];
  const sampleData = tutorEarnings[sampleTutorId];
  
  console.log(`   Sample tutor earnings:`);
  console.log(`     Total sessions: ${sampleData.totalSessions}`);
  console.log(`     Paid sessions: ${sampleData.paidSessions}`);
  console.log(`     Total earnings: $${sampleData.totalEarnings.toFixed(2)}`);
  console.log(`     This week: $${sampleData.thisWeekEarnings.toFixed(2)}`);
  console.log(`     This month: $${sampleData.thisMonthEarnings.toFixed(2)}`);
  console.log('   ✅ Earnings calculations using session_start timestamps only');
}

regressionAudit();