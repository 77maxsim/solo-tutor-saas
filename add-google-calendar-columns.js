import { supabase } from './client/src/lib/supabaseClient.js';

async function addGoogleCalendarColumns() {
  try {
    console.log('Adding Google Calendar columns...');
    
    // Add google_calendar_event_id column to sessions table
    console.log('Adding google_calendar_event_id to sessions table...');
    const { error: sessionsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE sessions ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;'
    });
    
    if (sessionsError) {
      console.error('Error adding google_calendar_event_id column:', sessionsError);
      return false;
    }
    
    console.log('✓ google_calendar_event_id column added to sessions table');
    
    // Add sync_google_calendar column to tutors table
    console.log('Adding sync_google_calendar to tutors table...');
    const { error: tutorsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE tutors ADD COLUMN IF NOT EXISTS sync_google_calendar BOOLEAN DEFAULT false;'
    });
    
    if (tutorsError) {
      console.error('Error adding sync_google_calendar column:', tutorsError);
      return false;
    }
    
    console.log('✓ sync_google_calendar column added to tutors table');
    console.log('\n✅ All Google Calendar columns added successfully!');
    return true;
  } catch (err) {
    console.error('Failed to add Google Calendar columns:', err.message);
    return false;
  }
}

addGoogleCalendarColumns()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
