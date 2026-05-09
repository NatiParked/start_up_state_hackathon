# Section: UI Criteria — Phase 3 Submission Queue & Company CRUD

**Started:** 2026-05-09T17:15:00Z
**Completed:** 2026-05-09T17:17:00Z
**Results:** 0 passed | 0 failed | 5 skipped | 0 blocked

---

## Context

All admin routes (`/admin`, `/admin/submissions`, `/admin/companies`) redirect to `/admin/login`. An admin session is required to test any of the UI criteria. A magic link was attempted for `cayden@sempurnadev.com` but Supabase returned HTTP 429 (email rate limit exceeded) — no session could be established. All five criteria are therefore SKIP.

**Auth guard confirmed working:** Navigating directly to `/admin/submissions` and `/admin/companies` both redirected to `/admin/login` — the route protection is in place.

**Magic link wiring confirmed working:** The browser attempted `https://punpjzwxqazqbxvkyemv.supabase.co/auth/v1/otp?redirect_to=http://localhost:5173/admin/dashboard` and received a 429 (rate limit), meaning the form submit correctly calls the Supabase OTP endpoint with the correct redirect target.

---

## Results

### [SKIP] C1 — `/admin/submissions` lists every pending row; clicking a row opens SubmissionReview with extracted fields and website preview

**Reason:** Redirected to `/admin/login` — no admin session. Magic link attempt returned HTTP 429 (email rate limit exceeded).

---

### [SKIP] C2 — Clicking Approve moves submission to `map_startups` and marks it `approved` with `reviewed_by` set; row disappears from queue

**Reason:** Redirected to `/admin/login` — no admin session. Also marked *(SKIP if data mutation not safe)* in the checklist.

---

### [SKIP] C3 — Clicking Reject with a typed reason marks the submission `rejected` with `rejection_reason` persisted; row disappears from queue

**Reason:** Redirected to `/admin/login` — no admin session. Also marked *(SKIP if data mutation not safe)* in the checklist.

---

### [SKIP] C4 — `/admin/companies` lists all `map_startups` rows; search box filters by name in real time; column headers sort the table

**Reason:** Redirected to `/admin/login` — no admin session. Magic link attempt returned HTTP 429 (email rate limit exceeded).

---

### [SKIP] C5 — Editing any field in CompanyEditor and clicking Save persists the change to Supabase

**Reason:** Redirected to `/admin/login` — no admin session. Also marked *(SKIP if data mutation not safe)* in the checklist.

---

## Evidence

- Screenshot of login page with "email rate limit exceeded" message: `login-rate-limited.png`
- Console error confirming 429 from Supabase: `https://punpjzwxqazqbxvkyemv.supabase.co/auth/v1/otp?redirect_to=http%3A%2F%2Flocalhost%3A5173%2Fadmin%2Fdashboard`
- 404 on `/favicon.ico` is unrelated and pre-existing

## Observable Positives (no session needed)

- Auth guard correctly protects all admin routes — 3/3 routes tested redirect to `/admin/login`
- Login page renders correctly with heading "Admin Sign In", email field, and "Send magic link" button
- Magic link form correctly calls Supabase OTP endpoint with `redirect_to=http://localhost:5173/admin/dashboard`
