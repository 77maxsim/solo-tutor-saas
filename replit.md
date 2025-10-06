# TutorTrack - Tutoring Management System

## Overview

TutorTrack is a comprehensive tutoring management platform built with React and Supabase. The application enables tutors to manage students, schedule sessions, track earnings, and handle payments through an intuitive dashboard interface.

## System Architecture

**Frontend**: React + TypeScript with Vite
- Component-based architecture using React functional components
- State management via React Query (TanStack Query) for server state
- UI components built with Radix UI and styled with Tailwind CSS
- Client-side routing using Wouter

**Backend**: Express.js server with Supabase integration
- RESTful API endpoints for file uploads and data operations
- Server-side rendering in development via Vite middleware
- Authentication and data operations handled through Supabase client

**Database**: Supabase (PostgreSQL with real-time features)
- Row Level Security (RLS) policies for data access control
- Real-time subscriptions for live data updates
- File storage for avatar uploads

## Key Components

### Authentication System
- Supabase Auth integration with email/password authentication
- Protected routes with automatic redirection for unauthenticated users
- User profile management with timezone and currency preferences

### Data Management
- **Tutors**: User profiles linked to Supabase Auth users
- **Students**: Student records with tags, contact info, and avatars
- **Sessions**: Scheduled tutoring sessions with UTC timestamps
- **Payments**: Session payment tracking with automatic calculations

### Performance Optimization
- **Dataset Optimization System**: Automatically detects large datasets (500+ sessions) and switches to optimized queries
- **Query Strategies**: 
  - Standard queries use JOINs for smaller datasets
  - Optimized queries use separate fetches and client-side joining for large datasets
- **Performance Monitoring**: Query execution time tracking with alerts for slow operations

### Calendar Integration
- FullCalendar integration with multiple view modes (month, week, day)
- Timezone-aware session display using Luxon for date handling
- Drag-and-drop session scheduling and editing
- Mobile-responsive calendar views

## Data Flow

1. **Authentication**: Users authenticate via Supabase Auth, creating tutor records linked to auth.users
2. **Session Management**: Sessions stored with UTC timestamps, converted to tutor's timezone for display
3. **Real-time Updates**: Supabase subscriptions provide live updates across components
4. **Earnings Calculation**: Shared calculation logic processes session data for dashboard statistics
5. **File Uploads**: Avatar images uploaded to Supabase Storage with RLS policies

## External Dependencies

### Core Libraries
- **React Query**: Server state management and caching
- **Supabase**: Backend-as-a-Service for database, auth, and storage
- **FullCalendar**: Calendar component for session scheduling
- **Luxon**: Date and timezone handling
- **Radix UI**: Accessible UI components
- **Tailwind CSS**: Utility-first CSS framework

### Utility Libraries
- **React Hook Form**: Form state management with Zod validation
- **Canvas Confetti**: Success animations
- **React Beautiful DnD**: Drag-and-drop for dashboard customization
- **Day.js**: Additional date manipulation utilities

## Deployment Strategy

- **Development**: Vite dev server with Express middleware
- **Production**: Static build served by Express with client-side routing
- **Platform**: Configured for Replit deployment with autoscale
- **Environment**: Node.js 20 with PostgreSQL 16 module

## Changelog

### October 6, 2025: Telegram Bot Integration - COMPLETED
- **Daily Notifications**: Created telegram-notifications.js scheduler that sends 9 PM notifications with today's earnings and tomorrow's schedule
- **Real-time Booking Alerts**: Extended telegram-bot.js to send instant notifications when students book sessions through availability feature
- **Telegram Subscription**: Added subscription bot (telegram-bot.js) allowing tutors to subscribe via email through @classter_daily_bot
- **Profile Integration**: Added Telegram subscription section to Profile page with status display and bot link
- **Supabase Real-time Integration**: Added real-time listener for new sessions with status='pending' using Supabase subscriptions
- **Timezone-Aware Notifications**: All notifications (daily & booking) display date/time in tutor's local timezone using existing timezone logic
- **Rich Notification Format**: Messages include student name, session date/time, duration, expected earnings, and relevant context
- **Subscriber-Only**: All notifications sent only to tutors who have subscribed to the Telegram bot
- **API Endpoint**: Created /api/telegram/status endpoint to check tutor's subscription status
- **Unified Bot Script**: All Telegram functionality consolidated in single telegram-bot.js file for easier management

### September 17, 2025: Student Star/Favorite System Implementation - COMPLETED
- **Star/Favorite Functionality**: Added clickable star buttons next to each student name allowing tutors to mark favorite students
- **Favorites-First Sorting**: Starred students automatically appear at the top of the student list while preserving chosen sort order (earnings, name, sessions, etc.)
- **Visual Feedback**: Stars display as filled yellow when favorited, gray outline when not favorited, with hover states and transitions
- **Database Integration**: Added `is_favorite` boolean field to students table with proper Supabase integration and real-time updates
- **Optimistic Updates**: Star clicks respond immediately with optimistic UI updates, reverting on database errors
- **Accessibility Enhancement**: Added proper ARIA labels, button states, and screen reader support for star functionality
- **Error Handling**: Comprehensive error handling with user feedback and automatic cache invalidation on failures
- **React Performance**: Fixed React key issues to prevent DOM reuse problems during list reordering

### August 27, 2025: Rate Auto-Prefill in Edit Session Modal - COMPLETED
- **Smart Rate Prefill**: Successfully implemented rate auto-prefill functionality in Edit Session modal matching Schedule Session modal behavior
- **Database Integration**: Fixed query to use correct `rate` column name and `getCurrentTutorId()` helper function for proper tutor filtering
- **User Control**: Added Set-based field modification tracking to prevent override when user has manually typed in rate field
- **UI Enhancement**: Added "Suggested: $X from last session • Undo" helper text with restore functionality to original rate
- **Seamless UX**: Rate now auto-fills when student selection changes, unless user has already modified the rate field manually
- **Data Security**: Maintains existing RLS policies and tutor-scoped data access for secure rate retrieval

### July 30, 2025: Monthly Earnings Trend Chart Implementation - COMPLETED
- **Monthly Earnings Chart**: Successfully added comprehensive Monthly Earnings Trend Chart to Earnings page using Recharts
- **Data Aggregation**: Implemented efficient client-side monthly earnings calculation for last 6 months with paid sessions filtering
- **Visual Enhancement**: Created interactive line chart with custom tooltips, highlighted current month (pulsing dot), and percentage comparison badges
- **UI Improvements**: Added percentage change indicator to "Earnings This Month" card showing month-over-month growth
- **Chart Features**: Responsive design with formatted currency axis, smooth animations, and proper dark mode support
- **Code Organization**: Replaced "Earnings by Student" section with new chart component, maintaining clean component structure

### July 26, 2025: Real-time Updates & Calendar Modal Scroll Fix - COMPLETED
- **Hybrid Real-time System**: Successfully implemented robust combination of Supabase real-time subscriptions with polling fallbacks (10-25 second intervals)
- **Enhanced Reliability**: Dashboard components now use both WebSocket subscriptions and periodic data refresh to ensure updates work consistently
- **Calendar Modal Scroll Fix**: RESOLVED - Implemented comprehensive multi-layer scroll prevention system using body position locking, CSS classes, and FullCalendar configuration overrides
- **Multi-layer Solution**: Combined JavaScript styling, CSS classes, document element overflow prevention, and event listener scroll prevention for complete scroll lock
- **Improved UX**: Calendar now maintains perfect scroll position when scheduling sessions, completely eliminating disruptive page jumps during workflow

### July 19, 2025: Real-time Data Synchronization Implementation
- **Real-time ExpectedEarnings**: Added Supabase real-time subscription to ExpectedEarnings component for instant updates when session data changes
- **Real-time UnpaidSessions**: Enhanced UnpaidPastSessions component with filtered real-time subscription by tutor_id
- **Query Cache Invalidation**: Implemented proper cache invalidation using 'upcoming-sessions-expected' and 'unpaid-past-sessions' query keys
- **Tutor-scoped Subscriptions**: All subscriptions filter by current tutor ID using `tutor_id=eq.${tutorId}` for data privacy
- **Event Filtering**: Subscriptions listen for INSERT, UPDATE, DELETE events on sessions table for comprehensive real-time updates

### July 7, 2025: Fixed Sessions This Week Count and Weekly Delta
- **Session Count Fix**: Fixed "Sessions This Week" dashboard card to show actual weekly sessions instead of monthly sessions
- **Dynamic Weekly Delta**: Replaced hardcoded "+3 from last week" with dynamic calculation comparing current week vs previous week
- **Enhanced Earnings Calculator**: Extended shared earnings calculator to include weekly session counts and delta calculations
- **Timezone Awareness**: Weekly boundaries respect tutor's timezone settings for accurate week-start calculations
- **Smart Delta Display**: Shows "no change", positive deltas (+N), or negative deltas (-N) based on actual session comparison

### July 4, 2025: Mark All as Paid Feature Implementation
- **Bulk Payment Processing**: Added "Mark All as Paid" button to Earnings > Unpaid Sessions view
- **Smart Filtering**: Button only appears when unpaid sessions exist, filters past sessions using dayjs.utc().isAfter(session.session_end)
- **Direct Database Updates**: Uses Supabase .update() query with .in('id', sessionIds) for bulk operations
- **Safety Checks**: Added .eq('paid', false) filter to prevent duplicate updates
- **Enhanced UX**: Includes confirmation dialog, success confetti animation, and comprehensive error handling
- **Query Invalidation**: Automatically refreshes all related caches (unpaid sessions, dashboard stats, earnings)

### July 4, 2025: Session Persistence and Profile Timezone Fix
- **Session Persistence**: Fixed logout on page refresh by enabling `persistSession: true` and `autoRefreshToken: true` in Supabase client
- **Profile Timezone Save**: Fixed timezone not being saved when updating profile settings - added missing timezone field to update payload
- **Enhanced Logging**: Added detailed session restoration and timezone update logging for better debugging
- **Cache Invalidation**: Improved timezone cache invalidation to reflect changes throughout the app immediately

### July 1, 2025: Tutor Avatar Display on Student Booking Page
- **Avatar Integration**: Added tutor profile display with avatar and name at the top of student booking pages
- **Avatar Component**: Implemented shadcn/ui Avatar component with fallback to initials
- **Responsive Design**: Mobile-friendly avatar sizing (16x16 on mobile, 20x20 on desktop) with gradient backgrounds
- **Database Schema**: Tutor avatar_url column integration for profile image display
- **Professional Layout**: Enhanced booking page with tutor credentials and visual profile section

### June 29, 2025: Complete UTC Timestamp Migration & Booking System Fixes
- **UTC Migration**: Completed full migration from legacy date/time fields to session_start/session_end UTC timestamps
- **Booking System**: Fixed student booking page timezone conversion and form submission
- **Pending Requests**: Updated pending requests modal to work with new UTC timestamp schema
- **Error Handling**: Enhanced booking submission with proper field validation and decimal formatting
- **Calendar Integration**: Restored calendar slot selection functionality with animated loading indicators

### June 24, 2025: Core System Enhancements
- Fixed timezone mismatch in availability slot creation by ensuring proper timezone handling
- Fixed ghost session card bug and added session card hover animations
- Implemented animated loading indicators for calendar time slot selection
- Fixed duplicate schedule modal issue and unpaid sessions runtime bug  
- Initial setup and core functionality implementation

## User Preferences

Preferred communication style: Simple, everyday language.