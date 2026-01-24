-- Add columns for admin reply functionality to the feedback table
-- Run this in your Supabase SQL Editor

ALTER TABLE feedback 
ADD COLUMN IF NOT EXISTS admin_response TEXT,
ADD COLUMN IF NOT EXISTS admin_responded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_responder_name TEXT;

-- Refresh the PostgREST schema cache (this happens automatically after schema changes)
NOTIFY pgrst, 'reload schema';
