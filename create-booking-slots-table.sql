-- Create booking_slots table for public booking functionality
CREATE TABLE IF NOT EXISTS booking_slots (
  id SERIAL PRIMARY KEY,
  tutor_id UUID NOT NULL REFERENCES tutors(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies for booking_slots
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;

-- Policy for tutors to manage their own booking slots
CREATE POLICY "Tutors can manage own booking slots" ON booking_slots
FOR ALL USING (
  tutor_id IN (
    SELECT id FROM tutors WHERE user_id = auth.uid()
  )
);

-- Policy for public read access to active booking slots
CREATE POLICY "Public can view active booking slots" ON booking_slots
FOR SELECT USING (is_active = true);

-- Add column to sessions table for unassigned bookings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS unassigned_name TEXT;

-- Policy for public to insert unassigned sessions (booking requests)
CREATE POLICY "Public can create booking requests" ON sessions
FOR INSERT WITH CHECK (
  student_id IS NULL AND 
  unassigned_name IS NOT NULL
);

-- Insert some sample booking slots for testing
-- Replace 'your-tutor-id' with an actual tutor ID from your database
INSERT INTO booking_slots (tutor_id, start_time, end_time, is_active) VALUES
  ('7bf25f7b-f16e-4d75-9847-087276da4e0b', '2025-06-15 10:00:00+00', '2025-06-15 11:00:00+00', true),
  ('7bf25f7b-f16e-4d75-9847-087276da4e0b', '2025-06-15 14:00:00+00', '2025-06-15 15:00:00+00', true),
  ('7bf25f7b-f16e-4d75-9847-087276da4e0b', '2025-06-16 09:00:00+00', '2025-06-16 10:00:00+00', true),
  ('7bf25f7b-f16e-4d75-9847-087276da4e0b', '2025-06-16 15:00:00+00', '2025-06-16 16:00:00+00', true),
  ('7bf25f7b-f16e-4d75-9847-087276da4e0b', '2025-06-17 11:00:00+00', '2025-06-17 12:00:00+00', true);