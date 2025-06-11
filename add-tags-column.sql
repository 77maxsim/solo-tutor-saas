-- Add tags column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS tags text[];

-- Update existing students to have empty tags array
UPDATE students SET tags = '{}' WHERE tags IS NULL;