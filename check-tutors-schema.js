import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTutorsSchema() {
  console.log('Checking tutors table schema...\n');

  try {
    // Check tutors table structure
    const { data: tutors, error } = await supabase
      .from('tutors')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error accessing tutors table:', error);
    } else {
      console.log('Sample tutor record:', tutors[0] || 'No records found');
      if (tutors[0]) {
        console.log('Tutors table columns:', Object.keys(tutors[0]));
      }
    }

  } catch (error) {
    console.error('Error checking tutors schema:', error);
  }
}

checkTutorsSchema();