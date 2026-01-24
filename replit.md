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
- **Responsive Design**: Mobile-first approach with dedicated mobile header and sidebar components.
- **Dashboard Customization**: Drag-and-drop dashboard cards using React Beautiful DnD.
- **Onboarding System**: Guided 3-step onboarding flow for new tutors to complete profile, set up their first class, and connect Telegram notifications.

### Technical Implementations
- **State Management**: React Query (TanStack Query) for server state management and caching.
- **Backend**: Express.js server for RESTful APIs.
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS) for data access control and real-time features.
- **Authentication**: Supabase Auth for email/password, with JWT for secure API access.
- **Data Handling**:
    - **Dataset Optimization System**: Dynamically switches query strategies based on dataset size for performance.
        - **Threshold**: 500 sessions triggers optimization mode (with hysteresis at 470 to prevent flapping).
        - **Standard Path** (<500 sessions): Single query with joins for student data.
        - **Optimized Path** (500+ sessions): Paginated batch fetching using Supabase `.range()` in 1000-row batches to overcome Supabase's implicit row limits. Includes deduplication, separate student data fetch, and comprehensive logging.
        - **Safety Limits**: Maximum 20 batches (20,000 sessions) with automatic fallback to standard query on errors.
        - **Performance Tracking**: Query execution times monitored via `datasetMonitor` with alerts for slow queries.
    - **UTC Timestamp Migration**: All session times are stored as UTC and converted to the tutor's local timezone for display.
    - **Real-time Updates**: Supabase subscriptions combined with polling for robust real-time data synchronization.
    - **Earnings Calculation**: Shared logic for calculating earnings and generating financial statistics.
    - **File Storage**: Supabase Storage for avatar uploads with RLS policies.
    - **Multi-Currency Support**: Currency conversion service with 24-hour caching for admin dashboard metrics.
    - **USD Toggle for Tutors**: Tutors with non-USD currencies can toggle earnings display to USD. Exchange rates are cached per tutor for 12 hours to minimize API calls. Implemented via `/api/tutor/usd-rate` endpoint with rate caching in the tutors table (`usd_exchange_rate`, `usd_rate_fetched_at` columns).
    - **Query Timeout Protection**: 30-second timeout on all Supabase queries with proper abort signal handling to prevent hung requests.
    - **API Usage Monitoring**: Comprehensive tracking of ExchangeRate-API calls with monthly limits (1,500 requests) and 80% threshold warnings.
- **Notifications**: Telegram bot integration for daily summaries, booking alerts, broadcast messages, and admin feedback notifications.
- **Help/Feedback System**: Floating feedback button on all authenticated pages allowing users to submit help requests, feedback, or technical support tickets. Submissions are stored in a `feedback` table and instantly notify the admin via Telegram. Email is required for responses.
    - **Admin Feedback Management** (`/admin/feedback`): Centralized dashboard for viewing, filtering, and responding to all user submissions. Supports status tracking (New/In Progress/Resolved), type filtering (Help/Feedback/Technical Support), and admin reply functionality. Replies are stored in the database with responder info and trigger email notifications via Resend.
- **Email Notifications**: Resend integration for sending transactional emails. Currently used for feedback reply notifications to users with professional HTML templates and XSS-safe content rendering.
- **Error Tracking & Monitoring**: Sentry integration for comprehensive error tracking, performance monitoring, and session replay on both frontend and backend.
- **Admin Dashboard**: Comprehensive dashboard with KPIs, analytics charts, top tutors performance metrics, and multi-currency earnings conversion to USD.
    - **SQL Aggregation for Scalability**: Admin metrics use PostgreSQL RPC functions for server-side aggregation (handles millions of sessions). Falls back to paginated batch fetching if RPC functions not installed.
    - **RPC Functions**: `get_active_students_count`, `get_earnings_by_tutor`, `get_top_tutors_earnings`, `get_active_tutors_count`, `get_unpaid_sessions_count` - defined in `create-admin-aggregate-functions.sql`.
    - **Week Calculation**: Uses Monday as start of week (matching individual tutor dashboards).
- **Student Management**: Features a tagging system, bulk operations (e.g., archiving), favoriting, and profile picture management.
- **Session Management**: Includes smart rate prefill, bulk actions (e.g., mark as paid), session notes with sanitization, and recurring sessions functionality.
- **Health Monitoring**: Health check endpoint (`/api/health`) for uptime monitoring.
- **Rate Limiting**: Implemented `express-rate-limit` and `express-slow-down` for DDoS protection and API abuse prevention with tiered limits.
- **Security Headers**: Helmet middleware for comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.).
- **CORS Configuration**: Properly configured CORS with credentials support and origin validation.
- **Request Size Limits**: Limited JSON body size to 200kb to prevent certain DoS attacks.
- **XSS Protection**: Comprehensive input sanitization using DOMPurify with a sanitize-on-display approach, applied to all user-generated content in readonly contexts.

### System Design Choices
- **Component-based architecture** for modularity and reusability.
- **RESTful API endpoints** for clear data operations.
- **Performance monitoring** for query execution times with alerts for slow queries.
- **Security**: RLS, JWT validation, admin authorization middleware, comprehensive rate limiting, XSS protection, and security headers to protect sensitive data and operations from abuse.

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
- **Resend**: Email delivery service for transactional emails (feedback reply notifications).

## Admin Dashboard Scalability (Implemented)

### SQL Aggregation System
The Admin Dashboard uses PostgreSQL RPC functions for server-side aggregation, enabling unlimited scalability:

**Performance Comparison:**
| Metric | Before (Batch Fetch) | After (RPC) | Improvement |
|--------|---------------------|-------------|-------------|
| Admin Metrics | ~3,500ms | ~1,400ms | 2.5x faster |
| Top Tutors | ~3,000ms | ~236ms | 12x faster |

**RPC Functions (defined in `create-admin-aggregate-functions.sql`):**
- `get_active_students_count(days_back)` - COUNT DISTINCT students with sessions
- `get_earnings_by_tutor(paid_only)` - SUM earnings grouped by tutor/currency
- `get_top_tutors_earnings(limit_count)` - Top tutors with aggregated earnings
- `get_active_tutors_count(days_back)` - COUNT DISTINCT active tutors
- `get_unpaid_sessions_count()` - COUNT unpaid completed sessions

**Fallback Behavior:**
- If RPC functions aren't installed, automatically falls back to paginated batch fetching
- Fallback limited to 30,000 sessions (30 batches × 1,000 rows)
- Console logs indicate which mode is active: `(RPC: true)` or `(RPC: false)`

**Scalability:**
| Total Sessions | RPC Mode | Fallback Mode |
|---------------|----------|---------------|
| 10,000 | ✅ Instant | ✅ Works |
| 100,000 | ✅ Instant | ⚠️ Slow |
| 1,000,000+ | ✅ Instant | ❌ Would fail |

## Future Roadmap

### Individual Tutor Dashboard Scalability (Priority: Medium)
The current Dataset Optimization system handles up to 20,000 sessions per tutor. For long-term sustainability with high-volume tutors, the following improvements are planned:

1. **Session Archiving System**
   - Auto-archive sessions older than 18 months to a dedicated history table
   - Archived sessions remain accessible via a separate "Historical Data" view
   - Reduces active dataset size for faster queries
   - Target: Implement when any tutor approaches 8,000-10,000 sessions

2. **Server-Side Earnings Aggregation for Tutors**
   - Create backend API endpoints for pre-calculated earnings summaries
   - Endpoints: `/api/earnings/summary`, `/api/earnings/monthly`, `/api/earnings/by-student`
   - Reduces frontend payload from full session list to aggregated totals
   - Enables faster dashboard loading for large accounts

3. **Date Range Filtering for Large Datasets**
   - Add UI controls to filter sessions by date range (e.g., "Last 6 months", "This year")
   - Default to recent data with option to load historical data on demand
   - Reduces initial load time while maintaining full data access

4. **Performance Monitoring Alerts**
   - Enhance `datasetMonitor` to trigger UI notifications when queries exceed 5 batches or 5 seconds
   - Suggest date range filtering or archiving to users approaching limits
   - Proactive guidance before performance degradation occurs

### Individual Tutor Scalability Thresholds
| Sessions | Batches | Status | Recommended Action |
|----------|---------|--------|-------------------|
| <500 | 1 | Standard query | None needed |
| 500-5,000 | 1-5 | Optimized, fast | None needed |
| 5,000-10,000 | 5-10 | Optimized, slight slowdown | Consider date filtering |
| 10,000-15,000 | 10-15 | Noticeable latency | Implement archiving |
| 15,000-20,000 | 15-20 | Approaching limit | Archiving required |
| >20,000 | >20 | Current limit | Server-side aggregation needed |