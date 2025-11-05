# Google Calendar Connection Reset Migration

## Purpose
This migration resets all Google Calendar connections to force tutors to reconnect using the new secure per-tutor OAuth system. This fixes the critical bug where sessions were appearing in the wrong tutor's calendars.

## What This Does
- Sets `google_calendar_connected` to `false` for all tutors
- Sets `sync_google_calendar` to `false` for all tutors  
- Clears all OAuth tokens (`google_access_token`, `google_refresh_token`, `google_token_expires_at`)

## Running the Migration

### Option 1: Via Replit Database UI (Recommended)
1. Go to your Replit project
2. Click on the "Database" tab in the left sidebar
3. Switch to the **Production** database using the dropdown
4. Click "Query" or "SQL Editor"
5. Copy the contents of `reset_google_calendar_connections.sql`
6. Paste and run the query
7. Verify the output shows the number of updated rows

### Option 2: Via psql Command Line
```bash
# Connect to your production database
psql $DATABASE_URL_PRODUCTION

# Run the migration
\i migrations/reset_google_calendar_connections.sql

# Verify the changes
SELECT id, full_name, google_calendar_connected, sync_google_calendar 
FROM tutors 
WHERE google_calendar_connected = true OR sync_google_calendar = true;
# Should return 0 rows
```

### Option 3: Via Supabase Dashboard
1. Log into your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `reset_google_calendar_connections.sql`
4. Click "Run"
5. Check the results to see how many rows were updated

## After Migration
- All tutors will see the "Connect Google Calendar" button on their profile page
- Each tutor must reconnect their own Google Calendar account
- Once reconnected, sessions will only sync to the tutor's personal calendar (no more cross-contamination)

## Safety
- This migration is **idempotent** - safe to run multiple times
- Uses a transaction (BEGIN/COMMIT) for atomicity
- Only affects rows that actually need updating
- Does not delete any session data or other important information

## Rollback
If you need to rollback (not recommended as it would reintroduce the security bug):
```sql
-- NOT RECOMMENDED - only for emergency rollback
UPDATE tutors SET google_calendar_connected = true WHERE id IN (...specific tutor IDs...);
```

However, since the old OAuth tokens are cleared, you would still need tutors to reconnect anyway.
