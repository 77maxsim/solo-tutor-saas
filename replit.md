# Classter - Tutoring Management System

## Overview

Classter is a comprehensive tutoring management platform designed for tutors to efficiently manage students, schedule sessions, track earnings, and process payments. Built with React and Supabase, it offers an intuitive dashboard to streamline tutoring operations. The platform aims to simplify administrative tasks, allowing tutors to focus more on teaching, and includes features like an admin dashboard for overall system monitoring and Telegram notifications for real-time updates.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React + TypeScript with Vite.
- **Component Library**: Radix UI for accessible components, styled with Tailwind CSS.
- **Routing**: Wouter for client-side navigation.
- **Calendar**: FullCalendar integration with multiple view modes, drag-and-drop scheduling, and mobile responsiveness.
- **Theming**: Support for dark mode with ThemeProvider and localStorage persistence.
- **Accessibility**: Screen reader support, proper ARIA labels, and keyboard navigation.

### Technical Implementations
- **State Management**: React Query (TanStack Query) for server state management and caching.
- **Backend**: Express.js server for RESTful APIs, integrated with Supabase.
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS) for data access control and real-time features.
- **Authentication**: Supabase Auth for email/password, with JWT for secure API access, especially for admin functionalities.
- **Data Handling**:
    - **Dataset Optimization System**: Dynamically switches query strategies based on dataset size for performance (500+ sessions threshold).
    - **UTC Timestamp Migration**: All session times are stored as UTC and converted to the tutor's local timezone for display.
    - **Real-time Updates**: Supabase subscriptions combined with polling for robust real-time data synchronization.
    - **Earnings Calculation**: Shared logic for calculating earnings and generating financial statistics.
    - **File Storage**: Supabase Storage for avatar uploads with RLS policies.
    - **Multi-Currency Support**: Currency conversion service using ExchangeRate-API with 24-hour caching for admin dashboard metrics.
- **Notifications**: Telegram bot integration for daily summaries (9 PM tutor timezone), booking alerts, and broadcast messages to subscribed tutors.
- **Error Tracking & Monitoring**: Sentry integration for comprehensive error tracking, performance monitoring, and session replay on both frontend and backend with automatic user context attribution.
- **Admin Dashboard**: Comprehensive dashboard with KPIs, analytics charts (e.g., weekly earnings trend), top tutors performance metrics, and multi-currency earnings conversion to USD.
- **Student Management**: 
    - **Tagging System**: Custom tags for organizing students with filtering capabilities.
    - **Bulk Operations**: Archive multiple students at once with undo functionality.
    - **Favoriting**: Mark important students as favorites for quick access.
    - **Profile Pictures**: Upload and manage student avatars.
    - **Advanced Filtering**: Filter by tags, status, and favorites.
- **Session Management**: 
    - **Smart Rate Prefill**: Automatically prefills rates in session modals based on previous sessions.
    - **Bulk Actions**: Mark multiple sessions as paid in one action.
    - **Session Notes**: Add notes to sessions with proper sanitization.
    - **Recurring Sessions**: Create weekly recurring sessions up to 12 weeks.
- **Health Monitoring**: Health check endpoint (`/api/health`) for uptime monitoring and application status tracking.
- **Rate Limiting**: Implemented `express-rate-limit` and `express-slow-down` for DDoS protection and API abuse prevention with tiered limits:
    - Auth routes: 5 requests per 15 minutes
    - Public API: 20 requests per minute
    - Admin routes: 50 requests per 15 minutes
    - Sessions routes: 100 requests per 15 minutes
    - Global fallback: 120 requests per minute
- **Security Headers**: Helmet middleware for comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.).
- **CORS Configuration**: Properly configured CORS with credentials support and origin validation.
- **Request Size Limits**: Limited JSON body size to 200kb to prevent certain DoS attacks.
- **XSS Protection**: Comprehensive input sanitization using DOMPurify with a sanitize-on-display approach:
    - **Implementation**: Centralized sanitization utility (`client/src/lib/sanitize.ts`) with `sanitizeText()` and `sanitizeHtml()` functions that strip all HTML tags by default.
    - **Coverage**: Applied to all user-generated content in readonly contexts including student names, tags, emails, phones, session notes, unassigned names, calendar event titles, activity descriptions, and aria-label attributes.
    - **Design**: Sanitize-on-display pattern preserves original data in the database while preventing XSS execution at render time.
    - **Form Inputs**: Edit forms intentionally display raw values for editing; sanitization only applies to readonly display contexts.

### System Design Choices
- **Component-based architecture** for modularity and reusability.
- **RESTful API endpoints** for clear data operations.
- **Performance monitoring** for query execution times with alerts for slow queries.
- **Security**: RLS, JWT validation, admin authorization middleware, comprehensive rate limiting, XSS protection, and security headers to protect sensitive data and operations from abuse.
- **Responsive Design**: Mobile-first approach with dedicated mobile header and sidebar components.
- **Dashboard Customization**: Drag-and-drop dashboard cards using React Beautiful DnD.

## Recent Changes

### October 2025
- **Branding Update**: Application rebranded from TutorTrack to Classter with new logo and visual identity.
- **Security Enhancements**: Comprehensive XSS protection with DOMPurify, multi-tier rate limiting, and security headers.
- **Student Management**: Added tagging system, bulk archiving with undo, favoriting, and improved accessibility.
- **Activity Sanitization**: All activity descriptions now properly sanitized to prevent XSS attacks.
- **Session Form UX**: Fixed duration and rate fields to allow clearing without auto-reverting to 0, with auto-select on focus for easy value replacement, proper NaN handling, and user-friendly validation messages.

### June 2025
- **UTC Timestamp Migration**: Complete migration from legacy date/time fields to UTC timestamps.
- **Booking System Fixes**: Fixed timezone conversion and field validation issues.
- **Calendar Enhancements**: Restored slot selection, fixed ghost cards, added hover animations.
- **Dataset Optimization**: Implemented intelligent query optimization for large datasets (500+ sessions).

## External Dependencies

- **React Query**: Server state management and caching.
- **Supabase**: Backend-as-a-Service providing database, authentication, and storage.
- **FullCalendar**: Interactive calendar for scheduling.
- **Luxon**: Advanced date and timezone handling.
- **Radix UI**: Accessible and unstyled UI components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Express.js**: Backend web application framework.
- **Wouter**: Small routing library for React.
- **React Hook Form**: Form state management with Zod validation.
- **Canvas Confetti**: For success animations.
- **Recharts**: For charting and data visualization in admin dashboard.
- **Day.js**: Lightweight date manipulation library.
- **Telegram Bot API**: For sending notifications and broadcast messages.
- **ExchangeRate-API**: Currency conversion service for admin dashboard.
- **Sentry**: Error tracking and performance monitoring for both frontend and backend.
- **express-rate-limit**: Middleware for rate limiting.
- **express-slow-down**: Middleware for slowing down responses.
- **Helmet**: Middleware for setting security-related HTTP headers.
- **DOMPurify**: XSS sanitization library for protecting against malicious user-generated content.

## Key Features Implementation Details

### Timezone Handling
- All session times stored as UTC in database (`session_start`, `session_end` fields)
- Display times converted to tutor's timezone using Luxon
- Public booking page respects student's timezone
- Automatic timezone detection with manual override
- Proper DST handling

### Dataset Optimization
- Threshold: 500 sessions triggers optimization
- Small datasets: Single JOIN query
- Large datasets: Separate queries with client-side combination
- Caching: 5-minute cache for session counts
- Performance monitoring with execution time tracking

### Telegram Bot Features
- Daily notifications at 9 PM (tutor timezone) with earnings, unpaid sessions, and tomorrow's schedule
- Real-time booking notifications when new requests are made
- Broadcast messaging for admin announcements
- Database persistence to prevent duplicates across server restarts
- Subscription management via email verification

### Admin Dashboard
- Platform-wide metrics: tutors, students, sessions, earnings, unpaid sessions
- User engagement: WAU, MAU, engagement ratios
- Earnings trend charts with daily/weekly/monthly views
- Top tutors leaderboard by total earnings
- Multi-currency support with automatic USD conversion
- Telegram broadcast messaging with Markdown support

### Student Management
- Create, edit, delete, and archive students
- Custom tags for organization and filtering
- Favorite students for quick access
- Bulk archive with undo functionality
- Avatar upload with secure storage
- Session history and earnings per student

### Security Features
- **Authentication**: Supabase Auth with JWT validation
- **Authorization**: Admin middleware checking `is_admin` flag
- **RLS Policies**: Database-level access control
- **Rate Limiting**: Tiered limits for different route types
- **XSS Protection**: DOMPurify sanitization on all display contexts
- **Security Headers**: Helmet middleware
- **Input Validation**: Zod schemas on client and server
- **Request Limits**: 200kb JSON body size limit
- **Error Tracking**: Sentry integration with user context

## Database Schema

### Core Tables
- **tutors**: id, user_id, full_name, email, timezone, currency, avatar_url, is_admin, telegram_chat_id, last_daily_notification_date, time_format
- **students**: id, tutor_id, name, email, phone, tags[], avatar_url, is_favorite, is_archived, notes
- **sessions**: id, tutor_id, student_id, session_start, session_end, duration, rate, tuition_fee, paid, status, notes, recurrence_id, unassigned_name
- **booking_slots**: id, tutor_id, start_time, end_time, is_active
- **payments**: id, session_id, amount, payment_date, payment_method, notes

### Important Constraints
- UTC timestamps for all session times
- Row Level Security on all tables
- Foreign key relationships with cascade deletes
- Proper indexes for performance

## Environment Variables

Required environment variables:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `TELEGRAM_BOT_TOKEN`: Telegram bot token (optional)
- `SENTRY_DSN_FRONTEND`: Sentry DSN for frontend (optional)
- `SENTRY_DSN_BACKEND`: Sentry DSN for backend (optional)

## API Routes

### Authentication
- All protected routes use `authenticateUser` middleware
- Admin routes additionally use `authorizeAdmin` middleware

### Main Routes
- `/api/health`: Health check endpoint
- `/api/sentry-config`: Sentry configuration for frontend
- `/api/students`: CRUD operations for students
- `/api/sessions`: CRUD operations for sessions
- `/api/booking-slots`: CRUD operations for availability
- `/api/pending-sessions`: Public booking submissions
- `/api/admin/metrics`: Platform-wide metrics
- `/api/admin/earnings-trend`: Earnings analytics
- `/api/admin/top-tutors`: Top tutors leaderboard
- `/api/admin/broadcast`: Telegram broadcast messaging

## Known Issues & Solutions

### Telegram Notifications
- **Issue**: Duplicates on server restart
- **Solution**: Database persistence with `last_daily_notification_date` column
- **Migration Required**: `ALTER TABLE tutors ADD COLUMN IF NOT EXISTS last_daily_notification_date DATE;`

### Large Datasets
- **Issue**: Slow queries with 500+ sessions
- **Solution**: Automatic query optimization with separate fetches
- **Monitoring**: Console logs show performance metrics

### Timezone Edge Cases
- **Issue**: DST transitions can cause confusion
- **Solution**: Luxon handles DST automatically
- **Best Practice**: Always store UTC, display in local time

## Testing Considerations

When testing the application:
- Test with different timezones (especially around DST transitions)
- Verify XSS protection by attempting to inject scripts in user inputs
- Check rate limiting by making rapid requests
- Test with large datasets (500+ sessions) to verify optimization
- Verify Telegram notifications are sent correctly
- Check admin dashboard with multi-currency data
- Test student tagging and filtering
- Verify bulk operations work correctly

## Deployment on Replit

The application is configured for Replit deployment:
- Workflow: "Start application" runs `npm run dev`
- Port: Frontend and backend served on the same port (5000)
- Auto-restart: Workflows restart automatically after package changes
- Environment: Node.js 20+ with PostgreSQL
- Health checks: `/api/health` endpoint for monitoring

## Future Enhancements

Potential improvements documented in user preferences:
- Session editing and rescheduling
- Payment processing integration
- Advanced reporting and analytics
- Student portal for viewing schedule and payments
- Mobile app for iOS and Android
- Video call integration
- Automated invoicing
- Custom branding per tutor
