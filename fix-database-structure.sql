-- Add user_id column to tutors table to link with auth.users
ALTER TABLE tutors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Update existing tutor records to link them with their auth users
-- This will match tutors by email with auth users
UPDATE tutors 
SET user_id = auth.users.id 
FROM auth.users 
WHERE tutors.email = auth.users.email;

-- Update existing students and sessions to have proper tutor_id values
-- Find the tutor_id for students that don't have one set
UPDATE students 
SET tutor_id = (
  SELECT t.id 
  FROM tutors t 
  WHERE t.user_id IS NOT NULL 
  LIMIT 1
) 
WHERE tutor_id IS NULL;

-- Find the tutor_id for sessions that don't have one set
UPDATE sessions 
SET tutor_id = (
  SELECT t.id 
  FROM tutors t 
  WHERE t.user_id IS NOT NULL 
  LIMIT 1
) 
WHERE tutor_id IS NULL;

-- Enable RLS on all tables
ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

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