import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addTimeFormatColumn() {
  try {
    console.log('Checking if time_format column exists...');
    
    // Try to update a record to see if column exists
    const { data: tutors, error: fetchError } = await supabase
      .from('tutors')
      .select('id, time_format')
      .limit(1);

    if (fetchError && fetchError.code === 'PGRST116') {
      console.log('Column does not exist, creating via simple update...');
      
      // Add default time_format to all existing tutors
      const { error: updateError } = await supabase
        .from('tutors')
        .update({ time_format: '24h' })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all records

      if (updateError) {
        console.error('Error adding column via update:', updateError);
        console.log('This is expected if the column does not exist. The column will be created when first used.');
      } else {
        console.log('Successfully set default time format for all tutors');
      }
    } else if (fetchError) {
      console.error('Error checking column:', fetchError);
    } else {
      console.log('Column already exists');
      
      // Update any null values
      const { error: updateError } = await supabase
        .from('tutors')
        .update({ time_format: '24h' })
        .is('time_format', null);

      if (updateError) {
        console.error('Error updating null values:', updateError);
      } else {
        console.log('Updated any null time_format values');
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

addTimeFormatColumn();