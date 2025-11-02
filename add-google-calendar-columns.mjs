import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addGoogleCalendarColumns() {
  try {
    console.log('🔄 Adding Google Calendar columns to Supabase...\n');
    
    // Add google_calendar_event_id column to sessions table
    console.log('1️⃣  Adding google_calendar_event_id to sessions table...');
    const { error: sessionsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;'
    });
    
    if (sessionsError) {
      // If exec_sql doesn't exist, provide manual SQL instructions
      if (sessionsError.code === 'PGRST202') {
        console.log('\n📝 Please run these SQL commands manually in your Supabase SQL Editor:\n');
        console.log('-- Add Google Calendar event ID to sessions');
        console.log('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;\n');
        console.log('-- Add Google Calendar sync preference to tutors');
        console.log('ALTER TABLE tutors ADD COLUMN IF NOT EXISTS sync_google_calendar BOOLEAN DEFAULT false;\n');
        console.log('Then visit: https://supabase.com/dashboard/project/_/sql/new\n');
        return false;
      }
      console.error('❌ Error adding google_calendar_event_id column:', sessionsError);
      return false;
    }
    
    console.log('   ✓ google_calendar_event_id column added');
    
    // Add sync_google_calendar column to tutors table
    console.log('2️⃣  Adding sync_google_calendar to tutors table...');
    const { error: tutorsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE tutors ADD COLUMN IF NOT EXISTS sync_google_calendar BOOLEAN DEFAULT false;'
    });
    
    if (tutorsError) {
      console.error('❌ Error adding sync_google_calendar column:', tutorsError);
      return false;
    }
    
    console.log('   ✓ sync_google_calendar column added');
    console.log('\n✅ All Google Calendar columns added successfully!');
    return true;
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return false;
  }
}

addGoogleCalendarColumns()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
