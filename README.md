# Classter - Tutoring Management System

A comprehensive, timezone-friendly tutoring management platform built with React and Supabase. Features an advanced scheduling tool with FullCalendar integration, intelligent dataset optimization for scalability, complete timezone awareness for global tutoring operations, and enterprise-grade security features.

## 🚀 Features

### Core Functionality
- **Advanced Scheduling Tool**: Full-featured calendar with FullCalendar integration, drag-and-drop functionality, and multi-view support (month, week, day, agenda)
- **Google Calendar Integration**: One-way sync from Classter to Google Calendar with real-time progress tracking for bulk operations
- **Timezone-Friendly Architecture**: Complete timezone awareness with automatic detection, manual override, and proper UTC storage with local display
- **Intelligent Dataset Optimization**: Automatic query optimization that switches strategies based on dataset size for optimal performance
- **Student Management**: Add, edit, and organize students with tags, contact information, profile pictures, favoriting, and bulk operations
- **Earnings Tracking**: Real-time earnings calculations with detailed breakdowns by time periods, multi-currency support, and interactive charts
- **Public Booking**: Student-facing booking page with timezone-aware slot selection
- **Pending Requests**: Manage booking requests from students with approval workflow
- **Admin Dashboard**: Comprehensive system monitoring with KPIs, analytics charts, top tutors metrics, and broadcast capabilities
- **Telegram Notifications**: Daily summaries, booking alerts, and broadcast messages for subscribed tutors

### Student Management Features
- **Tagging System**: Organize students with custom tags for easy filtering and categorization
- **Bulk Operations**: Archive multiple students at once with undo functionality
- **Favoriting**: Mark important students as favorites for quick access
- **Advanced Filtering**: Filter students by tags, status, and favorites
- **Profile Pictures**: Upload and manage student avatars with secure storage

### Security & Monitoring
- **Error Tracking**: Sentry integration for comprehensive frontend and backend error tracking, performance monitoring, and session replay
- **Rate Limiting**: Multi-tier rate limiting with `express-rate-limit` and `express-slow-down` to prevent DDoS attacks and API abuse
- **XSS Protection**: Comprehensive input sanitization using DOMPurify across all user-generated content
- **Security Headers**: Helmet middleware for security-related HTTP headers
- **CORS Configuration**: Properly configured CORS with credentials support
- **Request Size Limits**: JSON body size limited to 200kb
- **Row Level Security**: Database-level access control with Supabase RLS
- **Health Monitoring**: Health check endpoint (`/api/health`) for uptime monitoring

### Telegram Bot Integration
- **Daily Summaries**: Automated daily reports at 9 PM (tutor's timezone) with earnings, unpaid sessions, and tomorrow's schedule
- **Booking Notifications**: Real-time alerts for new booking requests
- **Broadcast Messages**: Admin capability to send announcements to all subscribed tutors
- **Database Persistence**: Duplicate prevention that survives server restarts
- **Subscription Management**: Easy opt-in via email verification

### Admin Dashboard Features
- **Platform Metrics**: Total tutors, active students, sessions this week, total earnings (USD), unpaid sessions
- **User Engagement**: Weekly Active Users (WAU), Monthly Active Users (MAU), and engagement ratios
- **Earnings Analytics**: Trend charts showing earnings over time with month-over-month comparisons
- **Top Tutors**: Leaderboard showing top 10 tutors by earnings with session counts
- **Multi-Currency Support**: Automatic currency conversion to USD for unified reporting
- **Broadcast Messaging**: Send Markdown-formatted announcements to all tutors via Telegram

### Google Calendar Integration ✅
- **One-Way Sync**: Automatically sync all tutoring sessions from Classter to Google Calendar
- **Real-Time Progress**: Visual progress bar with live updates during bulk sync operations
- **Per-Session Tracking**: Each session includes google_calendar_event_id for reference
- **Optional Enable/Disable**: Toggle sync on/off in profile settings
- **Bulk Sync Tool**: Sync all existing sessions with real-time progress indicator showing:
  - Current progress (e.g., "Syncing session 45/237")
  - Percentage completion with visual progress bar
  - Success and failure counts
  - Server-Sent Events (SSE) for instant updates
- **Event Details**: Calendar events include student name, session time, duration, and notes
- **Automatic Updates**: When you edit or delete sessions in Classter, Google Calendar updates automatically
- **Recurring Sessions**: Supports recurring session sync with proper calendar event cleanup
- **Non-Blocking**: Calendar sync failures don't prevent session operations from succeeding
- **Memory Safe**: Proper EventSource cleanup prevents memory leaks

### Enhanced Earnings Charts ✅
- **Interactive Visualizations**: Recharts-powered earnings trend charts with hover interactions
- **Multiple Time Views**: Switch between daily, weekly, and monthly earnings views
- **Month-over-Month Comparison**: See current month vs. previous month earnings at a glance
- **Student Breakdown**: Detailed earnings by student with session counts
- **Real-Time Updates**: Charts update automatically as you add or modify sessions
- **Multi-Currency Display**: Shows earnings in your preferred currency with automatic conversion for admin dashboard
- **Performance Optimized**: Efficient data aggregation for large datasets
- **Responsive Design**: Charts adapt to different screen sizes for mobile and desktop viewing

### Recent Updates (November 2025)

#### Google Calendar Integration ✅
- **Replit Integration**: Set up Google Calendar connector via Replit's integration system
- **Database Schema**: Added `google_calendar_event_id` column to sessions table and `sync_google_calendar` preference to tutors table
- **Backend Service**: Isolated sync service (`googleCalendarSync.ts`) that reads UTC timestamps and tutor timezone
- **API Endpoints**: RESTful endpoints for create/update/delete calendar events with SSE support for progress tracking
- **Frontend Hook**: Custom hook (`useGoogleCalendarSync.ts`) for easy integration across components
- **Settings UI**: Profile page toggle for enabling/disabling sync with real-time progress indicator
- **CRUD Integration**: Calendar sync hooks into all session operations (create, update, delete, bulk operations)
- **Progress Tracking**: Real-time progress bar using Server-Sent Events for bulk sync operations
- **Memory Management**: Proper EventSource cleanup to prevent memory leaks

#### Recent Updates (October 2025)

#### Branding Update ✅
- **Application rebranded to Classter** with new logo and visual identity
- **Updated favicon and platform imagery** for consistent branding
- **Improved visual presentation** across all pages

#### Security Enhancements ✅
- **Comprehensive XSS protection** with DOMPurify sanitization on all user-generated content
- **Multi-tier rate limiting** for auth, sessions, admin, and public API routes
- **Security headers** via Helmet middleware
- **Request size limits** to prevent DoS attacks

#### Student Management Improvements ✅
- **Tag management system** for organizing students
- **Bulk archiving** with undo functionality
- **Student favoriting** for quick access
- **Improved accessibility** with screen reader support

#### UTC Timestamp Migration ✅
- **Complete migration** from legacy date/time fields to UTC timestamp-based session management
- All sessions now use `session_start` and `session_end` fields exclusively
- Timezone-aware display while maintaining UTC storage for data consistency
- Enhanced booking flow with proper timezone conversion

#### Booking System Fixes ✅
- **Fixed student booking page** with proper timezone conversion from tutor's timezone to student's local timezone
- **Resolved pending requests modal** to work with new UTC timestamp schema
- **Enhanced booking submission** with correct field validation and error handling
- **Improved slot availability** filtering to exclude cancelled sessions

#### Calendar Enhancements ✅
- **Restored calendar slot selection** functionality with animated loading indicators
- **Fixed ghost session cards** issue preventing proper session creation
- **Added session card hover animations** for better user experience
- **Enhanced timezone handling** with fallback mechanisms for Asia/Shanghai timezone

#### Dataset Optimization ✅
- **Intelligent query optimization** that automatically switches strategies based on dataset size (500+ sessions threshold)
- **Performance monitoring** with query execution time tracking and alerts
- **Scalable architecture** supporting both small and large tutoring operations
- **Real-time subscriptions** for live data updates across components

## 🛠 Technology Stack

**Frontend**
- React 18 with TypeScript
- Vite for development and building
- Tailwind CSS for styling
- Radix UI for accessible components
- TanStack Query for server state management
- FullCalendar for scheduling interface
- Luxon for timezone handling
- DOMPurify for XSS protection
- Sentry for error tracking and performance monitoring

**Backend**
- Express.js server
- Supabase (PostgreSQL) for database
- Supabase Auth for authentication
- Supabase Storage for file uploads
- Node Telegram Bot API for notifications
- Sentry for backend error tracking
- Helmet for security headers
- express-rate-limit & express-slow-down for rate limiting

**Key Libraries**
- React Hook Form with Zod validation
- Wouter for client-side routing
- Canvas Confetti for success animations
- React Beautiful DnD for dashboard customization
- ExchangeRate-API for currency conversion

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd classter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file with the required credentials:
   ```
   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Telegram Bot (Optional)
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   
   # Sentry (Optional - for error tracking)
   SENTRY_DSN_FRONTEND=your_frontend_sentry_dsn
   SENTRY_DSN_BACKEND=your_backend_sentry_dsn
   ```

3a. **Set up Google Calendar Integration** (Optional)
   - Navigate to the Replit Integrations panel
   - Search for and add the "Google Calendar" connector
   - Authorize with your Google account
   - The integration will automatically configure OAuth credentials

4. **Database Setup**
   - Run the SQL migrations in your Supabase SQL Editor
   - Required migration for Telegram notifications:
     ```sql
     ALTER TABLE tutors ADD COLUMN IF NOT EXISTS last_daily_notification_date DATE;
     ```
   - Required migration for Google Calendar integration:
     ```sql
     -- Add Google Calendar event ID tracking to sessions table
     ALTER TABLE sessions ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
     
     -- Add Google Calendar sync preference to tutors table
     ALTER TABLE tutors ADD COLUMN IF NOT EXISTS sync_google_calendar BOOLEAN DEFAULT false;
     ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 🗄 Database Schema

### Core Tables
- **tutors**: User profiles linked to Supabase Auth, includes timezone, currency, admin status, Telegram chat ID, and Google Calendar sync preference
- **students**: Student records with contact info, tags, favorite status, and metadata
- **sessions**: Tutoring sessions with UTC timestamps (`session_start`, `session_end`), notes, payment status, and Google Calendar event ID
- **booking_slots**: Available time slots for public booking
- **payments**: Payment tracking for completed sessions

### Key Schema Features
- **UTC Timestamps**: All session times stored as `session_start` and `session_end` in UTC
- **Row Level Security**: RLS policies ensure data isolation between tutors
- **Proper Indexing**: Optimized indexes for performance with large datasets
- **Enum Types**: Status enums for sessions (scheduled, completed, cancelled, pending)

## 🌍 Timezone Handling

The application implements comprehensive timezone support:

1. **Storage**: All session times stored as UTC timestamps in the database
2. **Display**: Times automatically converted to user's timezone for display
3. **Booking**: Students see available slots in their local timezone
4. **Detection**: Automatic timezone detection with manual override options
5. **DST Support**: Proper daylight saving time handling via Luxon

### Timezone Features
- Browser-based timezone detection
- Manual timezone selection with searchable dropdown
- Proper DST handling via Luxon
- Fallback mechanisms for timezone resolution
- Multi-timezone support for global operations

## 🔧 Performance Features

### Dataset Optimization
- **Automatic detection**: Switches to optimized queries for datasets over 500 sessions
- **Query strategies**: 
  - Small datasets (< 500 sessions): Single JOIN query
  - Large datasets (500+ sessions): Separate queries with client-side combination
- **Monitoring**: Execution time tracking with performance alerts
- **Caching**: 5-minute cache for session counts to reduce database load

### Caching Strategy
- React Query for intelligent server state caching
- Optimistic updates for better user experience
- Strategic cache invalidation on mutations
- Real-time subscriptions for live updates

## 🔐 Security Features

### Authentication & Authorization
- Supabase Auth with JWT token validation
- Admin authorization middleware
- Row Level Security (RLS) policies
- Secure session management

### Input Validation & Sanitization
- **Client-side**: Zod schema validation on all forms
- **Server-side**: Request body validation before database operations
- **XSS Protection**: DOMPurify sanitization on all user-generated content
  - Sanitize-on-display pattern preserves data integrity
  - Centralized sanitization utilities
  - Applied to names, tags, emails, notes, and all displayed content

### Network Security
- **Rate Limiting**:
  - Auth routes: 5 requests per 15 minutes
  - Public API: 20 requests per minute
  - Admin routes: 50 requests per 15 minutes
  - Global fallback: 120 requests per minute
- **Slow-down**: Progressive delays for suspicious activity
- **CORS**: Properly configured with credentials support
- **Security Headers**: Helmet middleware with CSP, HSTS, etc.
- **Request Limits**: 200kb JSON body size limit

### Error Tracking
- **Sentry Integration**:
  - Frontend error tracking with session replay
  - Backend error tracking with request context
  - Performance monitoring (100% transaction sampling)
  - User context attribution
  - Environment-based configuration
  - Browser extension error filtering

## 📱 Telegram Bot Features

### Daily Notifications (9 PM Tutor Timezone)
- Today's earnings summary
- List of today's unpaid sessions
- Summary of past unpaid sessions
- Tomorrow's schedule

### Real-time Booking Alerts
- Instant notifications for new booking requests
- Session details with date, time, and expected earnings
- Prompts to review and approve via dashboard

### Admin Broadcast
- Send announcements to all subscribed tutors
- Markdown formatting support (bold, italic)
- Delivery tracking with success/failure counts

### Setup Instructions
1. Create a Telegram bot via [@BotFather](https://t.me/BotFather)
2. Add `TELEGRAM_BOT_TOKEN` to environment variables
3. Tutors subscribe by messaging the bot with their registered email
4. Bot verifies email and saves chat ID for notifications

## 🎛 Admin Dashboard

Access the admin dashboard at `/admin` (requires admin privileges).

### Available Features
- **Platform Metrics**: Total tutors, active students, weekly sessions, total earnings (USD)
- **User Engagement**: WAU, MAU, and engagement ratios
- **Earnings Trends**: Visual charts showing daily/weekly/monthly earnings
- **Top Tutors**: Leaderboard with top 10 tutors by total earnings
- **Broadcast Messaging**: Send Telegram announcements to all tutors
- **Multi-Currency**: Automatic conversion to USD for unified reporting

### Granting Admin Access
Run this SQL in your Supabase SQL Editor:
```sql
UPDATE tutors SET is_admin = true WHERE email = 'admin@example.com';
```

## 🚀 Deployment

The application is optimized for Replit deployment:

1. **Development**: Vite dev server with Express middleware
2. **Production**: Static build served by Express with client-side routing
3. **Environment**: Node.js 20+ with PostgreSQL integration
4. **Health Check**: `/api/health` endpoint for uptime monitoring

### Environment Variables for Production
Ensure all required environment variables are set:
- Supabase credentials (URL, anon key, service role key)
- Telegram bot token (if using notifications)
- Sentry DSNs (if using error tracking)

## 📅 Google Calendar Integration

### How It Works
The integration provides one-way synchronization from Classter to Google Calendar:

1. **Enable Sync**: Go to Profile → Google Calendar Integration and toggle sync on
2. **Automatic Sync**: New sessions automatically appear in your Google Calendar
3. **Bulk Sync**: Sync all existing sessions with the "Sync Existing Sessions" button
4. **Real-Time Progress**: Watch live progress with percentage, success/fail counts
5. **Updates**: When you edit a session in Classter, the Google Calendar event updates automatically
6. **Deletions**: When you delete a session in Classter, the calendar event is removed

### Calendar Event Details
Each synced event includes:
- **Title**: Student name + "Session"
- **Time**: Converted from UTC to your local timezone
- **Duration**: Exact session length
- **Description**: Session notes (if any)
- **Color Coding**: Visual distinction for different session types

### Progress Indicator
When syncing multiple sessions, you'll see:
- Real-time progress: "Syncing session 45/237"
- Visual progress bar with percentage
- Success count: ✓ Success: 45
- Failure count (if any): ✗ Failed: 2
- Non-blocking UI - continue using the app while syncing

### Important Notes
- **One-Way Sync**: Changes in Google Calendar won't sync back to Classter
- **Non-Blocking**: Calendar sync failures don't prevent session operations
- **Optional**: You can toggle sync on/off anytime in your profile settings
- **Bulk Operations**: Recurring sessions and bulk deletions sync all affected calendar events

### Transfer Ownership
If you transfer the Replit project:
1. New owner needs to re-authorize Google Calendar in Replit integrations
2. No code changes required
3. All existing `google_calendar_event_id` references remain valid
4. One-time setup process

## 📊 Earnings Analytics

### Dashboard Features
- **Total Earnings**: Cumulative earnings across all sessions
- **Today's Earnings**: Real-time tracking of today's completed sessions
- **Weekly/Monthly Views**: Switch between time periods for detailed analysis
- **Student Breakdown**: See which students contribute most to your earnings
- **Interactive Charts**: Hover over data points to see exact values
- **Trend Analysis**: Month-over-month comparison to track growth

### Chart Types
1. **Earnings Trend**: Line chart showing earnings over time with configurable periods
2. **Student Distribution**: See earnings breakdown by student with session counts
3. **Monthly Comparison**: Compare current month vs. previous month performance
4. **Top Performers**: Identify your most valuable students

### Features
- **Real-Time Updates**: Charts update automatically as sessions are added/modified
- **Multi-Currency**: View earnings in your preferred currency
- **Responsive**: Charts adapt to mobile and desktop screens
- **Performance Optimized**: Handles large datasets efficiently
- **Export Ready**: Data structured for easy export to other tools

## 📱 Public Booking Flow

Students can book sessions through a public booking page:

1. **Access**: Visit `/booking/[tutorId]` for tutor-specific booking
2. **Timezone**: Automatic detection with manual override option
3. **Slots**: View available time slots in student's local timezone
4. **Duration**: Select custom session duration
5. **Submission**: Book sessions with automatic UTC conversion
6. **Confirmation**: Booking requests appear in tutor's pending requests
7. **Notification**: Tutor receives Telegram alert (if subscribed)

## 📝 Usage

### For Tutors
1. **Sign up/Login**: Create account with email, timezone, and currency preferences
2. **Profile Setup**: Upload avatar, configure notification preferences
3. **Google Calendar**: (Optional) Enable Google Calendar sync for automatic session syncing
4. **Add Students**: Create student profiles with tags and contact information
5. **Create Availability**: Set up available time slots for public booking
6. **Schedule Sessions**: Use calendar to schedule and manage sessions
7. **Handle Requests**: Review and approve student booking requests
8. **Track Earnings**: Monitor income with interactive charts and detailed analytics
9. **Telegram Alerts**: Subscribe for daily summaries and booking notifications
10. **Bulk Sync**: Sync all existing sessions to Google Calendar with real-time progress

### For Students
1. **Access Booking Page**: Visit tutor's public booking URL
2. **Select Timezone**: Confirm or change timezone preference
3. **Choose Slot**: Pick from available time slots in your timezone
4. **Select Duration**: Choose session length (e.g., 30, 60, 90 minutes)
5. **Submit Request**: Provide name and submit booking request
6. **Wait for Confirmation**: Tutor will review and confirm booking

### For Admins
1. **Access Dashboard**: Navigate to `/admin` route
2. **Monitor Metrics**: View platform-wide KPIs and engagement
3. **Review Analytics**: Analyze earnings trends and tutor performance
4. **Send Broadcasts**: Announce updates via Telegram to all tutors
5. **Track Health**: Monitor application health and error rates

## 🐛 Troubleshooting

### Common Issues

**Telegram Notifications Not Working**
- Ensure `TELEGRAM_BOT_TOKEN` is set in environment variables
- Verify tutor has subscribed by messaging the bot with their email
- Check Supabase logs for error messages
- Run the required SQL migration for `last_daily_notification_date`

**Timezone Issues**
- Clear browser cache and reload
- Verify timezone is correctly set in tutor profile
- Check that session times are stored as UTC in database
- Ensure Luxon is properly handling DST transitions

**Performance Issues**
- Check dataset size (optimize queries for 500+ sessions)
- Monitor query execution times in console logs
- Review Sentry for slow transaction alerts
- Check database indexes are properly configured

**Google Calendar Sync Issues**
- Ensure Google Calendar connector is authorized in Replit integrations
- Verify `google_calendar_event_id` and `sync_google_calendar` columns exist in database
- Check that sync is enabled in Profile settings
- Review browser console for EventSource errors
- For bulk sync issues, check server logs for SSE connection errors
- Ensure sessions have valid `session_start` and `session_end` timestamps

**Rate Limiting Errors**
- Wait for the rate limit window to expire
- For development, adjust limits in `server/rateLimiters.ts`
- Check IP address isn't being rate-limited globally

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow existing code patterns and conventions
4. Test thoroughly, especially timezone-related features
5. Ensure security best practices are maintained
6. Update documentation for new features
7. Submit pull request with detailed description

### Code Standards
- TypeScript for type safety
- React Hook Form with Zod validation for forms
- TanStack Query for all data fetching
- Sanitize all user-generated content before display
- Follow existing component patterns
- Add `data-testid` attributes for testing

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues or questions:
1. Check existing documentation and troubleshooting guide
2. Review recent updates in this README
3. Check Sentry error logs for detailed stack traces
4. Submit detailed bug reports including:
   - Browser and device information
   - Timezone information
   - Steps to reproduce
   - Expected vs actual behavior
   - Console error messages

## 🙏 Acknowledgments

- Built with [Replit](https://replit.com) platform
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Calendar powered by [FullCalendar](https://fullcalendar.io/)
- Database and auth by [Supabase](https://supabase.com/)
- Error tracking by [Sentry](https://sentry.io/)
- Notifications via [Telegram Bot API](https://core.telegram.org/bots/api)
