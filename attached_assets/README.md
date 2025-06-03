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
- [x] Dashboard with stats cards (sessions, earnings, payments, students)
- [x] Recent activity feed component
- [x] Upcoming sessions widget
- [x] Mobile-first responsive design

### Epic 2: Session Scheduling ✅
- [x] Schedule Session modal with complete form validation
- [x] Student name, date, time, duration, and rate fields
- [x] Zod schema validation with error handling
- [x] Direct Supabase integration for data persistence
- [x] Success/error toast notifications

### Epic 3: Database Integration ✅
- [x] Supabase project configuration
- [x] Sessions table with proper schema
- [x] Real-time data insertion and retrieval
- [x] Environment variable configuration

### Epic 4: Data Display & Management
- [ ] Calendar view for session scheduling
- [ ] Students page with student management
- [ ] Earnings tracker with payment history
- [ ] Real-time dashboard data from Supabase

### Epic 5: Enhanced Features
- [ ] Session editing and cancellation
- [ ] Student profiles and contact information
- [ ] Payment tracking and invoicing
- [ ] Export functionality for reports

---

## 🏗️ Architecture

**Frontend Architecture:**
- React.js with TypeScript
- Component-based design with shadcn/ui
- Form validation using React Hook Form + Zod
- State management with TanStack Query
- Responsive design with Tailwind CSS

**Backend Architecture:**
- Supabase PostgreSQL database
- Direct client-to-database communication
- Real-time data synchronization
- Row Level Security (RLS) for data protection

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
   - Copy project URL and anon key
   - Create `sessions` table with required fields

2. **Environment Configuration:**
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Run Application:**
   - Use Replit's "Start application" workflow
   - Navigate to the provided URL
   - Begin scheduling sessions

---

## 📊 Database Schema

**Sessions Table:**
- id (uuid, primary key)
- student_name (text)
- date (date)
- time (text)
- duration (integer, minutes)
- rate (numeric)
- created_at (timestamp)

Future tables: students, payments, users

## 🤖 AI Coding Guidelines (for Replit / Vibe Coding)

- ✳️ Build in **incremental steps** – avoid large, monolithic prompts.
- 🔄 **Use minimal code changes** when adding new features.
- ♻️ **Reuse existing components** where possible (e.g., shadcn buttons, modals).
- 📦 Keep **Supabase integration** modular and consistent across files.
- 👁️ Prioritize **code readability and maintainability**.
- 🧪 Do **not auto-generate test data** unless requested.
- 🗂️ Add inline comments to explain any non-obvious logic.
