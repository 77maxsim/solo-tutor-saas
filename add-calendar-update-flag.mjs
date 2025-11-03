import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addCalendarUpdateFlag() {
  try {
    console.log('🔄 Adding needs_calendar_update column to sessions table...\n');
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS needs_calendar_update BOOLEAN DEFAULT false;'
    });
    
    if (error) {
      if (error.code === 'PGRST202') {
        console.log('\n📝 Please run this SQL command manually in your Supabase SQL Editor:\n');
        console.log('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS needs_calendar_update BOOLEAN DEFAULT false;\n');
        console.log('Then visit: https://supabase.com/dashboard/project/_/sql/new\n');
        return false;
      }
      console.error('❌ Error adding needs_calendar_update column:', error);
      return false;
    }
    
    console.log('   ✓ needs_calendar_update column added to sessions table');
    console.log('\n✅ Migration completed successfully!');
    return true;
  } catch (err) {
    console.error('❌ Failed to add needs_calendar_update column:', err.message);
    return false;
  }
}

addCalendarUpdateFlag()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
