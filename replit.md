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
- **Security**: RLS, JWT validation, and admin authorization middleware to protect sensitive data and operations.

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
