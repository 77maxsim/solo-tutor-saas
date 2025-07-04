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