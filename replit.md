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

### Technical Implementations
- **State Management**: React Query (TanStack Query) for server state management and caching.
- **Backend**: Express.js server for RESTful APIs.
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS) for data access control and real-time features.
- **Authentication**: Supabase Auth for email/password, with JWT for secure API access.
- **Data Handling**:
    - **Dataset Optimization System**: Dynamically switches query strategies based on dataset size for performance (500+ sessions threshold).
    - **UTC Timestamp Migration**: All session times are stored as UTC and converted to the tutor's local timezone for display.
    - **Real-time Updates**: Supabase subscriptions combined with polling for robust real-time data synchronization.
    - **Earnings Calculation**: Shared logic for calculating earnings and generating financial statistics.
    - **File Storage**: Supabase Storage for avatar uploads with RLS policies.
    - **Multi-Currency Support**: Currency conversion service with 24-hour caching for admin dashboard metrics.
    - **Query Timeout Protection**: 30-second timeout on all Supabase queries with proper abort signal handling to prevent hung requests.
    - **API Usage Monitoring**: Comprehensive tracking of ExchangeRate-API calls with monthly limits (1,500 requests) and 80% threshold warnings.
- **Notifications**: Telegram bot integration for daily summaries, booking alerts, and broadcast messages.
- **Error Tracking & Monitoring**: Sentry integration for comprehensive error tracking, performance monitoring, and session replay on both frontend and backend.
- **Admin Dashboard**: Comprehensive dashboard with KPIs, analytics charts, top tutors performance metrics, and multi-currency earnings conversion to USD.
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