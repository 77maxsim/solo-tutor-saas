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

Verify:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'sessions' AND column_name = 'google_calendar_event_id';

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tutors' AND column_name = 'sync_google_calendar';
```

## Step 2: Configure the Google Cloud OAuth Client

The error **"Access blocked: Authorization Error — Error 400: invalid_request"**
almost always means the redirect URI sent by the app is not registered in
Google Cloud Console (or the consent screen is misconfigured).

The app prints the resolved redirect URI at startup, e.g.:

```
[GoogleCalendar] OAuth redirect URI: https://<your-domain>/api/auth/google/callback
```

You must add **every** URI listed below to your OAuth 2.0 Client.

### 2a. Authorized redirect URIs

In Google Cloud Console → **APIs & Services → Credentials → OAuth 2.0 Client IDs
→ (your client) → Authorized redirect URIs**, add:

| Environment | Authorized redirect URI |
|---|---|
| Production (deployed app) | `https://<your-app>.replit.app/api/auth/google/callback` |
| Production (custom domain, if any) | `https://<your-custom-domain>/api/auth/google/callback` |
| Replit dev environment | `https://<dev-domain>.replit.dev/api/auth/google/callback` (see startup log for the exact value) |
| Local development | `http://localhost:5000/api/auth/google/callback` |

The exact dev-domain value is shown in the server startup log line
`[GoogleCalendar] OAuth redirect URI: …`. Copy it from there to avoid typos.

> Tip: if you ever need to override the auto-detected URI, set the
> `GOOGLE_OAUTH_REDIRECT_URI` environment variable — it always wins.

### 2b. Authorized JavaScript origins

Add the same hosts (without the path) under **Authorized JavaScript origins**:

- `https://<your-app>.replit.app`
- `https://<your-custom-domain>` (if any)
- `https://<dev-domain>.replit.dev`
- `http://localhost:5000`

### 2c. Required environment variables

These must be set in **both** the dev environment and the deployed app:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- (optional) `GOOGLE_OAUTH_REDIRECT_URI` — only if you need to override
  auto-detection (e.g. behind a reverse proxy).

## Step 3: Configure the OAuth Consent Screen

In Google Cloud Console → **APIs & Services → OAuth consent screen**, verify:

- **App name** is set.
- **User support email** is set.
- **Developer contact email** is set.
- **Authorized domains** includes `replit.app` (and your custom domain, if any).
- **Scopes** include `https://www.googleapis.com/auth/calendar.events`.
- **Publishing status**:
  - If status is **Testing**, every Google account that wants to connect must
    be listed under **Test users**. Otherwise Google blocks them with the same
    `invalid_request` error.
  - For all real tutors, switch the app to **In production** (Published).

## Step 4: Verify End-to-End

After steps 1–3 are done and the app has been redeployed:

1. Open the deployed app, sign in as a tutor.
2. Open the calendar settings and click **Connect Google Calendar**.
3. Complete Google's consent screen.
4. You should be redirected back to the app with `?googleCalendarConnected=true`.
5. In Supabase, the tutor row should now have non-null
   `google_access_token`, `google_refresh_token`, `google_token_expires_at`,
   and `google_calendar_connected = true`.
6. Create or update a session — its `google_calendar_event_id` should be
   populated and the event should appear on your Google Calendar.

If step 3 still fails with `Error 400: invalid_request`:

- Check the server startup log for the exact redirect URI.
- Compare it character-for-character to what is registered in Google Cloud
  Console (trailing slashes and `http` vs `https` matter).
- Confirm the user's account is either a Test user or that the app is Published.

## How It Works

### Data Flow (No Changes to Existing Timezone Logic)
1. When you schedule a session, Classter stores `session_start` and
   `session_end` as UTC timestamps.
2. If Google Calendar sync is enabled, the sync service:
   - Reads the UTC timestamps from the database.
   - Reads your timezone from the tutors table.
   - Creates a Google Calendar event with the correct local time.
   - Stores the Google Calendar event ID in `google_calendar_event_id`.
3. Existing timezone conversion logic remains untouched.

### What Gets Synced
- Session title (student name + "Session")
- Session time (converted from UTC to your local timezone)
- Duration
- Notes (if any)
- Color coding

### What Doesn't Get Synced
- Google Calendar events → Classter (one-way sync only)
- Cancelled sessions
- Pending sessions (only confirmed sessions sync)
