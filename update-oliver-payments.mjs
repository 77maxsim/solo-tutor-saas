import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateOliverPayments() {
  try {
    console.log('🔍 Updating Oliver\'s payment status...');
    
    // Get Oliver's tutor ID
    const { data: tutorData, error: tutorError } = await supabase
      .from('tutors')
      .select('id')
      .eq('email', 'oliverzhou1006@gmail.com')
      .single();
    
    if (tutorError || !tutorData) {
      console.error('Error finding Oliver:', tutorError);
      return;
    }
    
    const oliverTutorId = tutorData.id;
    console.log('✅ Found Oliver tutor ID:', oliverTutorId);
    
    // Update June sessions to paid (matching Activity page data)
    const { data: updated, error: updateError } = await supabase
      .from('sessions')
      .update({ paid: true })
      .eq('tutor_id', oliverTutorId)
      .gte('session_start', '2025-06-01T00:00:00Z')
      .lt('session_start', '2025-07-01T00:00:00Z')
      .select('id, session_start, duration, rate, students(name)');
    
    if (updateError) {
      console.error('Update error:', updateError);
      return;
    }
    
    console.log(`✅ Updated ${updated?.length || 0} sessions to paid`);
    
    // Calculate new total
    const totalEarnings = updated?.reduce((sum, session) => 
      sum + (session.duration / 60) * session.rate, 0
    ) || 0;
    
    console.log(`💰 New total earnings: ¥${totalEarnings}`);
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

updateOliverPayments();