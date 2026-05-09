# Founder's Navigator — Product Context

> **Build order**: This is Product 1. Build and polish this before starting the Startup Map.

## Problem Statement

Founders can't efficiently discover Utah's state startup support programs. startup.utah.gov functions like a library when founders need a guided tour. The Navigator solves this with a personalized intake flow + AI-powered matching.

## What It Does

1. Founder fills a **multi-step intake form** (structured fields + optional free-text business description)
2. System runs **hybrid search**: deterministic SQL filter + semantic pgvector similarity
3. **Claude reranks** the top candidates and writes a personalized next-steps guide
4. Founder receives **top resource matches** + a **recommended GOED contact** + **next steps guide**

## Resource Data

**Source**: Google Sheet (100 resources)
- URL: https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/edit?usp=sharing
- **Import strategy**: One-time import to Supabase `resources` table. GOED staff update via Supabase table editor (no redeployment needed).

**Schema columns from the sheet**:
| Column | Values |
|--------|--------|
| id | integer |
| Title | string |
| description | string |
| Communities | Student / Women / Veteran / Multicultural / New American / Rural / Any |
| Industries | Aerospace / Agriculture / Arts / CPG / Financial / Hospitality / Life Sciences / Manufacturing / Software / Other |
| Locations | (Utah regions/cities) |
| Topics | Funding / Start a Business / Late Stage Growth / Marketing and Sales / International Trade / Close or Exit / Relocate / Taxes and Finance / Other |
| link | URL |
| email | contact email |

## Supabase Schema

```sql
-- Resources table
create table resources (
  id bigint primary key,
  title text not null,
  description text,
  communities text[],        -- array of enum values
  industries text[],         -- array of enum values
  locations text[],          -- array of region strings
  topics text[],             -- array of enum values
  link text,
  email text,
  embedding vector(1536)     -- pgvector, auto-generated
);

-- GOED contacts table (to be built/sourced later)
create table contacts (
  id bigint primary key generated always as identity,
  name text,
  role text,
  email text,
  topics text[],             -- maps to resource Topics
  communities text[]         -- maps to resource Communities
);
```

## Search Pipeline

```
User Input
  └── Structured fields (community, industry, location, topics)
        └── SQL WHERE filter: communities && $communities AND industries && $industries ...
  └── Free text description
        └── Claude/OpenAI embedding → cosine similarity (pgvector)

Hybrid result set (ranked by combined score)
  └── Top 10-15 candidates → Claude reranking prompt
        └── Returns top 5 resources with explanations
        └── Returns personalized next-steps guide (markdown)

Contact recommendation
  └── Match user topics/communities → contacts table (LATER STAGE)
```

## Edge Functions

| Function | Purpose |
|----------|---------|
| `embed-resources` | One-time + triggered: generate embeddings for resource descriptions |
| `search-resources` | Hybrid search: SQL filter + pgvector similarity |
| `generate-next-steps` | Claude call: rerank candidates + write next-steps guide |

## Frontend (Vue 3 + GSAP)

### Intake Wizard (multi-step form)
- Step 1: Business stage (ideation / early / growth / established)
- Step 2: Industry (multi-select from sheet Industries enum)
- Step 3: Community (multi-select from sheet Communities enum)
- Step 4: Location (Utah region selector)
- Step 5: Topics of interest (multi-select from sheet Topics enum)
- Step 6: Free-text business description (optional, "Tell us about your business")
- GSAP transitions between steps (slide/fade)
- Progress indicator

### Results Page
- GSAP stagger entrance on resource cards
- Each card: Title, description excerpt, topics tags, link CTA
- "Why this matched you" tooltip/expand (from Claude reranking)
- Next-steps guide section (rendered markdown)
- Contact card section (placeholder until contact data sourced)

## Content Management

- GOED staff edit resources directly in Supabase table editor
- Supabase auto-embeddings re-trigger on row update → semantic search stays fresh
- No developer involvement needed for content updates

## GOED Contact Directory

- **Status**: Not yet sourced. Needs to be found/created in a later stage.
- **Plan**: Create a `contacts` table with GOED staff names, roles, emails, and topic/community mappings. Recommend a contact based on the user's matched topics.
- **Interim**: Show resource email as the contact point, or omit contact section until data is ready.

## Future Roadmap

- Google OAuth login → saved searches, personalized history
- Contact recommendation once staff directory is sourced

## Key Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Content updates | Supabase table editor | GOED staff don't need to touch Google Sheets or code |
| Embeddings | Supabase auto-embeddings | Re-triggers on edit, no pipeline maintenance |
| Contact data | Later stage | Not available yet, don't block Navigator build |
| Claude role | Reranking + next-steps generation | Semantic understanding of founder context |
| Form style | Multi-step wizard | Reduces cognitive load vs. single long form |
