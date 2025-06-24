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

- June 24, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.