# 📚 Solo Tutor SaaS

A lightweight scheduling and income tracking web app for solo language tutors. Built with Replit, Supabase, and shadcn/ui. The goal is to provide an elegant dashboard where tutors can plan lessons and see their earnings in real-time.

---

## 🛠️ Tech Stack

- **Frontend**: React or Next.js (on Replit)
- **Backend**: Supabase (Auth + Database)
- **Styling/UI**: shadcn/ui components
- **Platform**: Replit + GitHub
- **Approach**: Vibe coding in small, testable increments

---

## ✅ Feature Backlog

### Epic 1: Core Setup
- [x] Initialize Replit project with folders and dependencies
- [x] Set up Supabase project and connect to Replit
- [x] Implement user authentication (sign-up, log-in)

### Epic 2: Scheduling System
- [ ] Create weekly calendar UI to display upcoming classes
- [ ] Add modal form to schedule a new class (student, date, time, duration)
- [ ] Save scheduled classes to Supabase
- [ ] Enable editing/deleting of existing classes

### Epic 3: Earnings Tracker
- [ ] Table of completed classes with payment info
- [ ] Summary cards: total earned today / this week / this month
- [ ] Forecast income from scheduled future classes

### Epic 4: UI & UX Polish
- [ ] Apply shadcn/ui components to forms, buttons, and cards
- [ ] Responsive layout for mobile/tablet
- [ ] Add empty states and loading indicators

### Epic 5: Testing & Deployment
- [ ] Create test data or simulate usage flow
- [ ] Resolve bugs and edge cases
- [ ] Connect GitHub and optionally deploy via Vercel

---

## 🤖 AI Coding Guidelines (for Ghostwriter / Vibe Coding)

- ✳️ Build in **incremental steps** – avoid large, monolithic prompts.
- 🔄 **Use minimal code changes** when adding new features.
- ♻️ **Reuse existing components** where possible (e.g., shadcn buttons, modals).
- 📦 Keep **Supabase integration** modular and consistent across files.
- 👁️ Prioritize **code readability and maintainability**.
- 🧪 Do **not auto-generate test data** unless requested.
- 🗂️ Add inline comments to explain any non-obvious logic.

---

## 🚀 How to Run

1. Fork this Replit
2. Create a Supabase project:
   - Add `users`, `classes`, and `payments` tables
3. Set up your `.env` file with Supabase credentials
4. Start the app using the Replit run button

---

## 📓 Dev Notes

This project is being built solo with a focus on learning and real-world product management practice. Each feature is implemented and tested individually to ensure clean, bug-free development.

