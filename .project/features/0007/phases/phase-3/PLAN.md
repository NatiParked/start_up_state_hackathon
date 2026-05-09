# Phase 3 Plan: Subscribe View & Confirmation Flow

## Objective

Replace the `/subscribe` PlaceholderView with a real subscription form that captures email + filter preferences, sends a Resend double opt-in confirmation email, and finalizes the opt-in via a dedicated Edge Function that flips `confirmed = true`.

## Must-Haves (Goal-Backward)

1. **Real form replaces PlaceholderView** — `/subscribe` route lazy-loads `SubscribeView.vue` (route name `'Subscribe'` preserved).
2. **Subscription persists** — Submitting form inserts a row into `map_subscriptions` with `confirmed = false`, non-null `confirm_token`, and `filter_criteria` JSONB matching the chosen sectors/stages/regions/hiring/investor.
3. **Confirmation email sent** — `send-confirmation` Edge Function sends a Resend email containing a confirm link `<SUPABASE_URL>/functions/v1/confirm-subscription?token=<confirm_token>`.
4. **Confirm link works** — `confirm-subscription` Edge Function (GET) flips `confirmed = true` and redirects to `/subscribe?confirmed=true`; handles invalid/already-confirmed tokens by redirecting to `?error=invalid` and `?confirmed=already`.
5. **Unsubscribe + duplicate handling** — `?unsubscribe=<id>` deletes the row and shows a confirmation; duplicate email submission shows "already subscribed" without inserting a duplicate row.

## Tasks

### Task 1: Create `confirm-subscription` Edge Function
**Sequence:** 1 (parallel with Task 2)
**Files:**
- `supabase/functions/confirm-subscription/index.js` — create

**Action:**
Create a Deno edge function that handles GET requests with a `?token=<confirm_token>` query param. Use the shared service-role client and follow the exact CORS + `errorResponse` pattern from `supabase/functions/send-digest/index.js` (semicolons, `corsHeaders`, `jsonResponse`, `errorResponse`).

Behavior:
1. CORS preflight: respond 204 with `corsHeaders` on `OPTIONS`.
2. Method guard: only allow `GET`; otherwise `errorResponse('method_not_allowed', 'method_not_allowed', 405)`.
3. Read `token` from `new URL(req.url).searchParams.get('token')`.
4. Compute `siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? 'http://localhost:5173'` and a helper `redirect(path)` that returns `new Response(null, { status: 302, headers: { ...corsHeaders, Location: `${siteUrl}${path}` } })`.
5. If no `token` → `redirect('/subscribe?error=invalid')`.
6. Use `createAdminClient()` from `../_shared/supabaseAdmin.js` and query `map_subscriptions` by `confirm_token = token` (`.maybeSingle()`).
7. If not found → `redirect('/subscribe?error=invalid')`.
8. If `row.confirmed === true` → `redirect('/subscribe?confirmed=already')`.
9. Otherwise `update map_subscriptions set confirmed = true where confirm_token = token`, then `redirect('/subscribe?confirmed=true')`.
10. Wrap in `try/catch` returning `errorResponse('internal_error', err.message ?? 'internal_error', 500)`.

Imports: `import { createAdminClient } from '../_shared/supabaseAdmin.js';`

**Verify:**
1. File exists: `supabase/functions/confirm-subscription/index.js`.
2. Manual: `curl -i 'http://localhost:54321/functions/v1/confirm-subscription?token=bad'` returns `302` with `Location: .../subscribe?error=invalid`.
3. Manual: insert a row with a known `confirm_token`, hit endpoint with that token, confirm `302 -> /subscribe?confirmed=true` and that the row's `confirmed` column is now `true`.
4. Hitting the same valid token a second time returns `302 -> /subscribe?confirmed=already`.

**Done when:** Function deployed (or runnable via `supabase functions serve`) and the four redirect paths above behave correctly against `map_subscriptions`.

---

### Task 2: Create `send-confirmation` Edge Function
**Sequence:** 1 (parallel with Task 1)
**Files:**
- `supabase/functions/send-confirmation/index.js` — create

**Action:**
Create a Deno edge function that accepts a POST with JSON body `{ email: string }` and sends a Resend confirmation email. Mirror the CORS / `jsonResponse` / `errorResponse` pattern from `send-digest/index.js`.

Behavior:
1. CORS preflight on `OPTIONS`.
2. Method guard: POST only, else 405.
3. Parse `const { email } = await req.json();`. Return `errorResponse('bad_request', 'email required', 400)` if missing.
4. `const adminClient = createAdminClient();`
5. Query: `await adminClient.from('map_subscriptions').select('id, confirm_token').eq('email', email).maybeSingle();` — if not found, `errorResponse('not_found', 'email not found', 400)`.
6. Defer-validate `RESEND_API_KEY` (read with `Deno.env.get`, throw if missing only on the send path — same pattern as `send-digest`).
7. Read `RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'` and `SUPABASE_URL = Deno.env.get('SUPABASE_URL')`.
8. Build confirm URL: `${SUPABASE_URL}/functions/v1/confirm-subscription?token=${row.confirm_token}`.
9. Build HTML body with a prominent button link styled inline (use `utah-blue` hex `#0d3b66` for the button background — matches Tailwind brand token). Include subject `'Confirm your Utah Startup Map subscription'`.
10. POST to `https://api.resend.com/emails` with `Authorization: Bearer ${RESEND_API_KEY}`, payload `{ from: 'Utah Startup Map <${RESEND_FROM_EMAIL}>', to: email, subject, html }`.
11. If Resend response not ok → `errorResponse('resend_error', 'resend_error: <status> <body>', 500)`.
12. On success → `jsonResponse({ ok: true }, 200)`.
13. Outer try/catch returns 500.

Imports: `import { createAdminClient } from '../_shared/supabaseAdmin.js';`

**Verify:**
1. File exists: `supabase/functions/send-confirmation/index.js`.
2. `curl -X POST http://localhost:54321/functions/v1/send-confirmation -H 'Content-Type: application/json' -d '{}'` returns `400 {"error":"email required",...}`.
3. With a real subscription row + valid `RESEND_API_KEY`, posting `{ "email": "<row.email>" }` returns `200 {"ok":true}` and the inbox receives an email containing a `confirm-subscription?token=` link.
4. Without `RESEND_API_KEY` env var, posting a valid email returns 500 with `resend_error` or missing-key message (deferred-validation behavior matches `send-digest`).

**Done when:** Function delivers a Resend email with a working confirm link and returns the documented status codes.

---

### Task 3: Build `SubscribeView.vue`
**Sequence:** 2 (depends on Tasks 1 + 2 for the URLs/contracts they expose)
**Files:**
- `goed/src/views/SubscribeView.vue` — create

**Action:**
Create a Vue 3 SFC using the locked `<script setup>` → `<template>` → `<style scoped>` order, no semicolons, Tailwind brand tokens only.

`<script setup>` imports:
```
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
```

State:
```
const route = useRoute()
const email = ref('')
const sectors = ref([])
const stages = ref([])
const regions = ref([])
const hiringOnly = ref(false)
const investor = ref('')
const isSubmitting = ref(false)
const submitted = ref(false)
const alreadySubscribed = ref(false)
const error = ref(null)
const banner = ref(null) // 'confirmed' | 'already' | 'invalid' | 'unsubscribed' | null
```

Hardcoded option arrays (constants at top of script):
```
const SECTOR_OPTIONS = ['AI', 'SaaS', 'HealthTech', 'FinTech', 'EdTech', 'CleanTech', 'BioTech', 'Hardware', 'Consumer', 'Other']
const STAGE_OPTIONS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Growth']
const REGION_OPTIONS = ['Salt Lake City', 'Provo / Utah Valley', 'Ogden', 'Park City', 'St. George', 'Logan', 'Other']
```

`onMounted`:
1. If `route.query.confirmed === 'true'` → `banner.value = 'confirmed'`.
2. Else if `route.query.confirmed === 'already'` → `banner.value = 'already'`.
3. Else if `route.query.error === 'invalid'` → `banner.value = 'invalid'`.
4. Else if `route.query.unsubscribe` → call `await supabase.from('map_subscriptions').delete().eq('id', route.query.unsubscribe)`; set `banner.value = 'unsubscribed'` regardless of error (idempotent UX).

`handleSubmit()` async:
1. `isSubmitting.value = true; error.value = null; alreadySubscribed.value = false`.
2. Build `const filter_criteria = { sectors: sectors.value, stages: stages.value, regions: regions.value, hiring_only: hiringOnly.value, investor: investor.value.trim() }`.
3. `const { error: dbError } = await supabase.from('map_subscriptions').insert({ email: email.value, filter_criteria })`.
4. If `dbError?.code === '23505'` → `alreadySubscribed.value = true`; `isSubmitting.value = false`; return.
5. If other `dbError` → `error.value = dbError.message`; `isSubmitting.value = false`; return.
6. Call `await supabase.functions.invoke('send-confirmation', { body: { email: email.value } })`. If invoke errors, set `error.value` but still mark `submitted.value = true` (the row exists; user can request a resend later).
7. `submitted.value = true`; clear sectors/stages/regions/hiringOnly/investor refs; `isSubmitting.value = false`.

`<template>` (Tailwind brand tokens only — `utah-blue`, `utah-blue-dark`, `hiring-green`, `error-red`, `warning-yellow`):
- Page heading "Subscribe to Utah Startup Map updates".
- Banner block (conditional on `banner.value`):
  - `'confirmed'` → green success: "You're confirmed! Watch for our next digest."
  - `'already'` → blue info: "This subscription is already confirmed."
  - `'invalid'` → red error: "That confirmation link is invalid or expired."
  - `'unsubscribed'` → neutral: "You've been unsubscribed."
- If `submitted` → "Check your inbox to confirm your subscription." panel.
- Else if `alreadySubscribed` → "You're already subscribed with that email." panel.
- Else: form with `@submit.prevent="handleSubmit"`:
  - `<input type="email" required v-model="email" />`
  - Sector checkboxes group bound to `sectors` (v-model on each checkbox value).
  - Stage checkboxes group bound to `stages`.
  - Region checkboxes group bound to `regions`.
  - Hiring-only toggle bound to `hiringOnly` (checkbox).
  - Investor text input bound to `investor` (placeholder "Investor / fund name (optional)").
  - Submit button: `bg-utah-blue hover:bg-utah-blue-dark text-white`, label "Subscribe", `:disabled="isSubmitting"`.
  - Inline `error` message in `text-error-red` if set.
- Mobile-friendly layout using flex/grid; max-w-2xl mx-auto.

`<style scoped>` may be empty.

**Verify:**
1. File exists: `goed/src/views/SubscribeView.vue`.
2. After Task 4 wires the route, navigating to `/subscribe` renders the form (no PlaceholderView).
3. Submitting valid email + ≥1 sector inserts a row with `confirmed=false` + non-null `confirm_token` and shows "Check your inbox" state.
4. Submitting the same email again shows "You're already subscribed".
5. Visiting `/subscribe?confirmed=true`, `?confirmed=already`, `?error=invalid`, `?unsubscribe=<id>` each render their respective banners.

**Done when:** All five success-criteria UX states render correctly and DB writes happen via the Supabase JS client.

---

### Task 4: Wire `/subscribe` route to `SubscribeView`
**Sequence:** 3 (depends on Task 3)
**Files:**
- `goed/src/router/index.js` — modify

**Action:**
Replace the existing `/subscribe` route block (currently using `PlaceholderView` with `props: { title: 'Subscribe' }`) with:

```
{
  path: '/subscribe',
  name: 'Subscribe',
  component: () => import('@/views/SubscribeView.vue'),
},
```

Preserve route name `'Subscribe'`. Do not touch other routes. No semicolons (frontend convention).

**Verify:**
1. `git diff goed/src/router/index.js` shows only the `/subscribe` route block changed.
2. Run `cd goed && npm run dev` — navigating to `http://localhost:5173/subscribe` renders the new `SubscribeView` (form visible), not `PlaceholderView`.
3. `npm run build` succeeds with no Vue/Vite errors.

**Done when:** `/subscribe` lazy-loads `SubscribeView.vue`, route name `'Subscribe'` is intact, dev server renders form, build is clean.

---

## Dependency Graph

```
Sequence 1 (parallel):
  ├── Task 1: confirm-subscription Edge Function
  └── Task 2: send-confirmation  Edge Function

Sequence 2:
  └── Task 3: SubscribeView.vue          (relies on send-confirmation contract from Task 2;
                                          links produced by send-confirmation point at Task 1)

Sequence 3:
  └── Task 4: router rewire to SubscribeView   (depends on Task 3 file existing)
```

| Task | Depends on | Can parallelize with |
| ---- | ---------- | -------------------- |
| 1    | —          | Task 2               |
| 2    | —          | Task 1               |
| 3    | 1, 2       | —                    |
| 4    | 3          | —                    |

## Verification Checklist

- [ ] Navigating to `/subscribe` shows the real subscription form (not PlaceholderView).
- [ ] Filling in an email + at least one sector and submitting shows "Check your inbox to confirm".
- [ ] `map_subscriptions` gains a new row with `confirmed = false` and a non-null `confirm_token` after submission.
- [ ] Submitting the same email a second time shows "already subscribed" (no duplicate row).
- [ ] Clicking the confirm link in the Resend email flips `confirmed` to `true` and redirects to `/subscribe?confirmed=true`.
- [ ] Navigating to `/subscribe?confirmed=true` renders the success banner without form submission.
- [ ] Navigating to `/subscribe?unsubscribe=<valid-id>` deletes the row and renders the unsubscribed banner.
- [ ] Navigating to `/subscribe?error=invalid` renders the invalid-link banner.
- [ ] Both Edge Functions return CORS headers on every response (including OPTIONS preflight).
