# Classterly — Improvement Suggestions

A prioritized audit of issues found across the codebase. Items are grouped by impact, with file references where applicable.

---

## 🔴 Critical — Security & Data Integrity

### 1. Missing authentication on tutor-scoped API routes
Several backend endpoints accept a `:tutorId` URL parameter and return that tutor's data without verifying that the requester is the same tutor (or an admin). Anyone who can guess a tutor ID can read their data.

- `GET /api/dashboard/stats/:tutorId`
- `GET /api/students/:tutorId`
- `GET /api/sessions/:tutorId`
- `GET /api/payments/:tutorId`
- Several Google Calendar sync endpoints

**Fix:** Apply the existing `authenticateUser` middleware to every tutor-scoped route, then verify `req.user.id === tutorId` (or an admin role) before returning data.

### 2. Avatar upload trusts client-supplied user ID
`POST /api/upload/avatar` reads `userId` from the request body instead of the authenticated session, so any signed-in user can overwrite another tutor's avatar.

**Fix:** Ignore `req.body.userId` and use `req.user.id` from the session.

### 3. Telegram bot daily-notification check is non-atomic
`server/telegram.ts` (around lines 330–350) reads the "last notification sent" flag, then writes it back later. Two concurrent ticks can both read "not sent yet" and send the message twice.

**Fix:** Use a single conditional UPDATE (`UPDATE ... WHERE last_sent < today RETURNING ...`) and only send when the row is actually updated.

---

## 🟠 Bugs

### 4. Recurring-session creation is not transactional
`client/src/components/modals/session-details-modal.tsx` (lines ~108–162) creates 12 future sessions in one insert and then updates the original session in a separate statement. If the second call fails, you end up with orphaned future sessions and an inconsistent series.

**Fix:** Move this into a single backend route wrapped in a Postgres transaction (or a Supabase RPC), so both writes succeed or both roll back.

### 5. Google Calendar sync has no retry on transient failures
`server/googleCalendarSync.ts` (around lines 331 and 397) makes Google API calls with no retry logic. A single 5xx or rate-limit response leaves the local session out of sync with Google Calendar until the next manual edit.

**Fix:** Wrap Google API calls in a small retry helper with exponential backoff (e.g. 3 attempts at 500 ms / 1 s / 2 s) and only mark a sync failed after all retries fail. Log the failure and surface it in the UI.

### 6. Admin metrics N+1 currency conversion
`server/routes.ts` (around lines 521–527) converts each tutor's earnings to USD one-by-one inside a loop, hitting the FX rate source repeatedly.

**Fix:** Fetch the rate table once at the top of the handler and reuse it for all rows.

---

## 🟡 UX & Frontend Polish

### 7. Duplicated route-protection wrappers in App.tsx
`client/src/App.tsx` (lines ~93–597) defines 10+ near-identical `Protected*` wrapper components, one per page. This is repetitive and easy to forget when adding a new route.

**Fix:** Create a single generic `<ProtectedRoute>` component (or a `requireAuth(Page)` HOC) and use it for every authenticated route.

### 8. Calendar font sizes are too small on mobile
`client/src/index.css` (lines ~440–481) drops calendar text to 8–11 px on screens under 640 px, which is below the WCAG-recommended minimum and hard to read.

**Fix:** Raise the mobile minimums to ~12–14 px, and rely on the `listWeek` (agenda) view as the default on small screens, where day/event labels have more room.

### 9. Hardcoded gray colors instead of semantic tokens
Many components use raw Tailwind grays (`text-gray-500`, `bg-gray-100`, etc.) instead of the theme tokens (`text-muted-foreground`, `bg-muted`, etc.). This makes dark-mode and theming inconsistent.

**Fix:** Sweep components and replace hardcoded grays with the matching semantic token from `index.css`.

### 10. Route-transition spinner flash
The full-page loading spinner shown during route transitions appears even for instant transitions, causing a brief flash.

**Fix:** Delay the spinner by ~150 ms (only show it if the transition takes longer than that), or use Suspense fallbacks scoped to the page contents.

### 11. Console noise in production
Several pages (calendar, earnings, session-details modal) log heavily with `console.log` in normal flow. This pollutes the production browser console and leaks internal state.

**Fix:** Gate verbose logs behind `import.meta.env.DEV`, or strip `console.log` at build time via the Vite config.

---

## 🟢 Feature Ideas

### 12. Invoicing
Generate downloadable PDF invoices per student for a given month or date range, including session list, rate breakdown, and totals.

### 13. Stripe "Pay Now" links
Let tutors send a Stripe Checkout link with each invoice or session reminder so parents can pay online instead of by manual transfer.

### 14. Student / parent portal
A read-only login for students or parents to see upcoming sessions, past notes, and outstanding balances. Reduces back-and-forth messaging.

### 15. Lesson resource sharing
Attach files (PDFs, worksheets, links) to a session or to a student profile, accessible from both sides.

### 16. Cancellation / no-show policy
Configurable rules so a no-show or late cancellation is automatically flagged as billable per the tutor's policy.

---

## ⚪ Foundational

### 17. No automated tests
The project currently relies only on `tsc` for type-checking. There are no unit or end-to-end tests, so regressions in scheduling, recurrence, payments, or auth can ship unnoticed.

**Fix:** Start small — add Playwright tests for the critical flows (login, schedule a session, mark paid, recurring series edit) and a few Vitest tests around the date and currency utility functions. Wire them into CI.

### 18. Loose typing in backend and earnings page
`server/routes.ts` and `client/src/pages/earnings.tsx` use `any` in many places, which defeats TypeScript's safety net.

**Fix:** Replace `any` with the existing types from `shared/schema.ts` (or define new ones), particularly for request/response bodies on the server and for session/aggregation data on the earnings page.

---

## Suggested order of work

1. Items 1–3 (auth gaps and double-send race) — these are user-data and trust issues, should ship first.
2. Items 4–6 (data integrity and reliability bugs).
3. Items 17–18 (tests + types) — pays back across everything else.
4. Items 7–11 (UX polish) in parallel, as bandwidth allows.
5. Items 12–16 (new features) once the foundation is solid.
