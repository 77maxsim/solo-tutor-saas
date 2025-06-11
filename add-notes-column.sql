-- Add notes column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT;