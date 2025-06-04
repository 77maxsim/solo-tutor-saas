# 📚 TutorTrack

A comprehensive tutor management platform designed to streamline scheduling, earnings tracking, and student management for educational professionals. Built with React, Supabase, and shadcn/ui components.

---

## 🛠️ Tech Stack

- **Frontend**: React.js with Vite
- **Database**: Supabase (PostgreSQL)
- **UI Components**: shadcn/ui component library
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod validation
- **State Management**: TanStack Query
- **Platform**: Replit

---

## ✅ Feature Progress

### Epic 1: Core Dashboard ✅
- [x] Responsive sidebar navigation with mobile support
- [x] Dashboard with real-time stats cards (sessions, earnings, payments, students)
- [x] Recent activity feed with session and student data
- [x] Upcoming sessions widget with student names
- [x] Unpaid past sessions tracking
- [x] Mobile-first responsive design
- [x] Personalized welcome message with tutor's full name

### Epic 2: Authentication & User Management ✅
- [x] Complete signup/login flow with email/password
- [x] Full name collection during signup
- [x] Supabase Auth integration with proper session handling
- [x] Comprehensive route protection for all authenticated pages
- [x] Conditional UI rendering based on authentication state
- [x] Query cache clearing on logout to prevent data leakage
- [x] Automatic tutor profile creation with user linking

### Epic 3: Session Scheduling ✅
- [x] Schedule Session modal with complete form validation
- [x] Student selection with existing student lookup
- [x] Date, time, duration, and rate fields with proper validation
- [x] Zod schema validation with comprehensive error handling
- [x] Real-time session creation and updates
- [x] Success/error toast notifications

### Epic 4: Database Integration & Security ✅
- [x] Supabase project configuration with Row Level Security
- [x] Complete database schema (tutors, students, sessions)
- [x] Data isolation between user accounts using RLS policies
- [x] Real-time data synchronization across all components
- [x] Proper foreign key relationships and constraints
- [x] Environment variable configuration

### Epic 5: Data Display & Management ✅
- [x] Calendar view with react-big-calendar integration
- [x] Students page with comprehensive student analytics
- [x] Earnings tracker with monthly comparisons and trends
- [x] Real-time dashboard data from Supabase with filtering
- [x] Session management with payment status tracking

### Epic 6: Enhanced Features (Future)
- [ ] Session editing and cancellation
- [ ] Advanced student profiles and contact information
- [ ] Payment tracking and invoicing system
- [ ] Export functionality for reports and analytics

---

## 🏗️ Architecture

**Frontend Architecture:**
- React.js with TypeScript
- Component-based design with shadcn/ui
- Form validation using React Hook Form + Zod
- State management with TanStack Query
- Responsive design with Tailwind CSS

**Backend Architecture:**
- Supabase PostgreSQL database with authentication
- Direct client-to-database communication
- Real-time data synchronization with live updates
- Row Level Security (RLS) for complete data isolation between users
- Comprehensive foreign key relationships and constraints

**Data Flow:**
1. User interacts with React components
2. Forms validate data using Zod schemas
3. Supabase client handles database operations
4. TanStack Query manages caching and state
5. UI updates reactively with fresh data

---

## 🚀 Setup Instructions

1. **Supabase Project Setup:**
   - Create account at https://supabase.com
   - Create new project
   - Copy project URL, anon key, and service role key from Settings > API
   - Enable Row Level Security and configure authentication
   - Database tables will be created automatically during first signup

2. **Environment Configuration:**
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Run Application:**
   - Use Replit's "Start application" workflow
   - Navigate to the provided URL
   - Create account with full name during signup
   - Begin managing tutoring sessions with complete data isolation

---

## 📊 Database Schema

**Tutors Table:**
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- email (text)
- full_name (text)
- created_at (timestamp)

**Students Table:**
- id (uuid, primary key)
- name (text)
- tutor_id (uuid, foreign key to tutors)
- created_at (timestamp)

**Sessions Table:**
- id (uuid, primary key)
- student_id (uuid, foreign key to students)
- tutor_id (uuid, foreign key to tutors)
- date (date)
- time (text)
- duration (integer, minutes)
- rate (numeric)
- paid (boolean, default false)
- created_at (timestamp)

**Row Level Security (RLS) Policies:**
- Complete data isolation between user accounts
- Users can only access their own tutors, students, and sessions
- Authentication-based access control

---

## 🔒 Security Features

- **Route Protection**: All authenticated pages protected with automatic redirect to login
- **Data Isolation**: Row Level Security ensures users only see their own data
- **Session Management**: Proper authentication state handling with cache clearing on logout
- **Form Validation**: Comprehensive client-side validation with Zod schemas
- **Environment Security**: Sensitive keys stored as environment variables

## 🌟 Key Features

- **Real-time Dashboard**: Live statistics with session counts, earnings, and student metrics
- **Calendar Integration**: Visual session scheduling with react-big-calendar
- **Student Management**: Comprehensive student analytics and session tracking
- **Earnings Tracking**: Monthly comparisons with trend analysis
- **Mobile Responsive**: Optimized for desktop and mobile devices
- **Toast Notifications**: User-friendly feedback for all actions

## 🤖 AI Coding Guidelines (for Replit / Vibe Coding)

- ✳️ Build in **incremental steps** – avoid large, monolithic prompts.
- 🔄 **Use minimal code changes** when adding new features.
- ♻️ **Reuse existing components** where possible (e.g., shadcn buttons, modals).
- 📦 Keep **Supabase integration** modular and consistent across files.
- 👁️ Prioritize **code readability and maintainability**.
- 🧪 Do **not auto-generate test data** unless requested.
- 🗂️ Add inline comments to explain any non-obvious logic.
