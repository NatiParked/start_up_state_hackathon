# Beau — Data + Back-End

You own the resource catalog, the database, the scoring API, the concierge proxy, and the seed content. Without your work, everything Cayden builds renders empty.

---

## Tonight (1:30–2:30 PM) — 15 minutes

### Task: Parse the Sheet → JSON

1. Open the [Resources Spreadsheet](https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/edit).
2. Export to CSV or copy-paste into a parsing script.
3. Output `data/resources.json` matching this shape:
   ```json
   [
     {
       "id": "res_lassonde_founder_friday",
       "title": "Lassonde Founder Friday",
       "description": "Weekly office hours and peer feedback for student and early-stage founders.",
       "link": "https://lassonde.utah.edu/...",
       "email": "info@lassonde.utah.edu",
       "industries": ["software-it", "other"],
       "topics": ["community", "start-a-business"],
       "communities": ["student"],
       "locations": ["Salt Lake County", "statewide"]
     },
     ...
   ]
   ```
4. **Normalization rules:**
   - `id`: slug from title, prefixed `res_`. Stable across reloads.
   - Pipe-delimited Sheet fields → arrays. Split on `|`, trim, lowercase, kebab-case.
   - Empty fields → empty arrays, not `null`.
   - "Statewide" is a valid location value.

### Don't get stuck on parser perfection

If the parser is fighting you, **clean by hand**. It's 100 rows. Hand-cleaning takes 20 minutes; building a perfect parser takes 90 minutes.

### Output at 2:30 PM

- `data/resources.json` exists with all ~100 entries
- File is committed to the repo

---

## Tomorrow

### Before 8:00 AM — pick the Stage → Communities interpretation

See `OPEN_QUESTIONS.md` OQ-2.

**Two options:**
- **A:** Drop Communities from Stage scoring. Add a separate `stages` field to each resource (you tag during ingestion). +40 if user's stage is in `resource.stages`.
- **B:** Keep the heuristic mapping but lower weight from +40 to +25 to reflect the looser correlation.

Pick one, post in Slack, update `DATA_MODEL.md` and `lib/scoring.ts`.

**My lean: Option A.** It's more honest, it's only 30 minutes of extra tagging work, and it produces better matches for the demo personas. But you live in this data — your call.

### 8:00–9:00 AM — Foundations

#### Supabase schema

Create migrations in `supabase/migrations/`:

```sql
-- 001_resources.sql
create table resources (
  id text primary key,
  title text not null,
  description text not null,
  link text not null,
  email text,
  industries text[] not null default '{}',
  topics text[] not null default '{}',
  communities text[] not null default '{}',
  stages text[] not null default '{}',  -- only if Option A
  locations text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 002_businesses.sql
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text not null,
  employees text not null,
  sector text not null,
  year_founded int not null,
  linkedin text,
  description text not null,
  address text not null,
  is_hiring boolean not null default false,
  job_postings jsonb not null default '[]',
  photo_urls text[] not null default '{}',
  is_verified boolean not null default false,
  session_id text,
  created_at timestamptz not null default now()
);

-- 003_feedback.sql
create table feedback (
  id uuid primary key default gen_random_uuid(),
  resource_id text references resources(id) on delete cascade,
  session_id text not null,
  vote text not null check (vote in ('up', 'down')),
  reason text,
  quiz_stage text,
  quiz_industry text,
  quiz_topic text,
  created_at timestamptz not null default now()
);

-- 004_concierge_questions.sql
create table concierge_questions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  question_text text not null,
  was_answered boolean not null,
  cited_resource_ids text[] not null default '{}',
  quiz_stage text,
  quiz_industry text,
  quiz_topic text,
  created_at timestamptz not null default now()
);

-- 005_founder_profiles.sql
create table founder_profiles (
  id uuid primary key default gen_random_uuid(),
  session_id text unique not null,
  name text not null,
  email text not null,
  stage text,
  industry text,
  topics text[] not null default '{}',
  region text,
  created_at timestamptz not null default now()
);
```

Run migrations against Supabase. Verify tables exist via dashboard.

#### Load resources into Supabase

```ts
// supabase/scripts/seed-resources.ts
import { createClient } from '@supabase/supabase-js';
import resources from '../../data/resources.json';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

await supabase.from('resources').upsert(resources, { onConflict: 'id' });
console.log(`Seeded ${resources.length} resources.`);
```

Run once. Verify count in Supabase dashboard.

#### Lock scoring code

Pair with Cayden on `lib/scoring.ts`. Pure function, no IO. Same code runs in the API endpoint.

```ts
// lib/scoring.ts
import type { Resource, QuizAnswer, ScoredResource } from '@/types';

const STAGE_COMMUNITIES: Record<string, string[]> = {
  'pre-revenue': ['student', 'rural', 'multicultural', 'new-american'],
  'early-revenue': ['student', 'multicultural', 'new-american', 'women'],
  'scaling': ['women', 'veteran'],
  'established': [],  // matches everything via early-out
};

const RELOCATION_TOPICS = ['relocation', 'tax-incentive', 'site-selection'];

export function scoreResource(resource: Resource, answer: QuizAnswer): { score: number; match_reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Industry
  if (answer.industry && resource.industries.includes(answer.industry)) {
    score += 100;
    reasons.push('industry');
  } else if (answer.industry === 'other') {
    score += 50;
  }

  // Topic
  if (answer.topic && resource.topics.includes(answer.topic)) {
    score += 80;
    reasons.push('topic');
  }

  // Stage (if Option A: check resource.stages directly; if Option B: use mapping)
  if (answer.stage && resource.stages?.includes(answer.stage)) {
    score += 40;
    reasons.push('stage');
  } else if (answer.stage) {
    // Option B fallback
    const allowed = STAGE_COMMUNITIES[answer.stage];
    if (allowed.length === 0 || resource.communities.some(c => allowed.includes(c))) {
      score += 25;  // lower weight per OQ-2 resolution
      reasons.push('stage-community');
    }
  }

  // Location
  if (answer.location && resource.locations.includes(answer.location)) {
    score += 20;
    reasons.push('location');
  }

  // Inclusion bonus
  if (resource.communities.some(c => ['women', 'veteran', 'multicultural'].includes(c))) {
    score += 5;
  }

  // Relocation
  if (answer.established_intent === 'relocating' && resource.topics.some(t => RELOCATION_TOPICS.includes(t))) {
    score += 60;
    reasons.push('relocation');
  }

  return { score, match_reasons: reasons };
}
```

### 9:00–11:00 AM — APIs

#### `POST /api/quiz/score` (Netlify Function)

```ts
// netlify/functions/quiz-score.ts
import { createClient } from '@supabase/supabase-js';
import { scoreResource } from '../../src/lib/scoring';

export default async (req: Request) => {
  const answer = await req.json();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

  const { data: resources } = await supabase.from('resources').select('*');
  if (!resources) return Response.json({ error: 'db-error' }, { status: 500 });

  const scored = resources
    .map(r => ({ ...r, ...scoreResource(r, answer) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 15);

  return Response.json({ results: scored, count: scored.length, total_evaluated: resources.length });
};
```

#### `GET /api/resources` + `GET /api/resources/:id`

Direct Supabase queries from the client are fine for these. Cayden uses the SDK.

#### `POST /api/feedback`

Tiny endpoint. Insert and return `{ ok: true }`.

#### `POST /api/businesses` + `GET /api/businesses` + `GET /api/businesses/:id`

Validate input with zod (same schema Cayden uses for the form). Insert into `businesses`. Return `id`.

### 9:30 AM — Roadmap content

Seed `data/roadmaps.json` with all 5 stage variants × 3 items. Use real Utah resources from the catalog.

**Drew should review your copy.** Tone: direct and warm, not cute. See `AI_CONCIERGE.md` for the tone reference.

### 10:00 AM — People stub data

Seed `data/people.json` with 12 entries. Recommend covering:

- 3 SBDC counselors (regional: Salt Lake, Southwest/St. George, Northern/Ogden)
- 3 GOEO sector leads (mock: Software/IT, Healthcare, Agriculture)
- 3 accelerator program directors (Kickstart, BoomStartup, RevRoad — public info available)
- 2 university tech transfer reps (PIVOT Center at U of U, BYU's tech transfer office)
- 1 international trade rep (World Trade Center Utah)

Each entry's `matches` field decides which personas they appear for.

### 11:00–11:50 AM — Concierge

If Cayden is on schedule:

1. Implement `netlify/functions/concierge.ts` per `AI_CONCIERGE.md`.
2. Bundle the resources JSON into the function (don't query Supabase per-call; module-scope cache).
3. Verify the citation parser. Test with 3-4 queries against Maria + Priya quiz contexts.
4. Verify rows are landing in `concierge_questions`.

If behind: skip. The dashboard is the demo.

### 11:50 AM–12:40 PM — Testing

- Run scoring against all 6 personas. Sanity-check the top 3 results for each. If a result feels wildly off, inspect the resource's tags — usually a Sheet typo.
- Verify all API endpoints return correct shapes.
- Verify feedback rows insert correctly.
- If concierge shipped: verify questions log correctly and citations are valid IDs.

### 12:30 PM — Demo data seed

Insert 5 demo businesses on `feat/map`:

```sql
insert into businesses (name, website, employees, sector, year_founded, description, address, is_hiring) values
  ('Acme Robotics', 'https://acme.example', '11-50', 'manufacturing', 2022, '...', '...', true),
  ...;
```

Use real-ish Utah company names from the Map data Sheet so the directory looks alive.

---

## Files you own

```
data/
├── resources.json
├── roadmaps.json
├── people.json
└── businesses-seed.json     (demo seed)

supabase/
├── migrations/
│   ├── 001_resources.sql
│   ├── 002_businesses.sql
│   ├── 003_feedback.sql
│   ├── 004_concierge_questions.sql
│   └── 005_founder_profiles.sql
└── scripts/
    ├── seed-resources.ts
    └── seed-businesses.ts

netlify/functions/
├── quiz-score.ts
├── concierge.ts
└── businesses.ts            (POST handler)

src/lib/
└── scoring.ts               (shared with Cayden — pair on this)
```

---

## Cutlines

| Time | Drop in this order |
|---|---|
| 9:30 AM with score API not done | Hardcode top 15 by industry+topic match (no scoring), ship that |
| 10:00 AM with roadmaps not seeded | Manually write 3 items for the demo personas' stages only (Scaling × 2) |
| 10:30 AM with people stubs not done | Skip. Show 3 generic placeholders. Mention as "data integration Phase 2." |
| 11:00 AM with feedback API not done | Cut entirely. The widget is a polish item. |
| 11:50 AM with concierge incomplete | Cut. Don't ship a broken concierge — better to not have it. |

**Never cut:**
- The score API for the demo personas (Maria + Priya). The dashboard is empty without it.
- Resource catalog loaded into Supabase.
- At least Scaling-stage roadmap content (covers Maria + Priya, the demo personas).

---

## Slack pings to expect from you

- Tonight: "Resources JSON parsed, [N] entries, committed to [path]"
- Before 8 AM: "Stage scoring decision: Option [A/B] because [reason]"
- 9:00 AM: "Schema migrated, resources loaded"
- 10:00 AM: "Score API live, returning correct shapes for all 6 personas"
- 11:00 AM: "Roadmaps + people seeded"
- 12:00 PM: "Concierge: shipped / cut / debugging"

---

## When in doubt

- Match the API shapes in `API_CONTRACT.md` exactly. Cayden is building against them.
- The scoring algorithm is a heuristic, not a science. If a tweak makes the demo personas surface better matches, do it. The judging rubric values UX over algorithmic purity.
- Hand-curate over algorithm when in time pressure. A great Maria result that's hardcoded beats a mediocre algorithmic one.
- Burkely unblocks. Don't fight alone for >10 minutes.
