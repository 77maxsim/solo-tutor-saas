# TutorTrack - Tutoring Management System

## Overview

TutorTrack is a comprehensive tutoring management platform designed for tutors to efficiently manage students, schedule sessions, track earnings, and process payments. Built with React and Supabase, it offers an intuitive dashboard to streamline tutoring operations. The platform aims to simplify administrative tasks, allowing tutors to focus more on teaching, and includes features like an admin dashboard for overall system monitoring and Telegram notifications for real-time updates.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React + TypeScript with Vite.
- **Component Library**: Radix UI for accessible components, styled with Tailwind CSS.
- **Routing**: Wouter for client-side navigation.
- **Calendar**: FullCalendar integration with multiple view modes, drag-and-drop scheduling, and mobile responsiveness.
- **Theming**: Support for dark mode.

### Technical Implementations
- **State Management**: React Query (TanStack Query) for server state management and caching.
- **Backend**: Express.js server for RESTful APIs, integrated with Supabase.
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS) for data access control and real-time features.
- **Authentication**: Supabase Auth for email/password, with JWT for secure API access, especially for admin functionalities.
- **Data Handling**:
    - **Dataset Optimization System**: Dynamically switches query strategies based on dataset size for performance.
    - **UTC Timestamp Migration**: All session times are stored as UTC and converted to the tutor's local timezone for display.
    - **Real-time Updates**: Supabase subscriptions combined with polling for robust real-time data synchronization.
    - **Earnings Calculation**: Shared logic for calculating earnings and generating financial statistics.
    - **File Storage**: Supabase Storage for avatar uploads with RLS.
    - **Multi-Currency Support**: Currency conversion service using ExchangeRate-API with 24-hour caching for admin dashboard metrics.
- **Notifications**: Telegram bot integration for daily summaries, booking alerts, and broadcast messages to subscribed tutors.
- **Error Tracking & Monitoring**: Sentry integration for comprehensive error tracking, performance monitoring, and session replay on both frontend and backend with automatic user context attribution.
- **Admin Dashboard**: Comprehensive dashboard with KPIs, analytics charts (e.g., weekly earnings trend), top tutors performance metrics, and multi-currency earnings conversion to USD.
- **Student Management**: Features like favoriting students and an optimized student list display.
- **Session Management**: Smart rate prefill in session modals and bulk actions for marking sessions as paid.
- **Health Monitoring**: Health check endpoint (`/api/health`) for uptime monitoring and application status tracking.
- **Rate Limiting**: Implemented `express-rate-limit` and `express-slow-down` for DDoS protection and API abuse prevention.
- **Security Headers**: Helmet middleware for comprehensive security headers.
- **CORS Configuration**: Properly configured CORS with credentials support and origin validation.
- **Request Size Limits**: Limited JSON body size to 200kb.

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
- **Recharts**: For charting and data visualization.
- **Day.js**: Lightweight date manipulation library.
- **Telegram Bot API**: For sending notifications and broadcast messages.
- **ExchangeRate-API**: Currency conversion service for admin dashboard.
- **Sentry**: Error tracking and performance monitoring for both frontend and backend.
- **express-rate-limit**: Middleware for rate limiting.
- **express-slow-down**: Middleware for slowing down responses.
- **Helmet**: Middleware for setting security-related HTTP headers.