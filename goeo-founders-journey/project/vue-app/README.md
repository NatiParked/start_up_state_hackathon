# Founder's Navigator — Vue source

Vue 3 + Vite + Tailwind + GSAP. Drops onto Netlify.

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build      # outputs to dist/
npm run preview    # serves dist/
```

## Deploy to Netlify
1. Push this folder to a GitHub repo.
2. New site → "Import from Git" → pick repo.
3. Netlify auto-reads `netlify.toml` (build = `npm run build`, publish = `dist`).
4. Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` once Supabase is ready.

The SPA fallback redirect in `netlify.toml` makes vue-router refresh-safe.

## Architecture

```
src/
  api/index.js          ← single service layer. Local JSON now,
                          Supabase the moment you set env vars.
  data/resources.json   ← 213 resources (parsed from CSV)
  state/quiz.js         ← reactive quiz answers (replace w/ Pinia later)
  router/index.js       ← 5 routes: /, /quiz, /results, /resource/:id, /submit
  views/                ← one .vue per route
  components/           ← TopNav, SiteFooter
  assets/
    main.css            ← tailwind directives
    tokens.css          ← editorial design tokens (palette, type, components)
```

## Switching to Supabase

`src/api/index.js` already branches on `useSupabase`. Tables expected:

```sql
create table resources (
  id text primary key,
  title text not null,
  description text,
  communities text[],
  industries text[],
  locations text[],
  topics text[],
  link text,
  email text
);

create table startup_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  founded int,
  sector text,
  employees int,
  hiring text,
  postings text,
  description text not null,
  linkedin text,
  address text,
  photo_url text,
  created_at timestamptz default now()
);
```

Seed `resources` with `data/resources.json` once and the app reads from Supabase automatically.

## Design tokens
- `IM Fell English` — display
- `Libre Baskerville` — body
- `Special Elite` — UI labels
- Palette: ink `#1a1a1a`, bone `#f8f8f6`, cedar `#6b7d6a`, storm `#4a5f7f`, rust `#c85a54`, harvest `#d4a574`
