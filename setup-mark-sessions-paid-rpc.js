import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupMarkSessionsPaidRPC() {
  try {
    console.log('🔧 Setting up mark_sessions_paid RPC function...');

    // Read SQL file content
    const sqlContent = readFileSync('./create-mark-sessions-paid-rpc.sql', 'utf8');

    // Execute the SQL to create the RPC function
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      // Try alternative approach - direct SQL execution via admin API
      console.log('Attempting to create RPC function directly...');
      
      const { data: functionData, error: functionError } = await supabase
        .from('_supabase_admin')
        .insert({ sql: sqlContent });

      if (functionError) {
        console.error('❌ Error creating RPC function:', functionError);
        console.log('Please manually execute the SQL in create-mark-sessions-paid-rpc.sql in your Supabase SQL editor');
        return;
      }
    }

    console.log('✅ mark_sessions_paid RPC function created successfully');

    // Test the function with empty array
    console.log('🧪 Testing RPC function...');
    const { data: testData, error: testError } = await supabase
      .rpc('mark_sessions_paid', { session_ids: [] });

    if (testError) {
      console.error('❌ RPC function test failed:', testError);
    } else {
      console.log('✅ RPC function test passed');
    }

  } catch (error) {
    console.error('❌ Error setting up RPC function:', error);
    console.log('Please manually execute the SQL in create-mark-sessions-paid-rpc.sql in your Supabase SQL editor');
  }
}

setupMarkSessionsPaidRPC();