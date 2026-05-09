# AI Concierge ("Ask the State")

Grounded RAG-without-vectors using Claude. Ships only if Phases 1–5 close on schedule. Plan for it as nice-to-have.

---

## Core idea

Stuff the entire ~100-resource catalog into the system prompt as JSON. Claude reads it on every request, cites by ID, and refuses to invent answers. No vector store, no embeddings, no infra. Total build time: ~45 minutes.

The catalog is small enough (~30K tokens estimated) to fit comfortably in Claude's 200K context. Cost per call is trivial. Latency is acceptable for a single-shot, non-streaming chat.

---

## Why this approach

Considered and rejected alternatives:

| Approach | Why not |
|---|---|
| pgvector + embeddings | 3+ hours of infra setup. Catalog is too small for vector search to outperform a curated prompt. |
| OpenAI Assistants API | Vendor lock + slower iteration. We're already on Anthropic. |
| Streaming responses | +30 minutes of complexity (SSE wiring, state, cancellation). For a 6-hour build, not worth it. Single-shot is fine for the demo. |
| Function calling for citation extraction | Overkill for "return JSON with citations." A well-structured prompt + JSON parse does the job. |

---

## Architecture

```
Browser
  │ POST /api/concierge { message, history, quiz_context }
  ▼
Netlify Function (concierge.ts)
  │ 1. Load resources catalog from Supabase or bundled JSON (cached in module scope)
  │ 2. Build system prompt with catalog injected
  │ 3. Call Anthropic API (claude-sonnet-4.x)
  │ 4. Parse response → { answer, citations, was_answered }
  │ 5. Insert row into concierge_questions (Supabase)
  │ 6. Return JSON to browser
  ▼
Anthropic API
```

The Netlify Function is the only place the Anthropic API key exists. **Never** expose it to the client.

---

## System prompt

```
You are "Ask the State," an AI concierge for Utah's startup founders. You answer questions about Utah state resources for entrepreneurs.

# Your job
Answer the user's question using ONLY the resources in the CATALOG below. If a question can be answered from the catalog, answer it directly and cite the relevant resources by their `id`. If a question cannot be answered from the catalog, say so plainly and explain that the question has been logged for the GOEO team to consider adding new resources.

# Tone
Direct and warm, but not cute. Treat the user as a capable adult building a real company. No exclamation points. No "Great question!" No emoji. Plain sentences. If a program is competitive or hard to get into, say so. If a program is the obvious right fit, say so.

# Citation format
When you reference a resource, include its `id` in square brackets at the end of the sentence: [res_pelion]. Do not invent resource IDs. Only cite IDs that appear in the CATALOG.

# Personalization
The user has answered a brief quiz. Their context is provided in USER_CONTEXT. Tailor recommendations to their stage, industry, and topic. If their context is empty or incomplete, do your best with what you have.

# Strict rules
- NEVER invent resources, programs, contacts, or URLs that aren't in the CATALOG.
- NEVER mention training data, internet knowledge, or what other states offer. You only know about Utah's catalog.
- If asked something off-topic (recipes, code, etc.), redirect: "I help Utah founders find state resources. What are you working on?"
- Keep responses to 3 short paragraphs maximum unless the user explicitly asks for depth.
- If the catalog truly doesn't cover the question, your response MUST start with: "I don't have a state resource that matches that exactly."

# Output format
You will respond in plain prose with inline citations as `[resource_id]`. The application will parse your citations and render them as links. Do not output JSON, markdown headers, or code blocks unless the user explicitly asks for code.

---

CATALOG:
{INJECT_RESOURCES_JSON_HERE}

---

USER_CONTEXT:
- Stage: {quiz_context.stage or "unknown"}
- Industry: {quiz_context.industry or "unknown"}
- Topic of interest: {quiz_context.topic or "unknown"}
```

The function injects the catalog at request time. To save tokens, send a slim version per resource:

```json
{
  "id": "res_pelion",
  "title": "Pelion Venture Partners",
  "description": "Salt Lake City-based VC investing Series A in B2B SaaS.",
  "industries": ["software-it"],
  "topics": ["funding"],
  "communities": [],
  "locations": ["statewide"]
}
```

---

## Parsing the response

Claude returns prose with inline `[resource_id]` markers. The Netlify Function:

1. Extracts all `[res_*]` patterns into a `citations` array (deduplicated, ordered by first appearance).
2. Validates each ID exists in the catalog. Invalid IDs are dropped silently.
3. Sets `was_answered = !response.startsWith("I don't have a state resource that matches")`.
4. Inserts a row into `concierge_questions` with the question, was_answered flag, and validated citation IDs.
5. Returns to the client with both the prose and the structured citations array (so the front-end can render citation pills).

```ts
// netlify/functions/concierge.ts (sketch)
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import resources from './resources.json';  // bundled at build time

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

const CATALOG_JSON = JSON.stringify(resources.map(slim));
const SYSTEM_PROMPT = buildSystemPrompt(CATALOG_JSON);  // see template above

export default async (req: Request) => {
  const { message, history, quiz_context, session_id } = await req.json();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT.replace('{quiz_context.stage}', quiz_context.stage ?? 'unknown')
                          .replace('{quiz_context.industry}', quiz_context.industry ?? 'unknown')
                          .replace('{quiz_context.topic}', quiz_context.topic ?? 'unknown'),
    messages: [
      ...history.slice(-6),
      { role: 'user', content: message },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const citationIds = [...new Set(text.match(/\[(res_[a-z0-9_]+)\]/g)?.map(m => m.slice(1, -1)) ?? [])];
  const validCitations = citationIds
    .filter(id => resources.find(r => r.id === id))
    .map(id => {
      const r = resources.find(r => r.id === id)!;
      return { id, title: r.title };
    });
  const wasAnswered = !text.startsWith("I don't have a state resource that matches");

  await supabase.from('concierge_questions').insert({
    session_id,
    question_text: message,
    was_answered: wasAnswered,
    cited_resource_ids: validCitations.map(c => c.id),
    quiz_stage: quiz_context.stage,
    quiz_industry: quiz_context.industry,
    quiz_topic: quiz_context.topic,
  });

  return Response.json({ answer: text, citations: validCitations, was_answered: wasAnswered });
};
```

---

## Front-end UX

- Bottom sheet pinned to dashboard. Collapsed by default with placeholder text "Ask the State anything…"
- Click → expands to show input + history.
- After send: input disabled, send button shows spinner. ~3-5s wait. Response renders.
- Citations appear inline as small badges. Click → navigate to `/resources/:id`.
- If `was_answered === false`, render an additional secondary line: *"Logged for the GOEO team."* Subtle, slate-500.
- Rate limit feedback: 429 → "Take a breath, we're here all day."

### "Fake streaming"

To make the response feel live without real SSE:

```tsx
function useTokenStream(text: string, speed = 15) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i >= text.length) { clearInterval(id); return; }
      setShown(text.slice(0, ++i));
    }, speed);
    return () => clearInterval(id);
  }, [text]);
  return shown;
}
```

Reveals the answer ~15ms per char. Demo audience can't tell the difference from real streaming.

---

## Rate limiting

Per `session_id`:
- 20 requests per hour (rolling window).
- Track in Supabase `concierge_questions` by counting rows in the last 60 minutes for that session.
- Exceeded → return 429 immediately, don't call Anthropic.

For demo purposes this is overkill but cheap insurance against an accidental loop.

---

## Cost & latency

| Metric | Estimate |
|---|---|
| Catalog size | ~30K input tokens |
| Avg query | ~50 input + 200 output tokens user-side |
| Per-call cost (Sonnet) | ~$0.10 (mostly cached input) |
| Per-call latency | 2–4s |

For the hackathon demo: maybe 50 calls total. Cost: <$5.

---

## The analytics narrative (worth 5% of the 20% Innovation score)

When you demo the concierge, end with a beat that lands the value to GOEO, not just the founder:

> "Every question we can't answer becomes a content gap report for GOEO. They get a rolling list of what founders are asking that the catalog doesn't yet cover. We're not just helping founders — we're closing the feedback loop with the state."

Then flash a quick view of the `concierge_questions` table filtered to `was_answered = false`. Doesn't have to be a real admin dashboard — a SQL screenshot or a simple `/admin/gaps` page is enough.

This single moment can move the Innovation score from 12/20 to 18/20. **Don't skip the framing.**

---

## Open questions for the build

- **Tone calibration:** test against Maria + Priya queries before demo. If responses feel too formal or too cute, adjust the prompt.
- **Caching:** consider caching `(quiz_context, message)` pairs for repeat demo runs so we don't burn API calls during rehearsal.
- **Fallback:** if Anthropic API errors, return a static "I'm having trouble. Try the search at /resources." Don't let the API failure cascade.
