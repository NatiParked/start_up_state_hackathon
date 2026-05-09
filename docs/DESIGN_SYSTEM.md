# Design System

> **Drew runs point on visual direction.** This doc is the starter scaffold and the recommended direction. Drew may adjust — when he does, update this file so Cayden has the source of truth.

---

## Visual direction (recommended starting point)

**Linear-clean with one Utah-grounded accent.**

- Slate-based neutrals (shadcn/ui Slate palette) for the base
- One confident accent: red-rock orange `#C2410C` (Tailwind `orange-700`) for primary CTAs and focus states
- Dark gradients optional for hero only (subtle, never busy)
- Generous whitespace; let content breathe
- Type does the heavy lifting; minimal chrome

**Reference vibe:** Linear.app, Vercel.com, Stripe Press. Avoid: gov.uk (too austere), Notion landing (too playful), startup.utah.gov (what we're replacing).

---

## Color tokens

To be set in `tailwind.config.ts` and as CSS variables in `globals.css`.

```css
:root {
  /* Base */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;       /* slate-900 */

  /* Surface */
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --muted: 210 40% 96%;            /* slate-100 */
  --muted-foreground: 215 16% 47%; /* slate-500 */

  /* Accent (Utah red-rock) */
  --primary: 21 90% 42%;           /* orange-700 */
  --primary-foreground: 0 0% 100%;

  /* Secondary (subtle slate) */
  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;

  /* Borders */
  --border: 214 32% 91%;           /* slate-200 */
  --input: 214 32% 91%;
  --ring: 21 90% 42%;              /* matches primary */

  /* Semantic */
  --success: 142 71% 35%;          /* green-700 */
  --warning: 38 92% 50%;           /* amber-500 */
  --destructive: 0 72% 51%;        /* red-600 */

  /* Radius */
  --radius: 0.625rem;              /* 10px — slightly softer than shadcn default */
}

.dark {
  /* Optional dark mode — only enable if Drew commits to it. Default off for v1. */
}
```

---

## Typography

- **Font:** Inter (variable). Load via `next/font` or `@fontsource-variable/inter`.
- **Fallback stack:** `Inter, ui-sans-serif, system-ui, -apple-system, sans-serif`
- **Mono (for resource IDs, debug):** JetBrains Mono or system mono.

### Scale

| Token | Size | Line | Use |
|---|---|---|---|
| `text-xs` | 12px | 16px | Tag pills, microcopy |
| `text-sm` | 14px | 20px | Card body, secondary text |
| `text-base` | 16px | 24px | Default body |
| `text-lg` | 18px | 28px | Card titles |
| `text-xl` | 20px | 28px | Panel headings |
| `text-2xl` | 24px | 32px | Page subheaders |
| `text-3xl` | 30px | 36px | Page titles |
| `text-5xl` | 48px | 1 | Hero (`/`) |

Tracking on hero: `-0.02em`. Body: default.

### Weights

- 400 default body
- 500 card titles, panel headings
- 600 page titles
- 700 hero only

---

## Spacing rhythm

- Base unit: **4px** (Tailwind default)
- Card internal padding: `p-5` (20px)
- Panel internal padding: `p-6` (24px)
- Section gaps: `space-y-8` (32px)
- Page horizontal padding: `px-4` mobile, `px-6` tablet, `px-8` desktop, `mx-auto max-w-6xl`

---

## Component library

Use shadcn/ui as the foundation. Initialize on day 1:

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input label select textarea checkbox dialog sheet toast badge separator skeleton dropdown-menu
```

### Custom components Cayden will build

| Component | File | Purpose |
|---|---|---|
| `QuizCard` | `components/quiz/QuizCard.tsx` | Big tappable answer card |
| `QuizProgressBar` | `components/quiz/QuizProgressBar.tsx` | 1 of 3 indicator |
| `RoadmapItem` | `components/dashboard/RoadmapItem.tsx` | "Do This Now" card with checkbox |
| `ResourceCard` | `components/dashboard/ResourceCard.tsx` | "Your Relevant Resources" card |
| `PersonCard` | `components/dashboard/PersonCard.tsx` | "People to Meet" card |
| `MatchPill` | `components/shared/MatchPill.tsx` | "Matched on industry + topic" pill |
| `FeedbackWidget` | `components/shared/FeedbackWidget.tsx` | Thumbs + reason inline form |
| `ConciergeChat` | `components/dashboard/ConciergeChat.tsx` | Bottom sheet AI chat |
| `CitationPill` | `components/concierge/CitationPill.tsx` | `[1]` link to resource |

---

## Card pattern

The dominant component shape across Panel 1, Panel 2, Panel 3, and `/resources`. Consistency here = perceived quality.

```tsx
<Card className="rounded-xl border bg-card p-5 hover:border-primary/30 transition-colors">
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1 min-w-0">
      <h3 className="text-lg font-medium tracking-tight truncate">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{oneLine}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map(tag => <Badge variant="secondary" key={tag}>{tag}</Badge>)}
      </div>
    </div>
    <div className="shrink-0">{primaryAction}</div>
  </div>
  <Separator className="my-4" />
  <FeedbackWidget resourceId={id} />
</Card>
```

---

## Iconography

`lucide-react`. Pick a tight set and reuse:

| Icon | Use |
|---|---|
| `ArrowRight` | Primary CTAs |
| `Check` / `CheckCircle2` | Completed roadmap items |
| `GripVertical` | Reorder handle |
| `Filter` | Filter sheet trigger |
| `MessageSquare` | Concierge toggle |
| `ThumbsUp` / `ThumbsDown` | Feedback |
| `MapPin` | Location pill |
| `Building2` | Industry pill |
| `Tag` | Topic pill |
| `Users` | Community pill |
| `Calendar` | Book a call |
| `ExternalLink` | Outbound applies |

---

## Animation patterns (handoff to Drew)

See `UX_FLOWS.md` "Animation moments." Drew owns the choreography; this section documents the technical contracts.

### GSAP

Use for orchestrated sequences that don't fit neatly in component boundaries:
- The full-viewport quiz → dashboard transition
- Stage graduation reveal

```ts
import gsap from 'gsap';

gsap.timeline()
  .to('.quiz-overlay', { opacity: 0, duration: 0.3 })
  .from('.dashboard-panel', { y: 20, opacity: 0, stagger: 0.1, duration: 0.4 }, '-=0.1');
```

### Framer Motion

Use for component-level enter/exit, hover, layout shifts:

```tsx
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.2 }}
>
  ...
</motion.div>
```

### Easing curves

- Standard: `[0.16, 1, 0.3, 1]` (ease-out-quart)
- Snappy: `[0.4, 0, 0.2, 1]` (Tailwind ease-in-out)
- Avoid: spring physics for v1 (overkill, harder to tune in 6 hours)

### Reduced motion

Honor `prefers-reduced-motion`. Framer respects it via `useReducedMotion()`. GSAP needs explicit guard:

```ts
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReduced) return;
gsap.timeline()...;
```

---

## Accessibility

Non-negotiables:
- Every interactive element keyboard-reachable (Tab order matches visual order).
- Focus rings use `--ring` (orange) on `:focus-visible`.
- Color contrast min 4.5:1 for body, 3:1 for large text. Slate-900 on white passes; orange-700 on white passes.
- All form inputs have `<Label>`. shadcn handles this if you use the primitives.
- Quiz answer cards: native `<button>` elements, never `<div role="button">`.
- Concierge chat: announce new messages via `aria-live="polite"`.
- Skip link at top of page: "Skip to main content" → `#main`.

---

## What "investor-ready" actually means here

Three things to nail:
1. **Whitespace.** Dense designs read as cluttered to non-tech audiences. Keep gaps generous.
2. **Motion restraint.** One cinematic moment (quiz → dashboard). Everywhere else: subtle, fast, purposeful.
3. **Type hierarchy.** A judge should glance at the dashboard and immediately know what's most important. That's the type ladder doing its job.

If something isn't pulling its weight visually, cut it. Linear-clean = ruthless editing.
