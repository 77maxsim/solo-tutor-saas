import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure() {
  console.log('Checking table structure...\n');

  try {
    // Check tutors table structure
    console.log('=== TUTORS TABLE ===');
    const { data: tutors, error: tutorsError } = await supabase
      .from('tutors')
      .select('*')
      .limit(1);
    
    if (tutorsError) {
      console.error('Error accessing tutors table:', tutorsError);
    } else {
      console.log('Sample tutor record:', tutors[0] || 'No records found');
      if (tutors[0]) {
        console.log('Tutors table columns:', Object.keys(tutors[0]));
      }
    }

    // Check students table structure
    console.log('\n=== STUDENTS TABLE ===');
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .limit(1);
    
    if (studentsError) {
      console.error('Error accessing students table:', studentsError);
    } else {
      console.log('Sample student record:', students[0] || 'No records found');
      if (students[0]) {
        console.log('Students table columns:', Object.keys(students[0]));
      }
    }

    // Check sessions table structure
    console.log('\n=== SESSIONS TABLE ===');
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .limit(1);
    
    if (sessionsError) {
      console.error('Error accessing sessions table:', sessionsError);
    } else {
      console.log('Sample session record:', sessions[0] || 'No records found');
      if (sessions[0]) {
        console.log('Sessions table columns:', Object.keys(sessions[0]));
      }
    }

  } catch (error) {
    console.error('Error checking table structure:', error);
  }
}

checkTableStructure();