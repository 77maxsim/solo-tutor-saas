#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigration() {
  console.log('🔍 Verifying UTC timestamp migration...\n');

  try {
    // 1. Check Oliver's recent sessions with UTC timestamps
    console.log('1. Checking Oliver\'s recent sessions:');
    
    // First get Oliver's tutor ID
    const { data: tutorData, error: tutorError } = await supabase
      .from('tutors')
      .select('id')
      .eq('email', 'oliver@example.com')
      .single();
    
    if (tutorError || !tutorData) {
      console.log('No tutor found with email oliver@example.com, checking all tutors...');
      const { data: allTutors } = await supabase.from('tutors').select('id, email').limit(5);
      console.log('Available tutors:', allTutors);
      return;
    }
    
    const { data: oliverSessions, error: oliverError } = await supabase
      .from('sessions')
      .select(`
        id,
        student_id,
        session_start,
        session_end,
        duration,
        rate,
        paid,
        created_at,
        students (name)
      `)
      .eq('tutor_id', tutorData.id)
      .order('session_start', { ascending: false })
      .limit(5);

    if (oliverError) {
      console.error('Error fetching Oliver sessions:', oliverError);
    } else {
      console.log(`Found ${oliverSessions?.length || 0} recent sessions:`);
      oliverSessions?.forEach(session => {
        console.log(`  - ${session.students?.name || 'Unknown'}: ${session.session_start} → ${session.session_end} (${session.duration}min, $${session.rate})`);
      });
    }

    // 2. Check for any sessions missing UTC timestamps
    console.log('\n2. Checking for sessions with missing UTC timestamps:');
    const { data: missingSessions, error: missingError } = await supabase
      .from('sessions')
      .select('id, student_id, session_start, session_end, students(name)')
      .or('session_start.is.null,session_end.is.null')
      .limit(10);

    if (missingError) {
      console.error('Error checking missing timestamps:', missingError);
    } else {
      console.log(`Found ${missingSessions?.length || 0} sessions with missing UTC timestamps`);
      if (missingSessions?.length > 0) {
        console.log('⚠️  WARNING: Some sessions still have missing UTC timestamps!');
        missingSessions.forEach(session => {
          console.log(`  - Session ${session.id}: start=${session.session_start}, end=${session.session_end}`);
        });
      } else {
        console.log('✅ All sessions have UTC timestamps');
      }
    }

    // 3. Check unpaid sessions query
    console.log('\n3. Testing unpaid sessions query:');
    const now = new Date().toISOString();
    const { data: unpaidSessions, error: unpaidError } = await supabase
      .from('sessions')
      .select(`
        id,
        student_id,
        session_start,
        session_end,
        duration,
        rate,
        paid,
        students (name)
      `)
      .eq('tutor_id', tutorData.id)
      .eq('paid', false)
      .lt('session_start', now)
      .order('session_start', { ascending: false })
      .limit(5);

    if (unpaidError) {
      console.error('Error fetching unpaid sessions:', unpaidError);
    } else {
      console.log(`Found ${unpaidSessions?.length || 0} unpaid overdue sessions`);
      const totalUnpaid = unpaidSessions?.reduce((sum, session) => {
        return sum + (session.duration / 60) * parseFloat(session.rate);
      }, 0) || 0;
      console.log(`Total unpaid amount: $${totalUnpaid.toFixed(2)}`);
    }

    // 4. Check upcoming sessions
    console.log('\n4. Testing upcoming sessions query:');
    const { data: upcomingSessions, error: upcomingError } = await supabase
      .from('sessions')
      .select(`
        id,
        student_id,
        session_start,
        session_end,
        duration,
        rate,
        students (name)
      `)
      .eq('tutor_id', tutorData.id)
      .gte('session_start', now)
      .order('session_start', { ascending: true })
      .limit(5);

    if (upcomingError) {
      console.error('Error fetching upcoming sessions:', upcomingError);
    } else {
      console.log(`Found ${upcomingSessions?.length || 0} upcoming sessions`);
      upcomingSessions?.forEach(session => {
        console.log(`  - ${session.students?.name || 'Unknown'}: ${new Date(session.session_start).toLocaleDateString()} ${new Date(session.session_start).toLocaleTimeString()}`);
      });
    }

    // 5. Test timezone conversion for a sample session
    console.log('\n5. Testing timezone conversion:');
    if (oliverSessions?.length > 0) {
      const sampleSession = oliverSessions[0];
      const utcStart = new Date(sampleSession.session_start);
      const utcEnd = new Date(sampleSession.session_end);
      
      console.log(`Sample session UTC: ${sampleSession.session_start} → ${sampleSession.session_end}`);
      console.log(`Local display: ${utcStart.toLocaleString()} → ${utcEnd.toLocaleString()}`);
      
      // Test timezone-specific conversion (simulating different tutor timezones)
      const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
      timezones.forEach(tz => {
        try {
          const localStart = utcStart.toLocaleString('en-US', { timeZone: tz });
          console.log(`  ${tz}: ${localStart}`);
        } catch (error) {
          console.log(`  ${tz}: Error converting timezone`);
        }
      });
    }

    console.log('\n✅ Migration verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyMigration();