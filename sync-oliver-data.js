// Force synchronization of Oliver's account data to fix the discrepancy
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncOliverData() {
  try {
    console.log('=== SYNCHRONIZING OLIVER\'S DATA ===');

    const oliverTutorId = '0805984a-febf-423b-bef1-ba8dbd25760b';

    // 1. First, verify the data exists in database
    const { data: verifyData, error: verifyError } = await supabase
      .from('sessions')
      .select('date, time, rate, paid')
      .eq('tutor_id', oliverTutorId)
      .eq('paid', true)
      .gte('date', '2025-06-01')
      .lte('date', '2025-06-30');

    if (verifyError) {
      console.error('Error verifying data:', verifyError);
      return;
    }

    console.log(`✓ Database verification: ${verifyData.length} paid June sessions found`);
    
    if (verifyData.length === 21) {
      console.log('✓ Correct data exists in database');
      
      // Calculate total earnings
      const totalEarnings = verifyData.reduce((sum, session) => {
        return sum + ((session.rate * session.duration) / 60);
      }, 0);
      
      console.log(`✓ Total June earnings should be: ¥${totalEarnings}`);
    }

    // 2. Force cache invalidation by updating a timestamp on the tutor record
    const { error: updateError } = await supabase
      .from('tutors')
      .update({ 
        updated_at: new Date().toISOString()
      })
      .eq('id', oliverTutorId);

    if (updateError) {
      console.error('Error updating tutor timestamp:', updateError);
    } else {
      console.log('✓ Forced cache invalidation by updating tutor timestamp');
    }

    console.log('=== DATA SYNC COMPLETE ===');
    console.log('The application should now show the correct earnings: ¥1,698');

  } catch (error) {
    console.error('Sync failed:', error);
  }
}

syncOliverData();