# Utah Startup Map — Product Context

> **Build order**: This is Product 2. Build after Founder's Navigator is complete and polished.

## Problem Statement

Utah has 96+ funded startups but they're invisible to founders and investors unless you know where to look. The Startup Map makes the ecosystem visible — both as a discovery tool for founders and as a signal of ecosystem health for investors.

## What It Does

- **Interactive map** of Utah startups with clickable pins
- **Filter sidebar**: sector, employee count, stage, hiring status, location
- **Company drawer**: click a pin to see company profile
- **Self-service submissions**: startups can add/claim their profile
- **Dual audience**: founders (find companies to learn from / partner with) + investors (ecosystem overview)

## Startup Data

**Source**: Google Sheet (96 companies)
- URL: https://docs.google.com/spreadsheets/d/1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk/edit?usp=sharing
- **Import strategy**: One-time import with geocoding. Addresses → lat/lng via geocoding API on import.

**Schema columns from the sheet**:
| Column | Values |
|--------|--------|
| Display Type | (unknown, TBD from sheet) |
| LinkedIn Link | URL |
| Startup Name | string |
| Full Address | string (needs geocoding) |
| Description | string |
| Website | URL |
| Stage | Seed / Series A / Series B |
| # of Employees | 2-10 / 11-50 / 51+ |
| Section/Sector | B2B Software / FinTech / Security / Energy / Bio-Medical Tech / Consumer / Marketplaces |

## Self-Service Profile Fields

When a startup submits or claims their profile:
- Name
- Website
- Employees (range)
- Sector
- Year Founded
- LinkedIn
- Description
- Address (geocoded on submit)
- Hiring Status (boolean)
- Job Postings (links)
- Photo Gallery

## Supabase Schema

```sql
-- Startups table
create table startups (
  id bigint primary key generated always as identity,
  name text not null,
  description text,
  website text,
  linkedin text,
  address text,
  lat float8,               -- geocoded from address
  lng float8,               -- geocoded from address
  sector text,              -- B2B Software / FinTech / Security / Energy / Bio-Medical Tech / Consumer / Marketplaces
  stage text,               -- Seed / Series A / Series B
  employee_range text,      -- 2-10 / 11-50 / 51+
  year_founded int,
  is_hiring boolean default false,
  job_postings text[],
  photos text[],
  verified boolean default true,   -- true for imported data
  created_at timestamptz default now()
);

-- Pending submissions (unverified)
create table startup_submissions (
  id bigint primary key generated always as identity,
  startup_data jsonb,       -- full profile as submitted
  status text default 'pending',  -- pending / approved / rejected
  submitted_at timestamptz default now()
);
```

## Geocoding

- **Import**: Use Google Maps Geocoding API or Nominatim (free/OSM) to batch-geocode the 96 addresses on import. Store lat/lng in the `startups` table.
- **New submissions**: Supabase Edge Function geocodes the submitted address before inserting into `startup_submissions`.
- **Recommendation**: Nominatim first (free, no API key), fall back to Google Maps if accuracy is poor for Utah addresses.

## Map Implementation (vue3-openlayers)

**Library**: `vue3-openlayers` — Vue 3 component wrapper around OpenLayers. Actively maintained.

**Key components**:
- `ol-map` — main map container
- `ol-view` — center (Utah: ~39.32°N, 111.09°W), zoom level
- `ol-layer-tile` + `ol-source-osm` — OpenStreetMap base tiles
- `ol-vector-layer` + `ol-vector-source` + `ol-feature` — startup pins
- `ol-style` — custom pin styling (color by sector)
- `ol-overlay` — popup/tooltip on hover
- `ol-interaction-select` — click handler for opening drawer

**Clustering**: Use OL's built-in cluster source for dense areas (SLC downtown has many startups).

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│  [Filter Sidebar]  │  [OpenLayers Map]               │
│                    │                                 │
│  Sector: [v]       │   ○ ○  ○  ○                    │
│  Stage:  [v]       │     ○○   ○  ○                   │
│  Size:   [v]       │  ○    ○○     ○                  │
│  Hiring: [ ]       │                                 │
│                    │  [Company Drawer slides in →]   │
│  96 startups       │                                 │
└─────────────────────────────────────────────────────┘
```

**Company Drawer** (slides in from right on pin click, GSAP):
- Logo / photo
- Name, sector, stage, employee range
- Description
- Website + LinkedIn links
- Hiring badge (if applicable)
- Job postings (if any)

## Self-Service Submission Flow

1. "Add your startup" CTA on map page
2. Submission form (all profile fields)
3. Edge Function geocodes address → inserts into `startup_submissions` with `status: 'pending'`
4. GOED staff review via Supabase table editor → change status to `approved` → moves to `startups` table (or a trigger handles this)
5. Email confirmation to submitter (stretch)

**Verification**: Lightweight — GOED reviews via table editor. No automated verification for hackathon scope.

## Filter Logic

All filters are client-side (96 rows loads fine in memory):
- Sector: multi-select checkboxes → filter `sector` column
- Stage: multi-select → filter `stage` column  
- Employees: multi-select → filter `employee_range` column
- Hiring: toggle → filter `is_hiring === true`
- Location: optional region filter (stretch)

Map re-renders visible pins reactively via Pinia store.

## Reference Map

**pampam.city Utah Startup Map**: https://www.pampam.city/utah-startup-map-rtqSlvDvpOKV8Y5VrdZN

Key patterns from the reference:
- Directory-style with sector clustering
- Consistent company card format (name + one-line value prop)
- "Don't see yours? Add it here" CTA drives participation
- Broad sector coverage shows ecosystem breadth

## Key Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Map library | vue3-openlayers | Native Vue 3, wraps OpenLayers, actively maintained |
| Geocoding | Nominatim (free) | No API key needed, good for Utah addresses |
| Filter execution | Client-side | 96 rows is small, instant filtering, no edge function needed |
| Submission review | Supabase table editor | GOED staff familiar pattern (same as Navigator resources) |
| Clustering | OL built-in cluster source | Handles SLC density naturally |
| Drawer animation | GSAP slide-in | Consistent with overall GSAP pattern in the app |

## Dependencies to Add

```bash
npm install vue3-openlayers ol
```

(Add to `goed/package.json` when starting Map epic)
