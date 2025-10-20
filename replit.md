# TutorTrack - Tutoring Management System

## Overview

TutorTrack is a comprehensive tutoring management platform designed for tutors to efficiently manage students, schedule sessions, track earnings, and process payments. Built with React and Supabase, it offers an intuitive dashboard to streamline tutoring operations. The platform aims to simplify administrative tasks, allowing tutors to focus more on teaching, and includes features like an admin dashboard for overall system monitoring and Telegram notifications for real-time updates.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React + TypeScript with Vite for a fast development experience.
- **Component Library**: Radix UI for accessible components, styled with Tailwind CSS for utility-first styling.
- **Routing**: Wouter for client-side navigation.
- **Calendar**: FullCalendar integration with multiple view modes, drag-and-drop scheduling, and mobile responsiveness.
- **Theming**: Support for dark mode.

### Technical Implementations
- **State Management**: React Query (TanStack Query) for server state management and caching.
- **Backend**: Express.js server for RESTful APIs, integrated with Supabase.
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS) for data access control and real-time features.
- **Authentication**: Supabase Auth for email/password authentication, with JWT-based authentication for secure API access, especially for admin functionalities.
- **Data Handling**:
    - **Dataset Optimization System**: Dynamically switches query strategies (JOINs vs. separate fetches with client-side joining) based on dataset size for performance.
    - **UTC Timestamp Migration**: All session times are stored as UTC and converted to the tutor's local timezone for display.
    - **Real-time Updates**: Supabase subscriptions combined with polling for robust real-time data synchronization across components.
    - **Earnings Calculation**: Shared logic for calculating earnings and generating financial statistics.
    - **File Storage**: Supabase Storage for avatar uploads with RLS.
    - **Multi-Currency Support**: Currency conversion service using ExchangeRate-API with 24-hour caching for admin dashboard metrics.
- **Notifications**: Telegram bot integration for daily summaries, booking alerts, and broadcast messages to subscribed tutors.
- **Admin Dashboard**: Comprehensive dashboard with KPIs, analytics charts (e.g., weekly earnings trend), top tutors performance metrics, and multi-currency earnings conversion to USD.
- **Student Management**: Features like favoriting students and an optimized student list display.
- **Session Management**: Smart rate prefill in session modals and bulk actions for marking sessions as paid.

### System Design Choices
- **Component-based architecture** for modularity and reusability.
- **RESTful API endpoints** for clear data operations.
- **Performance monitoring** for query execution times.
- **Security**: RLS, JWT validation, admin authorization middleware, and comprehensive rate limiting to protect sensitive data and operations from abuse.

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
- **Recharts**: For charting and data visualization (e.g., monthly earnings trend).
- **Day.js**: Lightweight date manipulation library.
- **Telegram Bot API**: For sending notifications and broadcast messages.
- **ExchangeRate-API**: Currency conversion service for admin dashboard (free tier: 1,500 requests/month).

## Recent Changes

### October 20, 2025: Telegram Notification Reliability Improvements - COMPLETED
- **Expanded Notification Window**: Increased daily notification window from 3 minutes (21:00-21:02) to 1 hour (21:00-21:59)
  - Dramatically reduces the chance of missing notifications due to server restarts or brief downtimes
  - Server has 60x more opportunities to send notifications each day
  - Duplicate prevention via database `last_daily_notification_date` column ensures notifications sent only once per day
- **Comprehensive Diagnostic Logging**: Added detailed logging throughout the entire notification flow:
  - System time and notification window information at start of each check cycle
  - Per-tutor evaluation showing: local time, timezone, last notification date, and window status
  - Database operations: Telegram message sending, database updates, success/failure states
  - Structured logging with tutor names in brackets for easy filtering (e.g., `[Max]`, `[Natalia Pikulia]`)
  - Clear decision logging: "IN NOTIFICATION WINDOW" vs "Outside window" with hour comparisons
  - Database update confirmations and error details
- **Smart Cache Reset**: Updated resetDailyCache to use the new 1-hour window when checking if tutors are in notification period
- **Improved Debugging**: Logs now provide complete visibility into notification system behavior, making it easy to diagnose any future issues by checking logs around 9 PM

### October 15, 2025: Rate Limiting & DDoS Protection Implementation - COMPLETED
- **Comprehensive Rate Limiting**: Implemented express-rate-limit and express-slow-down middleware to protect all API endpoints from abuse and DDoS attacks
  - **Auth/Sensitive Routes** (`/api/upload`, `/api/telegram`): 5 requests per 15 minutes with slowdown after 3 requests
  - **Sessions Routes** (`/api/sessions`): 100 requests per 15 minutes (IP-based)
  - **Admin Routes** (`/api/admin/*`): 50 requests per 15 minutes with per-user tracking (applied AFTER authentication for accurate user-based limits)
  - **Public Routes** (`/api/students`, `/api/payments`, `/api/dashboard`): 20 requests per minute
  - **Global Fallback**: 120 requests per minute for all other API routes
- **Security Headers**: Added Helmet middleware for comprehensive security headers (HSTS, X-Frame-Options, Content-Security-Policy, etc.)
- **CORS Configuration**: Properly configured CORS with credentials support and origin validation
- **Request Size Limits**: Limited JSON body size to 200kb to prevent large payload attacks
- **Trust Proxy**: Enabled trust proxy for proper IP detection behind Replit's infrastructure
- **Error Handling**: Implemented proper 429 status responses with clear error messages for rate limit violations
- **Architecture**: Centralized rate limiter configurations in `server/rateLimiters.ts` for maintainability
- **Per-User Rate Limiting**: Admin routes correctly track limits per authenticated user ID, with automatic fallback to IP-based limiting for unauthenticated requests
- **IPv6 Support**: Rate limiters properly handle IPv6 addresses with validation disabled where appropriate
- **Tested & Verified**: All rate limiters validated with automated tests confirming proper limits, headers, and slowdown behavior

### October 15, 2025: Telegram Bot Reliability & Duplicate Prevention Fixes - COMPLETED
- **Fixed TypeScript Null Safety Errors**: Added proper null checks in telegram message handler to prevent runtime crashes
- **Duplicate Booking Notifications Fix**: Implemented duplicate prevention for booking notifications using a Set to track sent notifications by session ID
- **Missing Daily Reports Fix**: 
  - Changed from exact minute check (21:00) to 3-minute time window (21:00-21:02) to avoid missing notifications
  - Smart cache reset that checks if any tutor is in notification window before clearing, delays by 5 minutes if needed
- **Database Persistence for Notifications** (requires migration):
  - Added `last_daily_notification_date` column to tutors table for persistent duplicate prevention
  - Graceful fallback to in-memory cache if column doesn't exist (pre-migration)
  - Detects PostgreSQL error 42703 (column not found) and falls back automatically
  - Post-migration: Daily notifications survive server restarts without duplicates
  - Pre-migration: Works with in-memory cache (slight duplicate risk on restart during window)
- **Migration Required**: Run `add-notification-tracking-column.sql` in Supabase SQL Editor to enable full persistence
- **Files**: See `TELEGRAM_FIX_README.md` for detailed migration instructions

### October 10, 2025: Enhanced Telegram Daily Notifications with Unpaid Sessions - COMPLETED
- **Unpaid Session Tracking in Notifications**: Enhanced daily 9 PM Telegram notifications to include payment status information
  - Added "Today's Unpaid Sessions" section showing individual unpaid sessions from the current day with student names, times, and amounts
  - Added "Past Unpaid Sessions" summary displaying count and total amount of overdue sessions from previous days
  - Conditional display: sections only appear when unpaid sessions exist, avoiding clutter
  - All amounts formatted in tutor's preferred currency with timezone-aware time display
  - Helps tutors track outstanding payments and follow up on overdue invoices

### October 9, 2025: Admin Dashboard with Enhanced Security & Multi-Currency Support - COMPLETED
- **Admin Dashboard**: Created comprehensive admin dashboard with KPI cards (total tutors, active students, sessions this week, total earnings, unpaid sessions)
- **Analytics Charts**: Added weekly earnings trend chart and top tutors table showing performance metrics
- **Multi-Currency Conversion**: Implemented automatic currency conversion to USD for all admin dashboard metrics
  - Created currency conversion service using ExchangeRate-API with 24-hour caching
  - All tutor earnings (UAH, RMB, CNY, etc.) automatically converted to USD in admin views
  - Individual tutors continue to see earnings in their own currency
  - Admin metrics, earnings trends, and top tutors rankings all display in normalized USD
  - UI clearly indicates conversion with "(USD)" labels and "All currencies converted" notes
- **Telegram Broadcast**: Implemented broadcast messaging feature to send messages to all subscribed users via Telegram bot
- **JWT Authentication**: Implemented secure JWT-based authentication middleware that validates Supabase access tokens
- **Authorization Layer**: Added admin authorization middleware checking is_admin status before allowing admin operations
- **Security Enhancement**: Replaced insecure client-supplied userId parameters with server-side JWT validation to prevent privilege escalation
- **Protected Endpoints**: All admin API routes (metrics, earnings-trend, top-tutors, broadcast) now require both valid JWT and admin role
- **Frontend Security**: Updated queryClient to automatically include Authorization: Bearer header in all admin API requests
- **Dual Access**: Admin account (77maxsim@gmail.com) has access to both admin dashboard and regular tutor functionality
- **Bot Lifecycle**: Integrated Telegram bot into main server with graceful error handling for 409 polling conflicts during development
