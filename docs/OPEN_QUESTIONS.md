# Open Questions

What we don't know yet, who owns the answer, and when we need it. Update this list as questions close. **A question with no owner is a question that won't get answered.**

---

## P0 — Blocks tomorrow's start

### OQ-1: Framework, package manager, TS yes/no
**Owner:** Cayden
**Needed by:** Tonight, before anyone goes home
**Why it blocks:** Whole team needs to install correctly tomorrow morning. Drew can't start the design system without knowing the framework. Burkely can't finalize the Netlify build settings.
**Recommendation:** Vite + React 18 + React Router v6 + TypeScript + pnpm + Node 20. See `ARCHITECTURE.md` for reasoning.
**Action:** Cayden posts decision in Slack tonight. Team installs accordingly.

### OQ-2: Stage → Communities mapping interpretation
**Owner:** Beau
**Needed by:** 8:00 AM tomorrow
**Why it blocks:** Scoring algorithm needs the final weight + interpretation locked before Phase 1.
**Two options on the table** (see `DATA_MODEL.md` for full detail):
- **A:** Drop Communities tie to Stage entirely. Score Stage against a separate `stages` field on resources (which we'd derive from the Sheet during ingestion). +40 if resource serves the user's stage.
- **B:** Keep current heuristic mapping but acknowledge the looser correlation. Lower weight from +40 to +25.
**Action:** Beau picks one tonight or first-thing tomorrow. Posts in Slack. Updates `DATA_MODEL.md` and `lib/scoring.ts` to match.

---

## P1 — Affects build quality but not start

### OQ-3: Industry vocabulary canonical list
**Owner:** Beau
**Needed by:** 9:00 AM tomorrow (before Cayden builds Q2 dropdown)
**Why:** The Sheet might have variations like "Software and Information Technology" vs "Software/IT" vs "SaaS." Quiz answer values must match the database vocabulary exactly.
**Action:** Beau extracts the unique industries values from the Sheet, normalizes them, posts the list in Slack. Cayden uses this list for Q2 options.

### OQ-4: Topics vocabulary canonical list
**Owner:** Beau
**Needed by:** 9:00 AM tomorrow
**Why:** Same reason as OQ-3, for Q3.
**Recommendation:** Map the user-facing topic answers (Funding, Talent/hiring, Community, Legal/compliance, Marketing) to whatever the Sheet's actual `Topics` column contains. Document the mapping in `lib/topicMap.ts`.

### OQ-5: Roadmap content for all 5 stage variants
**Owner:** Beau (drafts) + Drew (reviews copy)
**Needed by:** 9:30 AM tomorrow
**Why:** Without real roadmap content, Panel 1 is empty. Demo dies.
**Action:** Beau drafts 3 items per variant in `roadmaps.json`. Drew reviews for tone and clarity. Use real Utah resources, not placeholders.
**Variants needed:**
- pre-revenue
- early-revenue
- scaling
- established-utah
- established-relocating

### OQ-6: People-to-meet stub entries
**Owner:** Beau
**Needed by:** 10:00 AM tomorrow
**Why:** Panel 3 needs at least 12 entries to demonstrate matching across personas.
**Action:** Beau seeds `people.json` with 12 stubs covering: SBDC counselors (regional), GOEO sector leads (4 sectors), accelerator program directors (Kickstart, BoomStartup, RevRoad), university tech transfer reps (PIVOT Center, BYU). Use plausible names + roles + orgs. Photos can be initials avatars in v1.

### OQ-7: Demo seed businesses for the directory
**Owner:** Beau
**Needed by:** 12:30 PM tomorrow (just before deploy)
**Why:** Empty `/directory` looks broken at the demo. 5 seeded businesses make it feel populated.
**Action:** Use real Utah companies from the Map data Sheet. 5 covering different sectors.

---

## P2 — Polish-phase decisions

### OQ-8: GSAP cinematic specifics
**Owner:** Drew
**Needed by:** 11:00 AM tomorrow
**Why:** The Q3 → Dashboard transition is the demo's emotional peak. Drew owns the choreography.
**Recommendation:** Full-viewport overlay fades out, dashboard panels stagger in (300ms gaps, ease-out-quart). Keep total duration under 1.2s.

### OQ-9: Concierge tone calibration
**Owner:** Beau (technical) + Drew (copy review)
**Needed by:** 11:30 AM tomorrow (if concierge is shipping)
**Why:** The default prompt may produce responses that are too formal or too cute. Test against Maria + Priya queries during Phase 3 and adjust prompt.

### OQ-10: Reorderable resources panel — keep or cut
**Owner:** Cayden
**Needed by:** 11:00 AM tomorrow
**Why:** Drag-to-reorder on Panel 2 is a nice touch but eats build time. If Cayden is on schedule, keep it. If not, cut.
**Default:** Cut. Re-add as Phase 2 feature.

---

## P3 — Post-hackathon

These are not in v1 scope but should be tracked for the post-judging conversation with GOEO.

- **OQ-P1:** Email verification for business profile claim (magic link). Architecture is ready (`is_verified` boolean), implementation deferred.
- **OQ-P2:** Real GOEO staff data for People-to-Meet panel (replacing stubs).
- **OQ-P3:** Admin dashboard at `/admin` for GOEO to review unanswered concierge questions, edit resources, moderate business claims.
- **OQ-P4:** Mobile native app vs PWA decision.
- **OQ-P5:** Internationalization (Spanish at minimum given New American + Multicultural communities).
- **OQ-P6:** Analytics/instrumentation (PostHog or Plausible) for real usage data.
- **OQ-P7:** Repo license decision (MIT vs Apache vs proprietary).

---

## Closed questions

Move questions here once resolved. Format: `OQ-N closed: [decision] — [date]`

*(none yet)*
