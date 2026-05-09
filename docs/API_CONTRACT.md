# API Contract

**Frozen by 9:00 AM tomorrow.** Cayden builds against these shapes; Beau implements them. If Beau is behind, Cayden builds against `lib/mockApi.ts` (Beau ships in 5 min — see below) and swaps the import at integration time.

All endpoints return JSON. All errors return `{ error: string, code: string }` with appropriate HTTP status.

---

## Conventions

- **Base URL (production):** `https://<netlify-domain>` — same origin as the SPA
- **Supabase queries:** the front-end can call Supabase directly via the JS SDK for simple reads (`resources`, `businesses`). The endpoints below are for compound logic (scoring, concierge, multi-table writes).
- **Auth:** none in v1. Session identification is via a client-generated UUID stored in localStorage.

---

## `POST /api/quiz/score`

Run the scoring algorithm and return ranked resources for "Your Relevant Resources."

### Request
```json
{
  "stage": "scaling",
  "established_intent": null,
  "industry": "agriculture",
  "topic": "talent-hiring",
  "location": "Washington"
}
```

All fields except `stage` may be `null` (skip behavior). `established_intent` is non-null only if `stage === "established"`.

### Response (200)
```json
{
  "results": [
    {
      "id": "res_utah_dept_ag",
      "title": "Utah Department of Agriculture",
      "description": "State agency offering grants, certifications, and rural development support.",
      "link": "https://...",
      "email": "contact@...",
      "industries": ["agriculture"],
      "topics": ["funding", "community"],
      "communities": ["rural"],
      "locations": ["statewide"],
      "score": 220,
      "match_reasons": ["industry", "stage", "location"]
    },
    ...
  ],
  "count": 15,
  "total_evaluated": 100
}
```

`match_reasons` is an array indicating which inputs contributed points. Used by the front-end for the "why this is here" pill on each card.

### Errors
- `400` — invalid stage value
- `500` — DB failure (front-end shows a "we're having trouble loading resources" toast and falls back to all-resources view)

---

## `GET /api/resources`

Return all resources, optionally filtered. Used by `/resources` page (skip target).

### Query params
| Param | Example | Notes |
|---|---|---|
| `industry` | `agriculture` | Single value |
| `topic` | `funding` | Single value |
| `community` | `women` | Single value |
| `location` | `Washington` | Single value |
| `q` | `mentor` | Free-text search across title + description |
| `sort` | `alpha` \| `recent` | Default `alpha` |

### Response (200)
```json
{
  "results": [ ...same shape as scoring response, minus score and match_reasons... ],
  "count": 100
}
```

---

## `GET /api/resources/:id`

Single resource detail.

### Response (200)
```json
{
  "id": "res_utah_dept_ag",
  "title": "Utah Department of Agriculture",
  "description": "...",
  "link": "...",
  "email": "...",
  "industries": ["agriculture"],
  "topics": ["funding"],
  "communities": ["rural"],
  "locations": ["statewide"]
}
```

### Errors
- `404` — resource not found

---

## `POST /api/feedback`

Record per-card thumbs / "didn't apply because" feedback.

### Request
```json
{
  "resource_id": "res_utah_dept_ag",
  "session_id": "anon_a3f9...",
  "vote": "down",
  "reason": "I'm not in agriculture, just landscaping",
  "quiz_stage": "scaling",
  "quiz_industry": "agriculture",
  "quiz_topic": "talent-hiring"
}
```

`reason` is optional. `vote` must be `"up"` or `"down"`.

### Response (200)
```json
{ "ok": true }
```

---

## `POST /api/concierge`

The AI concierge. Proxies to Anthropic via Netlify Function. See `AI_CONCIERGE.md` for the full system prompt and grounding strategy.

### Request
```json
{
  "session_id": "anon_a3f9...",
  "message": "I'm a freight broker scaling rapidly. Are there logistics-specific resources?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "quiz_context": {
    "stage": "scaling",
    "industry": "other",
    "topic": "funding"
  }
}
```

`history` is the last N turns (cap at 6 to keep context cheap). `quiz_context` is included in the system prompt so the concierge personalizes.

### Response (200)
```json
{
  "answer": "Utah doesn't have a logistics-specific accelerator, but the World Trade Center Utah supports freight and logistics expansion through their international trade programs [1]. For scaling-stage capital, Pelion and Kickstart Fund both invest in B2B SaaS, including logistics tech [2][3].",
  "citations": [
    { "id": "res_wtc_utah", "title": "World Trade Center Utah" },
    { "id": "res_pelion", "title": "Pelion Venture Partners" },
    { "id": "res_kickstart", "title": "Kickstart Fund" }
  ],
  "was_answered": true
}
```

If the catalog has no relevant match:
```json
{
  "answer": "I don't have a state resource that matches that exactly. I've logged your question for the GOEO team — they review these regularly and add new resources based on what founders are asking for.",
  "citations": [],
  "was_answered": false
}
```

The endpoint **always** writes a row to `concierge_questions` regardless of `was_answered`.

### Errors
- `429` — rate limit exceeded (per-session, 20 questions per hour). Front-end shows "Take a breath, we're here all day."
- `500` — Anthropic API failure. Front-end falls back to "Try the search at /resources."

---

## `POST /api/businesses` (feat/map branch)

Create or claim a business profile.

### Request
```json
{
  "name": "Acme Robotics",
  "website": "https://acme.com",
  "employees": 12,
  "sector": "manufacturing",
  "year_founded": 2022,
  "linkedin": "https://linkedin.com/company/acme",
  "description": "We build robotic arms.",
  "address": "123 Main St, Provo, UT 84601",
  "is_hiring": true,
  "job_postings": [
    { "title": "Senior Robotics Engineer", "link": "..." }
  ],
  "photo_urls": []
}
```

### Response (201)
```json
{ "id": "biz_uuid", "is_verified": false }
```

### Errors
- `400` — validation failure (zod returns specific field errors). Response includes `{ errors: { field: "message", ... } }`.

---

## `GET /api/businesses`

Directory list with filters.

### Query params
| Param | Example |
|---|---|
| `sector` | `software-it` |
| `min_employees` | `10` |
| `max_employees` | `100` |
| `is_hiring` | `true` |
| `region` | `Utah County` |
| `q` | `robotics` |
| `sort` | `name` \| `recent` |

### Response (200)
```json
{
  "results": [ ...business objects... ],
  "count": 247
}
```

---

## `GET /api/businesses/:id`

Single business profile (public).

---

## Mock API for parallel front-end development

If Beau's API isn't ready by 9:15 AM, Cayden imports from `src/lib/mockApi.ts` instead of the real client. Beau ships this file FIRST (before the real implementation) so Cayden is unblocked.

```ts
// src/lib/mockApi.ts
import type { QuizAnswer, ScoredResource } from '@/types';
import resourcesJson from '@/data/resources.json';

export async function postQuizScore(answer: QuizAnswer): Promise<{ results: ScoredResource[]; count: number }> {
  // Returns a deterministic mock based on answer.stage so demos work even offline
  await new Promise(r => setTimeout(r, 300));  // simulated latency
  const top = resourcesJson.slice(0, 15).map((r, i) => ({
    ...r,
    score: 200 - i * 10,
    match_reasons: ['industry', 'topic'],
  }));
  return { results: top, count: top.length };
}

// ...one mock per endpoint
```

**Rule:** the mock file's exports MUST match the real client's exports 1:1. Same function names, same shapes. Swap = one-line change.
