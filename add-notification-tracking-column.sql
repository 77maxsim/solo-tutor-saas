-- Add column to track when last daily notification was sent
-- This prevents duplicate notifications even if server restarts
ALTER TABLE tutors ADD COLUMN IF NOT EXISTS last_daily_notification_date DATE;
