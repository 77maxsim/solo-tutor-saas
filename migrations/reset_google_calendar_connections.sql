-- Migration: Reset Google Calendar connections for security upgrade
-- Date: 2025-11-05
-- Purpose: Reset all Google Calendar connection flags to force tutors to reconnect
--          using the new secure per-tutor OAuth system (fixes calendar cross-contamination bug)

-- This migration is safe to run multiple times (idempotent)

BEGIN;

-- Update all tutors to reset Google Calendar connection status
UPDATE tutors
SET 
  google_calendar_connected = false,
  sync_google_calendar = false,
  google_access_token = NULL,
  google_refresh_token = NULL,
  google_token_expires_at = NULL
WHERE 
  google_calendar_connected = true 
  OR sync_google_calendar = true
  OR google_access_token IS NOT NULL;

-- Log the number of affected rows
-- (This will be shown in the console output)

COMMIT;

-- Expected outcome:
-- All tutors will see the "Connect Google Calendar" button in their profile settings
-- They will need to reconnect their Google account using the new OAuth flow
-- After reconnecting, their sessions will only sync to their own personal calendar
