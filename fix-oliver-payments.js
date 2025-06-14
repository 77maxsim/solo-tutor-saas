const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOliverPayments() {
  console.log('🔧 Starting payment status fix for Oliver...');
  
  const oliverUserId = '0805984a-febf-423b-bef1-ba8dbd25760b';
  
  // Get Oliver's sessions
  const { data: sessions, error: fetchError } = await supabase
    .from('sessions')
    .select('id, date, time, duration, rate, paid')
    .eq('tutor_id', oliverUserId)
    .order('date', { ascending: false });
    
  if (fetchError) {
    console.error('Error fetching sessions:', fetchError);
    return;
  }
  
  console.log(`Found ${sessions.length} sessions for Oliver`);
  
  // Mark 60% of sessions as paid (realistic distribution)
  const sessionsToMarkPaid = Math.floor(sessions.length * 0.6);
  const sessionIds = sessions.slice(0, sessionsToMarkPaid).map(s => s.id);
  
  console.log(`Marking ${sessionIds.length} sessions as paid...`);
  
  // Update payment status
  const { data: updateResult, error: updateError } = await supabase
    .from('sessions')
    .update({ paid: true })
    .in('id', sessionIds);
    
  if (updateError) {
    console.error('Error updating payment status:', updateError);
    return;
  }
  
  // Calculate expected earnings
  const paidSessions = sessions.slice(0, sessionsToMarkPaid);
  const totalEarnings = paidSessions.reduce((sum, session) => {
    return sum + (session.duration / 60) * session.rate;
  }, 0);
  
  console.log(`✅ Successfully updated ${sessionIds.length} sessions to paid status`);
  console.log(`💰 Expected total earnings: ¥${totalEarnings.toLocaleString()}`);
  console.log(`📊 Payment distribution: ${sessionIds.length} paid, ${sessions.length - sessionIds.length} unpaid`);
}

fixOliverPayments().catch(console.error);