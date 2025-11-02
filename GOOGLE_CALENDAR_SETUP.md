# Google Calendar Integration Setup

## Step 1: Add Database Columns

Run these SQL commands in your Supabase SQL Editor (https://supabase.com/dashboard):

```sql
-- Add Google Calendar event ID tracking to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Add Google Calendar sync preference to tutors table  
ALTER TABLE tutors 
ADD COLUMN IF NOT EXISTS sync_google_calendar BOOLEAN DEFAULT false;
```

## Step 2: Verify Columns Were Added

Run this to confirm:

```sql
-- Check sessions table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'sessions' AND column_name = 'google_calendar_event_id';

-- Check tutors table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'tutors' AND column_name = 'sync_google_calendar';
```

## How It Works

### Data Flow (No Changes to Existing Timezone Logic)
1. When you schedule a session, Classter stores `session_start` and `session_end` as UTC timestamps (as it does now)
2. If Google Calendar sync is enabled, the sync service:
   - Reads the UTC timestamps from the database
   - Reads your timezone from the tutors table
   - Creates a Google Calendar event with the correct local time
   - Stores the Google Calendar event ID in `google_calendar_event_id`
3. Your existing timezone conversion logic remains completely untouched

### What Gets Synced
- Session title (student name + "Session")
- Session time (converted from UTC to your local timezone)
- Duration
- Notes (if any)
- Color coding

### What Doesn't Get Synced
- Google Calendar events → Classter (one-way sync only)
- Cancelled sessions (these are excluded)
- Pending sessions (only confirmed sessions sync)

## Next Steps
Once you've run the SQL commands above, I'll continue with implementing the sync service.
