// Test script to update a session as paid and verify earnings calculation
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testEarningsUpdate() {
  try {
    console.log('Testing earnings calculation by marking a session as paid...');

    // Use Oliver's tutor ID from earlier debugging
    const tutorId = '0805984a-febf-423b-bef1-ba8dbd25760b';
    console.log('Using Oliver tutor ID:', tutorId);

    // Get a recent session to mark as paid
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, date, time, duration, rate, paid, student_id')
      .eq('tutor_id', tutorId)
      .eq('paid', false)
      .order('date', { ascending: false })
      .limit(1);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('No unpaid sessions found for Oliver');
      return;
    }

    const sessionToUpdate = sessions[0];
    console.log('Session to mark as paid:', sessionToUpdate);

    // Update the session to be paid
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ paid: true })
      .eq('id', sessionToUpdate.id);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return;
    }

    console.log('✓ Successfully marked session as paid');
    console.log('Expected earnings increase:', (sessionToUpdate.duration / 60) * sessionToUpdate.rate, 'JPY');

    // Wait a moment for the update to propagate
    setTimeout(() => {
      console.log('✓ Session update complete - check dashboard for earnings update');
    }, 1000);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testEarningsUpdate();