// Check if there are multiple Oliver accounts causing the discrepancy
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMultipleOlivers() {
  try {
    console.log('=== CHECKING FOR MULTIPLE OLIVER ACCOUNTS ===');

    // 1. Find all tutors with Oliver-related emails
    const { data: allTutors, error: tutorsError } = await supabase
      .from('tutors')
      .select('id, email')
      .or('email.ilike.%oleg%,email.ilike.%oliver%');

    if (tutorsError) {
      console.error('Error finding tutors:', tutorsError);
      return;
    }

    console.log('All Oliver-related tutors:', allTutors);

    // 2. Check sessions for each tutor to find who has the 21 paid June sessions
    for (const tutor of allTutors || []) {
      console.log(`\n--- CHECKING TUTOR: ${tutor.email || tutor.name} (ID: ${tutor.id}) ---`);

      // Count total sessions
      const { count: totalSessions } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', tutor.id);

      console.log(`Total sessions: ${totalSessions}`);

      // Count paid sessions in June
      const { count: junePaidCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', tutor.id)
        .eq('paid', true)
        .gte('date', '2025-06-01')
        .lte('date', '2025-06-30');

      console.log(`June paid sessions: ${junePaidCount}`);

      // Count June 12-14 paid sessions specifically
      const { count: june12to14Count } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', tutor.id)
        .eq('paid', true)
        .gte('date', '2025-06-12')
        .lte('date', '2025-06-14');

      console.log(`June 12-14 paid sessions: ${june12to14Count}`);

      if (junePaidCount && junePaidCount > 10) {
        console.log('*** THIS IS THE CORRECT OLIVER ACCOUNT ***');
        
        // Get sample paid sessions
        const { data: sampleSessions } = await supabase
          .from('sessions')
          .select('date, time, duration, rate, paid')
          .eq('tutor_id', tutor.id)
          .eq('paid', true)
          .gte('date', '2025-06-12')
          .lte('date', '2025-06-14')
          .limit(5);

        console.log('Sample paid sessions:', sampleSessions);
      }
    }

  } catch (error) {
    console.error('Check failed:', error);
  }
}

checkMultipleOlivers();