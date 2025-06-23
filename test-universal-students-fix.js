#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUniversalStudentsFix() {
  console.log('🔍 Testing universal Students page fix...\n');

  try {
    // Find all tutors to test
    const { data: allTutors } = await supabase
      .from('tutors')
      .select('id, name')
      .limit(5);

    console.log('Testing Students page queries for all tutors...');

    for (const tutor of allTutors || []) {
      console.log(`\n📊 Testing: ${tutor.name} (${tutor.id.substring(0, 8)}...)`);

      try {
        // Test session count for optimization threshold
        const { count: sessionCount } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('tutor_id', tutor.id);

        console.log(`   Session count: ${sessionCount}`);
        console.log(`   Will use: ${sessionCount > 500 ? 'Optimized' : 'Standard'} query`);

        // Test the standard query (what would be used for small datasets)
        const { data: standardData, error: standardError } = await supabase
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
          .eq('tutor_id', tutor.id)
          .order('session_start', { ascending: false })
          .limit(10);

        if (standardError) {
          console.error(`   ❌ Standard query FAILED: ${standardError.message}`);
          
          // Check if it's related to date field
          if (standardError.message.includes('date') || standardError.message.includes('column')) {
            console.error('   🚨 DATE FIELD ISSUE DETECTED');
          }
        } else {
          console.log(`   ✅ Standard query SUCCESS: ${standardData?.length || 0} sessions`);
          
          // Validate structure
          if (standardData && standardData.length > 0) {
            const sample = standardData[0];
            console.log(`   Structure check: session_start=${!!sample.session_start}, students=${!!sample.students}`);
          }
        }

        // Test optimized query (direct sessions + separate students)
        const { data: optimizedSessions, error: optimizedError } = await supabase
          .from('sessions')
          .select('id, student_id, session_start, session_end, duration, rate, paid, created_at')
          .eq('tutor_id', tutor.id)
          .limit(10);

        if (optimizedError) {
          console.error(`   ❌ Optimized sessions FAILED: ${optimizedError.message}`);
        } else {
          console.log(`   ✅ Optimized sessions SUCCESS: ${optimizedSessions?.length || 0} sessions`);
        }

        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id, name, avatar_url')
          .eq('tutor_id', tutor.id);

        if (studentsError) {
          console.error(`   ❌ Students query FAILED: ${studentsError.message}`);
        } else {
          console.log(`   ✅ Students query SUCCESS: ${students?.length || 0} students`);
        }

      } catch (err) {
        console.error(`   ❌ Exception for ${tutor.name}: ${err.message}`);
      }
    }

    console.log('\n✅ Universal fix validation complete');
    console.log('All tutors should now use the same optimized query logic');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUniversalStudentsFix();