-- Enable RLS on existing tables only
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