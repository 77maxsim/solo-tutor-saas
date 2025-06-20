-- Add status column to sessions table if it doesn't exist
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';

-- Update existing sessions to have confirmed status
UPDATE sessions SET status = 'confirmed' WHERE status IS NULL;

-- Create an index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_tutor_status ON sessions(tutor_id, status);