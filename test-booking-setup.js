import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupBookingTest() {
  try {
    console.log('Setting up booking test data...');
    
    // Check if booking_slots table exists, if not create it
    const { data: tableCheck, error: tableError } = await supabase
      .from('booking_slots')
      .select('*')
      .limit(1);
    
    if (tableError && tableError.code === '42P01') {
      console.log('Creating booking_slots table...');
      
      // Create table using RPC or direct SQL
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS booking_slots (
            id SERIAL PRIMARY KEY,
            tutor_id UUID NOT NULL,
            start_time TIMESTAMPTZ NOT NULL,
            end_time TIMESTAMPTZ NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          
          ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;
          
          CREATE POLICY IF NOT EXISTS "Public can view active booking slots" ON booking_slots
          FOR SELECT USING (is_active = true);
          
          ALTER TABLE sessions ADD COLUMN IF NOT EXISTS unassigned_name TEXT;
          
          CREATE POLICY IF NOT EXISTS "Public can create booking requests" ON sessions
          FOR INSERT WITH CHECK (
            student_id IS NULL AND 
            unassigned_name IS NOT NULL
          );
        `
      });
      
      if (createError) {
        console.log('Table creation error:', createError);
      } else {
        console.log('Tables created successfully');
      }
    }
    
    // Get a tutor ID to test with
    const { data: tutors, error: tutorError } = await supabase
      .from('tutors')
      .select('id, full_name')
      .limit(1);
    
    if (tutorError) {
      console.log('Error getting tutors:', tutorError);
      return;
    }
    
    if (!tutors || tutors.length === 0) {
      console.log('No tutors found in database');
      return;
    }
    
    const tutorId = tutors[0].id;
    console.log('Using tutor:', tutors[0].full_name, 'ID:', tutorId);
    
    // Insert test booking slots
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    const testSlots = [
      {
        tutor_id: tutorId,
        start_time: new Date(tomorrow.getTime()).toISOString(),
        end_time: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
        is_active: true
      },
      {
        tutor_id: tutorId,
        start_time: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        is_active: true
      }
    ];
    
    const { data: insertedSlots, error: insertError } = await supabase
      .from('booking_slots')
      .insert(testSlots)
      .select();
    
    if (insertError) {
      console.log('Error inserting test slots:', insertError);
    } else {
      console.log('Test booking slots created:', insertedSlots?.length || 0);
    }
    
    console.log(`Test the booking page at: http://localhost:5000/booking/${tutorId}`);
    
  } catch (error) {
    console.log('Setup error:', error);
  }
}

setupBookingTest();