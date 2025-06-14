import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugOliverDatabaseState() {
  const oliverTutorId = '0805984a-febf-423b-bef1-ba8dbd25760b';
  
  console.log('🔍 INVESTIGATING OLIVER DATABASE STATE');
  console.log('=====================================');
  
  // 1. Compare different query approaches for June 2025 paid sessions
  console.log('\n1. COMPARING QUERY APPROACHES:');
  
  // Simple query (works correctly)
  const { data: simpleQuery } = await supabase
    .from('sessions')
    .select('id, date, paid, student_id, rate, duration')
    .eq('tutor_id', oliverTutorId)
    .eq('paid', true)
    .gte('date', '2025-06-01')
    .lte('date', '2025-06-30');
    
  console.log('Simple query results:', simpleQuery?.length || 0);
  console.log('Simple query sample IDs:', simpleQuery?.slice(0, 3).map(s => s.id));
  
  // Join query (returns different results)
  const { data: joinQuery } = await supabase
    .from('sessions')
    .select(`
      id, date, paid, student_id, rate, duration,
      students (name)
    `)
    .eq('tutor_id', oliverTutorId)
    .eq('paid', true)
    .gte('date', '2025-06-01')
    .lte('date', '2025-06-30');
    
  console.log('Join query results:', joinQuery?.length || 0);
  console.log('Join query sample IDs:', joinQuery?.slice(0, 3).map(s => s.id));
  
  // Full sessions query (returns 1000 records)
  const { data: fullQuery } = await supabase
    .from('sessions')
    .select('id, date, paid, student_id')
    .eq('tutor_id', oliverTutorId)
    .limit(5);
    
  console.log('Full sessions query (first 5):', fullQuery?.length || 0);
  console.log('Full query sample IDs:', fullQuery?.map(s => s.id));
  console.log('Full query paid status:', fullQuery?.map(s => s.paid));
  
  // 2. Check for data inconsistencies
  console.log('\n2. CHECKING DATA CONSISTENCY:');
  
  // Check if IDs overlap between simple and join queries
  const simpleIds = new Set(simpleQuery?.map(s => s.id) || []);
  const joinIds = new Set(joinQuery?.map(s => s.id) || []);
  
  const commonIds = [...simpleIds].filter(id => joinIds.has(id));
  console.log('Overlapping IDs between queries:', commonIds.length);
  
  if (commonIds.length === 0) {
    console.log('❌ NO OVERLAPPING IDS - This is the root cause!');
    console.log('Simple query IDs:', Array.from(simpleIds).slice(0, 3));
    console.log('Join query IDs:', Array.from(joinIds).slice(0, 3));
  }
  
  // 3. Check student relationships
  console.log('\n3. CHECKING STUDENT RELATIONSHIPS:');
  
  const { data: students } = await supabase
    .from('students')
    .select('id, name')
    .eq('tutor_id', oliverTutorId)
    .limit(5);
    
  console.log('Students found:', students?.length || 0);
  
  // 4. Check for RLS policy differences
  console.log('\n4. CHECKING RLS BEHAVIOR:');
  
  // Query without any filters to see total count
  const { data: totalSessions, count } = await supabase
    .from('sessions')
    .select('id', { count: 'exact' })
    .eq('tutor_id', oliverTutorId);
    
  console.log('Total sessions for Oliver:', count);
  
  console.log('\n🔍 INVESTIGATION COMPLETE');
}

debugOliverDatabaseState().catch(console.error);