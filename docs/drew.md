# Drew — Design + UX + Animation + Demo Narration

You own the visual direction, the design system, the animation choreography, and the demo narration. Three of the four judging criteria — UX (30%), Design (25%), Innovation framing (part of 20%) — are won or lost in the work you do.

---

## Your superpower for this build

You're the only one whose work is judged purely on perception. Cayden's React works or it doesn't; Beau's API returns 200 or it doesn't. Yours is felt — and the difference between "this is a hackathon project" and "this could ship to production" is in the details you choose.

---

## Tonight (1:30–2:30 PM) — 15 minutes

### Sketch the 5 key screens

Pencil and paper, or quick Figma frames. Don't pixel-push. The goal is shared mental model, not final pixels.

Required sketches:

1. **Landing / Q1** — hero copy, 4 stage cards stacked, Skip link below
2. **Q2 / Q3** — same card pattern, progress indicator
3. **Dashboard** — 3 panels, hierarchy, where the CTA sits, where the concierge lives
4. **Resource detail** — header, body, sidebar
5. **Browse all `/resources`** — filter rail + card list

Optional but high-leverage:

6. The **Q3 → Dashboard transition** — sketch the cinematic moment frame-by-frame so Cayden knows what GSAP needs to do

### Pick the visual direction (or confirm the recommendation)

Recommended: **Linear-clean + red-rock orange accent.** See `DESIGN_SYSTEM.md`.

If you want to override, do it tonight — the rest of the team needs to know before tomorrow morning.

### Output at 2:30 PM

- Sketches shared in Slack (photo or Figma link)
- Visual direction confirmed in `DESIGN_SYSTEM.md` (or your override committed)

---

## Tomorrow

### 8:00–9:00 AM — Design system lockdown

You and Cayden pair-build the component shells. You style; he wires.

#### Your tasks

1. **Tailwind config + tokens** (15 min)
   - Set CSS variables in `globals.css` per `DESIGN_SYSTEM.md`.
   - Configure `tailwind.config.ts` to consume them.
   - Verify shadcn primitives render with your palette.

2. **Inter font** (5 min)
   - Add via `@fontsource-variable/inter` or CDN.
   - Verify it loads on `pnpm dev`.

3. **Component library styling** (25 min)
   - Pair with Cayden on shells he scaffolds.
   - Style `QuizCard`, `RoadmapItem`, `ResourceCard`, `PersonCard`, `MatchPill`, `FeedbackWidget`, `CitationPill`.
   - Match the card pattern in `DESIGN_SYSTEM.md` exactly. Consistency > creativity here.

4. **GSAP + Framer setup** (15 min)
   - Define the transition contracts (see Animation section below).
   - Write the GSAP timeline for Q3 → Dashboard reveal as a reusable function: `revealDashboard()`.

### 9:00–11:00 AM — Polish in parallel with Cayden's build

You're not on the critical path of the spine — Cayden is. Your role is to follow behind him and elevate everything.

#### Tasks

1. **Landing page hero** (20 min)
   - Big single sentence: *"Find what Utah has for you. 60 seconds."*
   - Subtle gradient background or subtle animated motif (Drew choice).
   - Q1 cards should feel weighty, scannable, fast.

2. **Header + footer** (15 min)
   - Minimal header: logo (text-only is fine), maybe one nav link.
   - Minimal footer: state attribution, link to startup.utah.gov, social.

3. **Empty / error / loading states** (15 min)
   - Skeleton cards for dashboard panels (3 placeholder cards per panel, pulsing).
   - 404 state for resources/businesses.
   - Friendly empty state for `/directory` if no businesses yet.

4. **Q3 → Dashboard transition** (20 min)
   - The demo's emotional peak. Get it right.
   - GSAP timeline: full-viewport "Building your dashboard…" overlay (0.4s) → fade to dashboard with panels staggering in (0.3s gap, ease-out-quart).
   - Total duration ≤ 1.2s. Anything longer feels slow.

5. **Micro-interactions** (10 min)
   - Hover states on cards (subtle border color shift to `--primary/30`).
   - Button focus rings using `--ring`.
   - Roadmap checkbox: smooth strikethrough animation.

6. **CTA block styling** (10 min)
   - Make the primary CTA unmissable. Not garish, just confident.
   - Conditional secondary CTA — visually subordinate but clearly clickable.

### 11:00–11:50 AM — Polish + mobile

#### Mobile QA pass

- Test at 375px (iPhone SE). This is the worst case.
- Test at 414px (iPhone 14+).
- Verify:
  - Quiz cards are tap-friendly (min 56px height)
  - Dashboard panels stack vertically and are individually collapsible
  - Concierge is a bottom sheet that pulls up, not a fixed footer
  - Filter sheet on `/resources` triggered by a button, not always-visible
- Fix layout breaks. Common culprits: long titles, photo aspect ratios, filter chip wrap.

#### GSAP polish pass

- Stage graduation moment (when all 3 roadmap items checked): subtle confetti or gradient sweep + "You're ready for [next stage]" banner.
- If concierge ships: pulse animation on send button while waiting; fake-stream reveal on response.

### 11:50 AM–12:40 PM — Testing co-pilot

Help Cayden + Beau verify all 6 personas render dashboards that feel meaningfully different. Pay attention to:

- Are the right resources surfacing? (Beau's algorithm)
- Are the right tone and motion serving the moment? (Yours)
- Does anything feel "AI-generated" or "hackathon-y"? Cut it.

### 12:40–1:00 PM — Demo prep

#### Rehearse the pitch

You're the lead narrator. Burkely co-narrates the Priya half + concierge analytics moment.

#### Demo script (memorize the beats, not the words)

**0:00–0:15 — The problem**
> "Utah's startup ecosystem has world-class resources. Free capital, expert mentorship, a real path. But right now the state's site is built like a library, and a founder running 100 miles an hour doesn't have time to find the section they need. We rebuilt it as a guide instead of a library."

**0:15–0:45 — Maria walkthrough**
> "Meet Maria. She runs a small ag operation outside St. George — woman-owned, scaling, looking to hire her first employees."
> [click through Q1 → Q2 → Q3 live]
> "Three questions. Sixty seconds. Here's her dashboard."
> [point at Panel 1] "Three things to do this week, hand-curated for scaling-stage founders."
> [point at Panel 2] "Resources ranked for her specifically — Utah Department of Ag, Women's Business Center, rural development grants."
> [point at Panel 3] "And the people she should meet this month — her regional SBDC counselor, the right sector lead at GOEO."

**0:45–1:15 — Priya walkthrough (Burkely takes over here)**
> "Now Priya. Same stage as Maria — scaling. Completely different founder."
> [Burkely clicks through quiz]
> "Same dashboard structure. Completely different content. Pelion, Album, Kickstart. Pitch competitions. Talent pipelines for SaaS."

**1:15–1:40 — Concierge analytics moment (Burkely)**
> "When the quiz misses, the AI concierge picks it up. Grounded in the state's actual catalog — every answer cites the resource it came from. And every question we *can't* answer becomes a content gap report for GOEO. We're not just helping founders. We're closing the feedback loop with the state."

**1:40–2:00 — Map flash + close (you)**
> "Same data layer powers the Utah Startup Map. Companies claim a profile, become discoverable, become part of the visible ecosystem the state shows to investors abroad. Built to be updatable by GOEO content owners — no developer required. Built to ship to startup.utah.gov on Monday."
> [end on the dashboard, hold]

#### Run the demo 3 times

Each run, watch for:
- Where do you stumble on words? Tighten.
- Where does the click-through stutter? Pre-position the cursor.
- Where does the pitch lose energy? Cut a sentence.

---

## Animation contracts (handoff to Cayden)

Cayden uses these as primitives. You define what they do; he calls them.

```ts
// lib/animations.ts (Drew owns this file)

import gsap from 'gsap';

// Q3 submit → Dashboard reveal (GSAP)
export function revealDashboard(onComplete?: () => void) {
  const tl = gsap.timeline({ onComplete });
  tl.to('.quiz-overlay', { opacity: 0, duration: 0.4, ease: 'power3.out' })
    .from('.dashboard-panel', { y: 24, opacity: 0, stagger: 0.1, duration: 0.4, ease: 'power3.out' }, '-=0.1')
    .from('.dashboard-cta', { y: 12, opacity: 0, duration: 0.3 }, '-=0.2');
  return tl;
}

// Stage graduation (GSAP)
export function celebrateStageComplete() {
  // confetti or gradient sweep + banner reveal
}

// Reduced motion guard
export function shouldAnimate(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

For Framer (component-level): use the patterns directly in components, no shared abstraction needed.

---

## Files you own

```
src/
├── styles/
│   └── globals.css         (CSS variables, base layer)
├── lib/
│   └── animations.ts       (GSAP timelines)
└── components/
    └── ui/                 (shadcn primitives, you customize tokens)

tailwind.config.ts          (color scale, spacing extensions)
```

You collaborate with Cayden on `components/quiz/`, `components/dashboard/`, `components/shared/` — he writes the JSX, you write the className strings.

---

## Cutlines

| Time | Drop in this order |
|---|---|
| Past 10:00 AM with hero not styled | Use a default hero, focus on dashboard styling instead |
| Past 11:00 AM with stage graduation animation incomplete | Cut entirely; static "Next chapter" banner is fine |
| Past 11:30 AM with mobile not tested | Test only the demo personas' flow on mobile, accept layout bugs elsewhere |
| Past 12:00 PM with micro-interactions polish remaining | Stop polishing. Move to demo rehearsal. |

**Never cut:**
- The Q3 → Dashboard cinematic transition (this is the demo)
- Card pattern consistency across panels (this is what makes it look "production")
- Color contrast / accessibility basics (judges include people who care)

---

## Slack pings to expect from you

- Tonight: sketches photo + visual direction confirmation
- 9:00 AM: design system locked, components styled
- 10:00 AM: hero + landing done, dashboard shells styled
- 11:00 AM: GSAP transition working
- 11:30 AM: mobile pass complete
- 12:00 PM: pitch script committed to memory (verbal, not Slack)

---

## When in doubt

- **Linear-clean = restraint.** If you're tempted to add another decorative element, don't.
- **One cinematic moment per demo.** The Q3 → Dashboard reveal is it.
- **Type and whitespace do the heavy lifting.** Not gradients, not motion, not chrome.
- **Investor-ready means a non-technical person understands the value in 5 seconds.** Optimize for that 5-second glance.
- Burkely unblocks. He's also your demo co-narrator — keep him looped on script changes.
