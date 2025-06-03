import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function setupRLSPolicies() {
  console.log('Setting up Row Level Security policies...');

  try {
    // First, let's check the current state and enable RLS
    console.log('Enabling RLS on tables...');
    
    // Enable RLS on tutors table
    const { error: rlsTutors } = await supabase
      .from('tutors')
      .select('id')
      .limit(1);
    
    if (!rlsTutors) {
      console.log('✓ Tutors table accessible');
    }

    // Drop existing policies if they exist and create new ones
    console.log('Creating RLS policies...');

    // Create a comprehensive RLS setup script
    const rlsScript = `
-- Enable RLS on all tables
ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own tutor record" ON tutors;
DROP POLICY IF EXISTS "Users can update own tutor record" ON tutors;
DROP POLICY IF EXISTS "Users can insert own tutor record" ON tutors;

DROP POLICY IF EXISTS "Users can view own students" ON students;
DROP POLICY IF EXISTS "Users can insert own students" ON students;
DROP POLICY IF EXISTS "Users can update own students" ON students;
DROP POLICY IF EXISTS "Users can delete own students" ON students;

DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;
DROP POLICY IF EXISTS "Users can delete own payments" ON payments;

-- Create tutors table policies
CREATE POLICY "Users can view own tutor record" ON tutors
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tutor record" ON tutors
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tutor record" ON tutors
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create students table policies
CREATE POLICY "Users can view own students" ON students
FOR SELECT USING (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own students" ON students
FOR INSERT WITH CHECK (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own students" ON students
FOR UPDATE USING (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own students" ON students
FOR DELETE USING (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

-- Create sessions table policies
CREATE POLICY "Users can view own sessions" ON sessions
FOR SELECT USING (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own sessions" ON sessions
FOR INSERT WITH CHECK (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own sessions" ON sessions
FOR UPDATE USING (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own sessions" ON sessions
FOR DELETE USING (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

-- Create payments table policies
CREATE POLICY "Users can view own payments" ON payments
FOR SELECT USING (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own payments" ON payments
FOR INSERT WITH CHECK (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own payments" ON payments
FOR UPDATE USING (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own payments" ON payments
FOR DELETE USING (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);
`;

    console.log('Executing RLS setup script...');
    console.log('Note: This script will be executed via the Supabase SQL Editor');
    console.log('Please copy the following SQL and run it in your Supabase SQL Editor:');
    console.log('\n' + '='.repeat(80));
    console.log(rlsScript);
    console.log('='.repeat(80) + '\n');

    console.log('After running the SQL script, RLS will be properly configured.');
    console.log('Each user will only see their own data.');

  } catch (error) {
    console.error('Error setting up RLS policies:', error);
  }
}

setupRLSPolicies();