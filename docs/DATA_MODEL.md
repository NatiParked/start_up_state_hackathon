# Data Model

Schemas, the scoring algorithm, and the hand-curated stage roadmaps that drive "Do This Now."

---

## Source of truth

Resources come from the [hackathon Resources spreadsheet](https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/edit). Beau parses → JSON → Supabase. The spreadsheet is the canonical input. The Supabase table is the canonical runtime.

---

## Tables

### `resources`

Source: parsed from the Google Sheet.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` (PK) | Slug or stable hash from the source row |
| `title` | `text` | Display name |
| `description` | `text` | One-paragraph summary |
| `link` | `text` | Apply / learn-more URL |
| `email` | `text` (nullable) | Contact email if listed |
| `industries` | `text[]` | Parsed from pipe-delimited Sheet field |
| `topics` | `text[]` | Parsed from pipe-delimited Sheet field |
| `communities` | `text[]` | Parsed from pipe-delimited Sheet field |
| `locations` | `text[]` | Counties / regions; empty = statewide |
| `created_at` | `timestamptz` | Default `now()` |

**Field semantics:**
- `industries` — Sheet values like `Software and Information Technology`, `Manufacturing`, `Agriculture`, `Healthcare`, `Hospitality and Food Services`. **Verify the canonical list against the actual Sheet — do not invent values.**
- `topics` — Funding, Talent, Marketing, Legal/Compliance, Community, Start a Business, Late Stage Growth, etc. **Same rule: verify against the Sheet.**
- `communities` — Student, Rural, Women, Veteran, Multicultural, New American.
- `locations` — Utah counties or "Statewide."

### `businesses` (feat/map branch)

Self-service company profiles for the Map.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | Default `gen_random_uuid()` |
| `name` | `text` (required) | |
| `website` | `text` (required) | |
| `employees` | `int` (required) | Headcount band stored as midpoint, or use enum text |
| `sector` | `text` (required) | Same vocabulary as `resources.industries` |
| `year_founded` | `int` (required) | |
| `linkedin` | `text` (nullable) | |
| `description` | `text` (required) | Max 500 chars |
| `address` | `text` (required) | Or split into `city`, `state`, `zip` |
| `is_hiring` | `boolean` | Default `false` |
| `job_postings` | `jsonb` | Array of `{ title, link }` |
| `photo_urls` | `text[]` | Hosted via Supabase Storage |
| `is_verified` | `boolean` | Default `false` (Phase 2 email verification) |
| `created_at` | `timestamptz` | Default `now()` |

11 user-facing fields per the brief: name, website, employees, sector, year founded, linkedin, description, address, hiring status, job postings, photo gallery. ✅

### `feedback`

Per-card thumbs + "didn't apply because…" data for GOEO analytics.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | |
| `resource_id` | `text` (FK → resources.id) | |
| `session_id` | `text` | Anonymous client-generated UUID, stored in localStorage |
| `vote` | `text` | `'up'` or `'down'` |
| `reason` | `text` (nullable) | Free text for "didn't apply because…" |
| `quiz_stage` | `text` (nullable) | Snapshot of quiz state at vote time |
| `quiz_industry` | `text` (nullable) | |
| `quiz_topic` | `text` (nullable) | |
| `created_at` | `timestamptz` | Default `now()` |

### `concierge_questions`

Question log for the AI concierge — the analytics secret weapon.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | |
| `session_id` | `text` | Same anonymous UUID as `feedback` |
| `question_text` | `text` | What the user asked |
| `was_answered` | `boolean` | `true` if cited resources, `false` if escalated |
| `cited_resource_ids` | `text[]` | Resources the concierge cited |
| `quiz_stage` | `text` (nullable) | |
| `quiz_industry` | `text` (nullable) | |
| `quiz_topic` | `text` (nullable) | |
| `created_at` | `timestamptz` | Default `now()` |

**Why this matters for judging:** A simple SQL query — `SELECT question_text FROM concierge_questions WHERE was_answered = false ORDER BY created_at DESC` — gives GOEO a rolling content-gap report. We are not just a navigator. We are an analytics product for the state.

---

## The scoring algorithm

Drives the **"Your Relevant Resources"** panel ranking. Does **NOT** drive "Do This Now" (which is hand-curated by stage — see Roadmaps section below).

### Inputs

```ts
type QuizAnswer = {
  stage: 'pre-revenue' | 'early-revenue' | 'scaling' | 'established';
  established_intent?: 'utah-based' | 'relocating';  // only if stage === 'established'
  industry: 'software-it' | 'healthcare' | 'manufacturing' | 'agriculture' | 'hospitality-food' | 'other';
  topic: 'funding' | 'talent-hiring' | 'community' | 'legal-compliance' | 'marketing';
  // optional/derived:
  location?: string;  // user's county if known
};
```

### Pseudocode

```ts
function scoreResource(resource: Resource, answer: QuizAnswer): number {
  let score = 0;

  // Industry match (highest weight — most specific)
  if (resource.industries.includes(answer.industry)) {
    score += 100;
  } else if (answer.industry === 'other') {
    score += 50;  // soft fallback for "Other" industry
  }

  // Topic match (high weight — explicit user need)
  if (resource.topics.includes(answer.topic)) {
    score += 80;
  }

  // Stage → Communities mapping (medium weight)
  // ⚠️ FLAGGED FOR REVIEW — see "Open question" below
  if (stageMatchesAnyCommunity(answer.stage, resource.communities)) {
    score += 40;
  }

  // Location match (light weight)
  if (answer.location && resource.locations.includes(answer.location)) {
    score += 20;
  }

  // Diversity / inclusion bonus (slight boost)
  if (hasInclusionTag(resource.communities)) {
    score += 5;
  }

  // Relocation bonus — Established + Relocating gets a hard boost on relocation/tax-incentive resources
  if (answer.established_intent === 'relocating' && isRelocationResource(resource)) {
    score += 60;
  }

  return score;
}
```

### Scoring weights

| Match | Points | Why |
|---|---|---|
| Industry exact | +100 | Most specific signal |
| Industry = "Other" fallback | +50 | Don't punish niche industries |
| Topic exact | +80 | User explicitly asked for this |
| Stage → Communities | +40 | See open question below |
| Location exact | +20 | Nice-to-have, not critical |
| Inclusion tag bonus | +5 | Light boost for inclusive programs |
| Relocation match (conditional) | +60 | Established+Relocating must surface tax incentives |
| **Theoretical max** | **305** | Industry + Topic + Stage + Location + Inclusion + Relocation |

### Tiebreakers

1. Higher score wins.
2. If tied, alphabetical by `title` (deterministic, no surprises).

### Skip behavior

| Skip point | Behavior |
|---|---|
| Skip on landing (Q1) | Bypass scoring. Show all resources at `/resources`, sorted alphabetically, fully filterable. |
| Skip on Q2 | Industry = `null`. Score on Stage + Topic only. Return top 15. |
| Skip on Q3 | Topic = `null`. Score on Stage + Industry only. Return top 15. |

### Open question — flagged for Beau

> **⚠️ The Stage → Communities mapping conflates two distinct dimensions.**
>
> The current proposal says:
> - Pre-revenue → [Student, Rural, Multicultural, New American]
> - Early revenue → [Student, Multicultural, New American, Women]
> - Scaling → [Women, Veteran, (any)]
> - Established → [Any]
>
> But "Stage" (where is the company in its lifecycle?) and "Community" (does the founder belong to an underserved/affinity group?) are **independent axes**. A pre-revenue founder can be a veteran. A scaling founder can be a student. The current mapping forces a stretch correlation.
>
> **Two cleaner approaches Beau should consider:**
>
> 1. **Drop the Communities tie to Stage entirely.** Score Stage against a separate `stages` field on resources (which we'd derive from the Sheet by tagging each resource with the stages it serves). +40 if the resource serves the user's stage. Communities then becomes an optional separate quiz question we don't ask in v1.
>
> 2. **Keep the current mapping but acknowledge it's a heuristic.** Document it as "Stage X founders historically benefit from Community Y resources" rather than "Stage X = Community Y." Lower the weight from +40 to +25 to reflect the looser correlation.
>
> **Beau, please pick one and post in Slack before 8 AM tomorrow.** The scoring code can ship with either choice; what matters is we're honest about what the +40 represents.

---

## Hand-curated stage roadmaps (drives "Do This Now")

Each Stage answer triggers a curated 3-item action list. These are **not scored** — they are deliberate, ordered, time-bound recommendations for the founder's current chapter.

Stored in `supabase/seed/roadmaps.json` and loaded into a `stage_roadmaps` table or just imported as JSON at build time.

### Schema

```ts
type RoadmapItem = {
  id: string;
  title: string;
  one_liner: string;           // "what it is in one sentence"
  eligibility: string;         // "Who qualifies"
  deadline: string | null;     // ISO date or "Rolling"
  time_to_apply: string;       // "2 hours" / "1 week"
  estimated_cost: string;      // "Free" / "$50 filing fee"
  why_this: string;            // "why this is on your dashboard" — populated per stage
  link: string;                // direct apply URL
  resource_id?: string;        // optional FK to resources table
};

type StageRoadmap = {
  stage: 'pre-revenue' | 'early-revenue' | 'scaling' | 'established-utah' | 'established-relocating';
  items: RoadmapItem[];        // exactly 3
};
```

### Initial roadmaps (Beau seeds, all of us review)

> **Drew + Beau collaborate on the actual content.** These are starter shapes, not final copy.

**Pre-revenue (3 items):**
1. Validate the idea — Lassonde Founder Friday or local SBDC office hours
2. Take the free Business Idea Challenge
3. Draft a one-page business plan (template + walkthrough)

**Early revenue (3 items):**
1. Register with the state — UT Department of Commerce one-stop registration
2. Apply for a microgrant (specific program from the Sheet)
3. Find your SBDC counselor (regional match)

**Scaling (3 items):**
1. Pitch readiness — apply to next pitch competition
2. Talent pipeline — Talent Ready Utah / WTC Utah workforce program
3. Capital ladder — local angel groups + accelerators (Kickstart, Pelion, RevRoad, etc.)

**Established + Utah-based (3 items):**
1. Government contracts — APEX Accelerator (formerly PTAC)
2. International trade — World Trade Center Utah, STEP grant
3. Workforce expansion — talent program of best fit

**Established + Relocating (3 items):**
1. Tax incentive review — GOEO Economic Development Tax Increment Financing (EDTIF)
2. Relocation services — World Trade Center Utah business relocation team
3. Site selection — county economic development office contacts

Real content TBD by Beau cross-referenced with Drew. Get something defensible in by 9:30 AM tomorrow.

### Checkbox progression

- Each roadmap item has a checkbox.
- Checking the box stores `{ session_id, item_id, completed_at }` to localStorage (no DB write needed for v1).
- Once all 3 items in a stage are checked, the dashboard shows: *"You're ready for the next chapter →"* with a button to re-take the quiz at the next stage.
- This is the "founder progression" loop. Subtle, but it's the thing that turns the dashboard into a return visit.

---

## "People to Meet This Month" data

Static seed file: `supabase/seed/people.json`. Stub for v1 (placeholder names + roles), real photos and Calendly links populated post-hackathon if GOEO partners.

```ts
type Person = {
  id: string;
  name: string;
  role: string;                // "SBDC Counselor — Salt Lake Region"
  org: string;                 // "Salt Lake SBDC"
  photo_url: string | null;
  calendar_link: string | null;
  matches: {
    stages?: string[];
    industries?: string[];
    topics?: string[];
    regions?: string[];
  };
};
```

**Matching logic:** dashboard surfaces 3 people whose `matches` overlap most with the user's quiz answers. If fewer than 3 match strongly, fill from "Statewide" people.

**Source for real data (post-hackathon):** GOEO staff directory, regional SBDC pages, university tech transfer offices, accelerator program directors. For the demo, ~12 stub entries covering all stages × topics is sufficient.
