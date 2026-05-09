# Feature Plan: AI Onboarding — Frontend Submission UI (Phase 4)

## Objective

Build the `/submit` page — a single-URL submission form that wires into the `onboard-company` Edge Function from Phase 3, displays an animated multi-stage pipeline progress display while the function runs, and shows a success/pending/error result screen. The page is composed from three feature components (`SubmitForm`, `SubmitProgress`, `SubmitResult`) orchestrated by a new `useOnboarding` composable, and the existing `/submit` router entry is migrated from `PlaceholderView` to the new `SubmitView`.

**Purpose:** Deliver the demo-facing flagship experience for Feature 0003 — paste a Utah startup URL, watch the animated pipeline run, see the company appear on the map. This phase is what the judges will actually see during the demo; the heavy lifting (enrichment + quality gate + DB writes) is already complete in Phases 1-3.

**Output:** A working `/submit` route that posts to `supabase.functions.invoke('onboard-company', ...)`, four new Vue files, one new composable, and one router edit.

---

## Must-Haves (Goal-Backward)

### Observable Truths (what must be TRUE for the phase to be "done")

- Navigating to `/submit` renders a Utah-branded form with URL input, optional email input, and submit button.
- Submitting an invalid URL string (e.g. `not-a-url`) shows a client-side validation error and never invokes the Edge Function.
- Submitting a valid URL transitions the page to an animated 7-stage pipeline progress display (stages advance on a client-side timer because the Edge Function is synchronous).
- When the Edge Function returns `status: 'auto_published'`, the result screen shows "You're on the map!" with a working deep-link `/?startup={startup_id}` and a share copy button.
- When the Edge Function returns `status: 'pending'` (e.g. non-Utah company), the result screen shows the review message + "Claim your listing" CTA + the rejection reason.
- When the Edge Function throws or returns an error envelope, the result screen shows a friendly error and a "Try again" button that resets state to `null`.
- All components observe SFC block order (`<script setup>` → `<template>` → `<style scoped>`), no logic in templates, all derived values in `computed()`.
- All exported composable functions have JSDoc.

### Required Artifacts

| Path | Provides | Key Exports |
|------|----------|-------------|
| `goed/src/composables/useOnboarding.js` | Reactive state + invoke wrapper for `onboard-company` Edge Function | `useOnboarding()` returning `{ status, result, error, isLoading, submit }` |
| `goed/src/components/submit/SubmitForm.vue` | URL + email input form with client-side validation | `<SubmitForm :is-loading=".." @submit="..."/>` |
| `goed/src/components/submit/SubmitProgress.vue` | Animated 7-stage pipeline progress display | `<SubmitProgress :stage="..." />` |
| `goed/src/components/submit/SubmitResult.vue` | Auto-published / pending / error result screens | `<SubmitResult :result="..." :error="..." @retry="..."/>` |
| `goed/src/views/SubmitView.vue` | Page shell composing form/progress/result on top of `useOnboarding` | Default-exported Vue route component |
| `goed/src/router/index.js` (modified) | `/submit` route now serves `SubmitView` not `PlaceholderView` | Same default export; route entry updated |

### Key Links (where this is most likely to break)

| From | To | Via |
|------|----|-----|
| `SubmitForm` `@submit` | `SubmitView` handler | `defineEmits(['submit'])` with `{ url, email }` payload |
| `SubmitView` handler | `useOnboarding.submit()` | Composable call |
| `useOnboarding.submit()` | `onboard-company` Edge Function | `supabase.functions.invoke('onboard-company', { body })` |
| Edge Function response `status` | `SubmitView` view selection | `useOnboarding.status` ref drives `v-if` chain to `SubmitForm` / `SubmitProgress` / `SubmitResult` |
| `SubmitProgress.stage` | Visual stage indicator | Client-side `setInterval` advances stage through 7 values over ~60s while awaiting response |
| `SubmitResult` deep link | `MapView` auto-open drawer | Anchor `<a href="/?startup={startup_id}">` — relies on Phase 2 of Feature 0002 supporting `?startup=` query param |

---

## Dependency Graph

```
Sequence 1 (parallel — all independent of each other):
  Task 4.1  useOnboarding composable + SubmitForm.vue
            (creates: goed/src/composables/useOnboarding.js,
                      goed/src/components/submit/SubmitForm.vue)

  Task 4.2  SubmitProgress.vue + SubmitResult.vue
            (creates: goed/src/components/submit/SubmitProgress.vue,
                      goed/src/components/submit/SubmitResult.vue)

Sequence 2 (depends on 4.1 + 4.2):
  Task 4.3  SubmitView.vue + router wiring
            (creates: goed/src/views/SubmitView.vue,
             modifies: goed/src/router/index.js)
```

| Sequence | Tasks | Parallel | Depends On |
|----------|-------|----------|------------|
| 1 | 4.1, 4.2 | Yes | nothing |
| 2 | 4.3 | n/a | 4.1, 4.2 |

---

## Tasks

### Task 4.1: Composable + SubmitForm

**Type:** auto
**Sequence:** 1

<files>
goed/src/composables/useOnboarding.js
goed/src/components/submit/SubmitForm.vue
</files>

<action>
Create `useOnboarding.js` as a Vue composable that wraps `supabase.functions.invoke('onboard-company', { body: { url, email } })`. It must export a single named function `useOnboarding()` returning reactive refs `{ status, result, error, isLoading, submit }`. The `status` ref starts as `null`, transitions to `'running'` immediately when `submit()` is called, and lands on `'auto_published' | 'pending' | 'error'` when the invoke resolves. On invoke success, `result.value` is the full response body and `status.value` mirrors `response.status`. On invoke failure (network error or `error` field on the response), `error.value` is set to a string and `status.value` becomes `'error'`. `isLoading` toggles around the invoke call. JSDoc is required on `useOnboarding` and the inner `submit` function — match the style used in `goed/src/composables/useLogoDev.js`.

Create `SubmitForm.vue` as a presentational component. It uses `<script setup>` and declares `defineProps({ isLoading: { type: Boolean, default: false } })` and `defineEmits(['submit'])`. The template is a `<form @submit.prevent="onSubmit">` with: a `type="url"` URL input (placeholder `"https://yourstartup.com"`, `required`), an optional `type="email"` input (placeholder `"you@yourstartup.com"`), and a submit `<button type="submit">`. Local `ref`s hold the URL and email values plus a `validationError` ref. The `onSubmit` handler validates the URL with `new URL(...)` in a try/catch — if invalid, it sets `validationError.value` to a friendly message and returns without emitting. On success it emits `'submit'` with `{ url, email }` (email is `undefined` if blank). Disable all inputs and the button while `isLoading` is true; show a small inline spinner inside the button. Use Utah brand classes (`bg-utah-blue`, `text-utah-blue`, etc.) — no raw hex. SFC block order strict; no ternaries / function calls in template — derive `buttonLabel`, `submitDisabled`, and any class bindings via `computed`.
</action>

<verify>
1. Files exist: `goed/src/composables/useOnboarding.js` and `goed/src/components/submit/SubmitForm.vue`.
2. `useOnboarding.js` exports a `useOnboarding` function with JSDoc; the function returns an object with keys `status`, `result`, `error`, `isLoading`, `submit`. Importing it from a Vue component does not throw.
3. `SubmitForm.vue` follows SFC block order; `<template>` contains no ternary operators (`grep -E '\?.*:' goed/src/components/submit/SubmitForm.vue` finds none inside the `<template>` block) and no inline `&&` / `||` in `:bind` expressions.
4. Manual: `npm run dev` and import `<SubmitForm />` in a scratch view — typing `not-a-url` and submitting shows an inline error and does not emit; typing `https://example.com` and submitting emits `{ url, email }`.
</verify>

<done>
- [x] `useOnboarding.js` exists with JSDoc, returns reactive `{ status, result, error, isLoading, submit }`.
- [x] `SubmitForm.vue` exists; SFC block order observed; no template logic.
- [x] Form validates URLs client-side and never emits on invalid input.
- [x] Form disables inputs + button while `isLoading` is true.
</done>

---

### Task 4.2: SubmitProgress + SubmitResult

**Type:** auto
**Sequence:** 1

<files>
goed/src/components/submit/SubmitProgress.vue
goed/src/components/submit/SubmitResult.vue
</files>

<action>
Create `SubmitProgress.vue`. It declares `defineProps({ stage: { type: String, default: 'idle' } })` where stage is one of `'idle' | 'scrape' | 'crunchbase' | 'dcc' | 'ats' | 'logo' | 'geocode' | 'publish'`. Define a `STAGES` constant (array of 7 objects in order: `scrape`, `crunchbase`, `dcc`, `ats`, `logo`, `geocode`, `publish`) where each object has `key` and human-readable `label`: "Reading your website…", "Checking Crunchbase investors…", "Verifying Utah registration…", "Scanning job postings…", "Fetching logo…", "Geocoding address…", "Publishing to map…". Render the stages as a vertical step list — each step shows a checkmark icon when complete, a spinning indicator when active, and a dimmed dot when upcoming. Use a `computed` `stageStates` that returns an array of `{ key, label, status: 'complete' | 'active' | 'upcoming' }` derived from the current `props.stage` index. On mount, use `gsap.from()` with `stagger` to fade-in the step items (e.g. 0.08s stagger, 0.4s duration). Use `gsap.to()` to animate a horizontal progress bar's width or scale-x driven by the active stage index (e.g. `width: ${(activeIndex+1)/7 * 100}%`). Re-run the progress-bar animation in a `watch` on `props.stage`. No logic in template — all class bindings and labels come from `stageStates` computed. Utah brand tokens only.

Create `SubmitResult.vue`. It declares `defineProps({ result: { type: Object, default: null }, error: { type: String, default: null } })` and `defineEmits(['retry'])`. The `result` shape is `{ status: 'auto_published' | 'pending', startup_id?: string, company?: object, reason?: string }`. Use a single `view` computed that returns `'auto_published' | 'pending' | 'error'` based on which prop is populated and the result's status (priority: `error` if set, else `result.status`). Render three sibling `<section v-if="view === 'auto_published'">` / `<section v-if="view === 'pending'">` / `<section v-if="view === 'error'">` blocks. The `auto_published` block shows an `<h1>` "You're on the map!", an `<a>` deep link to `/?startup={startup_id}` styled as a Utah blue button labeled "View on map", and a "Copy share link" button (use `navigator.clipboard.writeText`). Animate the heading entrance with `gsap.from()` on mount. The `pending` block shows an `<h1>` "Your submission is under review", paragraph text "GOED will review within 48 hours", the `result.reason` (if present) as muted text, and a `<router-link to="/admin">` styled as a button labeled "Claim your listing". The `error` block shows an `<h1>` "Something went wrong", the `error` prop as the body, and a `<button>` "Try again" that emits `'retry'`. Derive deep-link URL, button labels, and visibility entirely in `computed` — no ternaries in template.
</action>

<verify>
1. Files exist: `goed/src/components/submit/SubmitProgress.vue` and `goed/src/components/submit/SubmitResult.vue`.
2. SFC block order is `<script setup>` → `<template>` → `<style scoped>` in both files.
3. Templates have no ternaries: `grep -E '\?.*:' goed/src/components/submit/SubmitProgress.vue goed/src/components/submit/SubmitResult.vue` returns no matches inside `<template>` blocks.
4. Manual: `npm run dev` and mount `<SubmitProgress stage="ats" />` in a scratch view — exactly four steps (`scrape`, `crunchbase`, `dcc`, `ats`) show the active/complete state and the GSAP entrance stagger plays once on mount.
5. Manual: mount `<SubmitResult :result="{ status: 'auto_published', startup_id: 'abc-123' }" />` — the heading reads "You're on the map!" and the "View on map" anchor's href is `/?startup=abc-123`.
6. Manual: mount `<SubmitResult :error="'Network error'" />` — the error block renders and clicking "Try again" emits `'retry'`.
</verify>

<done>
- [x] `SubmitProgress.vue` renders 7 stages, highlights active, marks completed, dims upcoming.
- [x] `SubmitProgress.vue` plays a GSAP staggered entrance and a progress-bar animation on stage change.
- [x] `SubmitResult.vue` correctly switches between `auto_published`, `pending`, and `error` views via a `view` computed.
- [x] `SubmitResult.vue` deep-link uses pattern `/?startup={startup_id}` and the share-copy button calls `navigator.clipboard.writeText`.
- [x] All conditional logic lives in `computed`; no ternaries / boolean operators in templates.
</done>

---

### Task 4.3: SubmitView page shell + router wiring

**Type:** auto
**Sequence:** 2

<files>
goed/src/views/SubmitView.vue
goed/src/router/index.js
</files>

<action>
Create `SubmitView.vue`. The script imports `useOnboarding` from `@/composables/useOnboarding`, the three components from `@/components/submit/`, and `gsap` from `gsap`. Call `const { status, result, error, isLoading, submit } = useOnboarding()` (use `storeToRefs`-style destructure since the composable returns refs directly — destructuring is fine because they are real refs). Declare a local `ref` `simulatedStage = ref('idle')` for `SubmitProgress`. Define a `view` computed that returns one of `'form' | 'running' | 'result'`: returns `'form'` when `status.value === null`, `'running'` when `status.value === 'running'`, and `'result'` for any terminal state (`'auto_published' | 'pending' | 'error'`).

Implement `onFormSubmit({ url, email })`: kick off a `setInterval` (or sequenced `setTimeout`s) that advances `simulatedStage` through `'scrape' → 'crunchbase' → 'dcc' → 'ats' → 'logo' → 'geocode' → 'publish'` every ~8.5 seconds (~60s total), then immediately call `submit({ url, email })`. When `submit()` resolves, clear the interval (the result will display regardless of whether all stages were "shown"). Use a `watch(status, ...)` to clear the interval when `status` becomes terminal — that handles the case where the Edge Function returns faster than the animation. Implement `onRetry()` that resets the composable state by calling a `reset` exposed from the composable OR by re-mounting via `simulatedStage.value = 'idle'` and clearing the local refs (extend `useOnboarding` to expose a `reset()` if needed — set `status`, `result`, `error` back to null). On the form submit emit, call `onFormSubmit(payload)`.

Template: a centered card on a light gray background. A page-level `gsap.from()` on the card on mount (fade + 20px slide up, 0.5s). Inside the card render `<SubmitForm v-if="view === 'form'" :is-loading="isLoading" @submit="onFormSubmit" />`, `<SubmitProgress v-if="view === 'running'" :stage="simulatedStage" />`, `<SubmitResult v-if="view === 'result'" :result="result" :error="error" @retry="onRetry" />`. Apply Utah-branded layout: light-gray (`bg-gray-50`) wrapper, white card with rounded corners and shadow, Utah blue heading at the top of the card.

Update `goed/src/router/index.js`: change the `/submit` route entry from `component: () => import('@/views/PlaceholderView.vue')` and `props: { title: 'Submit a Company' }` to `component: () => import('@/views/SubmitView.vue')` and remove the `props` field. Keep the route `name: 'Submit'` and `path: '/submit'` unchanged.

If `useOnboarding` doesn't yet expose a `reset()` function (it won't, from Task 4.1), extend it now to expose `reset()` that sets `status.value = null`, `result.value = null`, `error.value = null`, `isLoading.value = false`. Add JSDoc.
</action>

<verify>
1. Files exist: `goed/src/views/SubmitView.vue` exists; `goed/src/router/index.js` modified.
2. `grep "SubmitView" goed/src/router/index.js` shows the import; `grep "PlaceholderView" goed/src/router/index.js` no longer returns the `/submit` line (it can still match for `/admin`, `/roadmap`, `/subscribe`).
3. SFC block order observed in `SubmitView.vue`; no ternaries in `<template>`.
4. Manual: `npm run dev`, navigate to `/submit` — page renders the form on a light-gray background with a centered Utah-branded white card, page-level GSAP fade-slide entrance plays.
5. Manual: enter `not-a-url` — client validation message appears, no Edge Function call (verify in browser DevTools Network tab).
6. Manual: enter `https://zonos.com` and submit — page transitions to `SubmitProgress`, stages advance over ~60s, then result screen appears with either `'auto_published'` or `'pending'` content matching the Edge Function response.
7. Manual: on success result, click "View on map" — browser navigates to `/?startup={id}` (Feature 0002 drawer auto-open behavior is out of scope here; only verify the link href is correct).
8. Manual: on error result, click "Try again" — page returns to the form view (`status === null`).
</verify>

<done>
- [x] `/submit` route loads `SubmitView.vue` (not `PlaceholderView.vue`).
- [x] `SubmitView` composes `SubmitForm` / `SubmitProgress` / `SubmitResult` based on `useOnboarding` state.
- [x] Form submit triggers timed stage simulation + Edge Function invoke; whichever completes first lets the result render.
- [x] Result screen renders correct branch for `auto_published`, `pending`, and `error`.
- [x] "Try again" on error calls `useOnboarding.reset()` and returns to the form view.
- [x] Page-level GSAP entrance on mount.
</done>

---

## Verification Checklist

Direct mapping from ROADMAP Phase 4 success criteria:

- [ ] Navigating to `/submit` renders a clean submission form (URL input + email input + submit button) with Utah brand styling. *(SubmitForm.vue + SubmitView.vue)*
- [ ] Entering a valid Utah startup URL and pressing submit transitions to the `SubmitProgress` component showing animated pipeline stages advancing in sequence. *(SubmitView view computed + simulatedStage timer)*
- [ ] After the Edge Function responds, `SubmitResult` renders the correct outcome: `auto_published` shows "You're on the map!" with a working deep-link; `pending` shows the review message with CTA. *(SubmitResult.vue view computed)*
- [ ] The deep link `/?startup={startup_id}` href is correctly constructed in `SubmitResult` (drawer-auto-open behavior is verified in Feature 0002, not here).
- [ ] A newly auto-published company appears on the map (`/`) as a new pin (cross-feature; backend already covered by Phase 3, frontend rendering covered by Feature 0002).
- [ ] Submitting a non-URL string shows a client-side validation error without calling the Edge Function. *(SubmitForm `onSubmit` validates via `new URL()`)*
- [ ] Submitting a URL for a non-Utah company shows `SubmitResult` in `pending` state with the quality-gate rejection reason. *(SubmitResult `pending` branch renders `result.reason`)*

## Success Criteria

The phase is complete when:
1. All three tasks are marked done.
2. Manual end-to-end test from `/submit` with a valid Utah startup URL produces an animated progress display followed by an `auto_published` result whose deep-link href matches `/?startup={uuid}`.
3. Manual end-to-end test with a non-Utah URL produces a `pending` result with a non-empty rejection reason rendered in the UI.
4. Manual end-to-end test with `not-a-url` shows the client validation error and the browser DevTools Network tab confirms no `onboard-company` invocation occurred.
5. All four new `.vue` files pass the no-template-logic rule (no ternaries, no boolean ops in `:bind`, no method calls for derived values).
6. `useOnboarding.js` exports `useOnboarding` and an internal `submit` (and `reset`) with JSDoc on each.
