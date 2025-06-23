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

async function testOliverDatabase() {
  console.log('🔍 Testing Oliver database state...\n');

  try {
    // Find Oliver
    const { data: oliverTutor, error: oliverError } = await supabase
      .from('tutors')
      .select('id, name, timezone')
      .ilike('name', '%oliver%')
      .limit(1);

    if (oliverError || !oliverTutor?.[0]) {
      console.log('❌ Oliver not found in database');
      return;
    }

    const oliver = oliverTutor[0];
    console.log(`✅ Found Oliver: ${oliver.name} (${oliver.id})`);
    console.log(`   Timezone: ${oliver.timezone || 'Not set'}`);

    // Test Oliver's sessions using UTC timestamps
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, session_start, session_end, duration, rate, paid, student_id, notes')
      .eq('tutor_id', oliver.id)
      .order('session_start', { ascending: false })
      .limit(1000);

    if (sessionsError) {
      console.error('❌ Error fetching Oliver sessions:', sessionsError);
      return;
    }

    console.log(`\n📊 OLIVER SESSION ANALYSIS`);
    console.log(`   Total sessions: ${sessions.length}`);

    // Validate UTC timestamp structure
    const validSessions = sessions.filter(s => s.session_start && s.session_end);
    const invalidSessions = sessions.filter(s => !s.session_start || !s.session_end);
    
    console.log(`   Valid UTC sessions: ${validSessions.length}`);
    console.log(`   Invalid sessions: ${invalidSessions.length}`);

    if (invalidSessions.length > 0) {
      console.log('⚠️  Sessions with missing UTC timestamps:');
      invalidSessions.slice(0, 3).forEach(s => {
        console.log(`     ID: ${s.id}, Start: ${s.session_start}, End: ${s.session_end}`);
      });
    }

    // Test earnings calculations
    const paidSessions = validSessions.filter(s => s.paid);
    const unpaidSessions = validSessions.filter(s => !s.paid);
    const totalEarnings = paidSessions.reduce((sum, s) => sum + (s.rate * s.duration / 60), 0);
    
    console.log(`\n💰 EARNINGS ANALYSIS`);
    console.log(`   Paid sessions: ${paidSessions.length}`);
    console.log(`   Unpaid sessions: ${unpaidSessions.length}`);
    console.log(`   Total earnings: $${totalEarnings.toFixed(2)}`);

    // Test this month earnings using session_start
    const thisMonth = dayjs().format('YYYY-MM');
    const thisMonthSessions = paidSessions.filter(s => 
      dayjs.utc(s.session_start).format('YYYY-MM') === thisMonth
    );
    const thisMonthEarnings = thisMonthSessions.reduce((sum, s) => sum + (s.rate * s.duration / 60), 0);
    
    console.log(`   This month (${thisMonth}) sessions: ${thisMonthSessions.length}`);
    console.log(`   This month earnings: $${thisMonthEarnings.toFixed(2)}`);

    // Test upcoming sessions
    const now = dayjs().utc().toISOString();
    const upcomingSessions = validSessions.filter(s => s.session_start > now);
    console.log(`   Upcoming sessions: ${upcomingSessions.length}`);

    // Test recent session timestamps
    console.log(`\n🕐 RECENT SESSION TIMESTAMPS`);
    validSessions.slice(0, 5).forEach((session, index) => {
      const localTime = oliver.timezone ? 
        dayjs.utc(session.session_start).tz(oliver.timezone).format('YYYY-MM-DD HH:mm') :
        dayjs.utc(session.session_start).format('YYYY-MM-DD HH:mm');
      
      console.log(`   ${index + 1}. ${session.session_start} (UTC) → ${localTime} (local)`);
    });

    // Test student summaries
    const studentSessions = {};
    validSessions.forEach(s => {
      if (!studentSessions[s.student_id]) {
        studentSessions[s.student_id] = [];
      }
      studentSessions[s.student_id].push(s);
    });

    console.log(`\n👥 STUDENT ANALYSIS`);
    console.log(`   Students: ${Object.keys(studentSessions).length}`);
    
    // Show sample student data
    const firstStudentId = Object.keys(studentSessions)[0];
    if (firstStudentId) {
      const studentData = studentSessions[firstStudentId];
      const lastSession = studentData.sort((a, b) => 
        new Date(b.session_start) - new Date(a.session_start)
      )[0];
      const avgDuration = studentData.reduce((sum, s) => sum + s.duration, 0) / studentData.length;
      
      console.log(`   Sample student sessions: ${studentData.length}`);
      console.log(`   Last session: ${dayjs.utc(lastSession.session_start).format('YYYY-MM-DD HH:mm')} UTC`);
      console.log(`   Average duration: ${avgDuration.toFixed(1)} minutes`);
    }

    console.log('\n✅ Oliver database test complete');
    console.log('All calculations use session_start/session_end UTC timestamps only');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testOliverDatabase();