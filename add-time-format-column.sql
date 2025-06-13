-- Add time_format column to tutors table
ALTER TABLE tutors 
ADD COLUMN IF NOT EXISTS time_format VARCHAR(3) DEFAULT '24h' CHECK (time_format IN ('24h', '12h'));

-- Add comment to describe the column
COMMENT ON COLUMN tutors.time_format IS 'User preference for time display format: 24h or 12h';

-- Update existing records to have default value
UPDATE tutors 
SET time_format = '24h' 
WHERE time_format IS NULL;