
-- Add color column to sessions table
ALTER TABLE sessions ADD COLUMN color TEXT DEFAULT '#3B82F6';

-- Update existing sessions to have a default color
UPDATE sessions SET color = '#3B82F6' WHERE color IS NULL;
