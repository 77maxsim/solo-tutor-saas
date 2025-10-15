import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addNotificationTrackingColumn() {
  try {
    console.log('📊 Adding last_daily_notification_date column to tutors table...');

    const sql = readFileSync('./add-notification-tracking-column.sql', 'utf8');
    
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Error adding column:', error);
      console.log('Please manually execute the SQL in add-notification-tracking-column.sql in your Supabase SQL editor');
      return false;
    }
    
    console.log('✅ last_daily_notification_date column added successfully to tutors table');
    return true;
  } catch (err) {
    console.error('❌ Failed to add column:', err.message);
    console.log('Please manually execute the SQL in add-notification-tracking-column.sql in your Supabase SQL editor');
    return false;
  }
}

addNotificationTrackingColumn();
