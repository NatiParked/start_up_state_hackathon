# Map Build (feat/map branch)

The Utah Startup Map. Phase 1: filterable directory + claim form. Phase 2: literal Mapbox view.

---

## Scope split

| Phase | What ships | When |
|---|---|---|
| **Phase 1 — must ship** | Directory list view + filters + business profile pages + claim form | Inside the 6-hour build |
| **Phase 2 — if time** | Literal Mapbox map at `/directory` with pins from same data | Post-Phase-1 polish window |

Phase 1 alone satisfies the brief's "self-service profiles" + "filterable" + "all required fields" requirements. Phase 2 is the visual flourish judges expect after seeing the pampam reference.

---

## Routes (feat/map branch)

| Route | Purpose | Component |
|---|---|---|
| `/claim` | Create or claim a business profile (the 11-field form) | `routes/claim.tsx` |
| `/directory` | List view of all businesses, filterable | `routes/directory/index.tsx` |
| `/directory/:id` | Public business profile page | `routes/directory/[id].tsx` |

---

## The 11-field business profile form (`/claim`)

Per the brief, every profile must include:

| Field | Type | Required | Validation |
|---|---|---|---|
| Name | text | ✅ | 1–100 chars |
| Website | url | ✅ | valid URL |
| Employees | enum/number | ✅ | one of: 1, 2-10, 11-50, 51-200, 201-1000, 1000+ (store as midpoint or text) |
| Sector | enum | ✅ | match `industries` vocabulary from `resources` |
| Year founded | int | ✅ | 1900 ≤ year ≤ current year |
| LinkedIn | url | ⚪ | valid URL if present |
| Description | textarea | ✅ | 1–500 chars |
| Address | text | ✅ | freeform; geocode in Phase 2 |
| Hiring status | toggle | ✅ | boolean |
| Job postings | repeating group | ⚪ | 0–10 entries of `{ title, link }` |
| Photo gallery | file upload | ⚪ | 0–6 images, max 5MB each, JPG/PNG/WebP |

### UX

- Single-page form. Multi-step is unnecessary friction for 11 fields.
- Group sections with visual separators: Basics → About → Operations → Media.
- Inline validation via react-hook-form + zod.
- Photo upload via Supabase Storage (`businesses` bucket, public read). Show drag-drop area with thumbnail previews.
- On submit success: redirect to `/directory/:id` with a "Profile created — share this link" toast.

### Validation (zod schema)

```ts
import { z } from 'zod';

export const businessSchema = z.object({
  name: z.string().min(1).max(100),
  website: z.string().url(),
  employees: z.enum(['1', '2-10', '11-50', '51-200', '201-1000', '1000+']),
  sector: z.enum(['software-it', 'healthcare', 'manufacturing', 'agriculture', 'hospitality-food', 'other']),
  year_founded: z.number().int().min(1900).max(new Date().getFullYear()),
  linkedin: z.string().url().optional().or(z.literal('')),
  description: z.string().min(1).max(500),
  address: z.string().min(1),
  is_hiring: z.boolean(),
  job_postings: z.array(z.object({
    title: z.string().min(1),
    link: z.string().url(),
  })).max(10).optional(),
  photo_urls: z.array(z.string().url()).max(6).optional(),
});
```

---

## Verification (Phase 1: open submit, Phase 2: lightweight verification)

**Phase 1:** No verification. Anyone can submit. Profiles default to `is_verified: false` and display a small "Unverified" badge.

**Phase 2 (post-hackathon, not in scope for the build):** Email verification.
- Form requires a contact email at the company's domain.
- Supabase sends magic link.
- Link click flips `is_verified: true` and removes the badge.

This satisfies the brief's "lightweight verification method" requirement architecturally, even if Phase 2 isn't implemented in 6 hours. Mention in the demo: *"Phase 2 adds domain-email verification — schema's already there."*

---

## Directory list view (`/directory`)

```
┌──────────────────────────────────────────────────────────────────┐
│  /directory                                                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Filter rail (left, desktop) / sheet (mobile)            │    │
│  │  ─────────────────────────────────────                   │    │
│  │  Sector       [☐ Software ☐ Healthcare ☐ Mfg ☐ Ag ...]   │    │
│  │  Stage        [☐ Pre-revenue ☐ Early ☐ Scaling ...]      │    │
│  │  Employees    [Any ▼ ]                                   │    │
│  │  Hiring       [☐ Hiring now]                             │    │
│  │  Region       [Any ▼]                                    │    │
│  │  Search       [____________________]                     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Result count: 247 companies                             │    │
│  │  Sort: [Name ▼]                                          │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │  Acme Robotics                                  [Hiring] │    │
│  │  Manufacturing • 12 employees • Provo • Founded 2022     │    │
│  │  We build robotic arms for industrial automation.        │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │  ... (more cards)                                        │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [Floating CTA, bottom-right]  [+ Claim your business]           │
└──────────────────────────────────────────────────────────────────┘
```

- Pagination: load 20 cards initially, "Load more" or infinite scroll.
- Card click → `/directory/:id`.
- Filters update URL query params (so directory state is shareable).

---

## Business profile page (`/directory/:id`)

```
┌──────────────────────────────────────────────────────────────────┐
│  Acme Robotics                              [Hiring]  [Verified] │
│  Manufacturing • 12 employees • Founded 2022 • Provo, UT         │
│                                                                  │
│  [Photo gallery — 1 hero + thumbnails]                           │
│                                                                  │
│  About                                                           │
│  We build robotic arms for industrial automation. Our clients    │
│  include...                                                      │
│                                                                  │
│  Links                                                           │
│  Website → acme.com                                              │
│  LinkedIn → linkedin.com/company/acme                            │
│                                                                  │
│  Open positions (3)                                              │
│  • Senior Robotics Engineer →                                    │
│  • Mechanical Designer →                                         │
│  • Customer Success Lead →                                       │
│                                                                  │
│  Contact                                                         │
│  123 Main St, Provo, UT 84601                                    │
└──────────────────────────────────────────────────────────────────┘
```

- "Verified" badge only if `is_verified === true` (always false in v1).
- "Edit" link visible only if `session_id` matches the creator's session (lightweight, no auth).

---

## Phase 2: Mapbox integration

If time after Phase 1:

1. Geocode addresses in batch: `supabase/scripts/geocode.ts` runs Mapbox geocoding against all rows missing `lat`/`lng`. One-time script.
2. Add `lat`, `lng` columns to `businesses` table.
3. New tab on `/directory`: "List | Map" toggle.
4. Map view: Mapbox GL JS centered on Utah bounds, pin per business, color-coded by sector. Click pin → mini popup → "View profile" → `/directory/:id`.

```tsx
// components/directory/MapView.tsx (sketch)
import { Map, Marker, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

<Map
  initialViewState={{ latitude: 39.5, longitude: -111.7, zoom: 6 }}
  style={{ width: '100%', height: 600 }}
  mapStyle="mapbox://styles/mapbox/light-v11"
  mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
>
  {businesses.map(b => (
    <Marker key={b.id} longitude={b.lng} latitude={b.lat}>
      <Pin sector={b.sector} onClick={() => setSelected(b)} />
    </Marker>
  ))}
  {selected && <Popup ... />}
</Map>
```

Use `mapbox/light-v11` style — clean, neutral, doesn't fight the rest of the UI. Avoid satellite or 3D for v1.

---

## Demo angle for the Map

If shown live, the talking point is:
> "Same data layer as the founder dashboard. Companies that claim a profile here become discoverable to the founders looking for partners, customers, or hires. The state's ecosystem becomes a connected graph instead of two disconnected websites."

This frames the Map as part of the same product, not a separate one. Judges should leave understanding both halves are one platform.

---

## Open questions for Map

- **Photo storage costs:** Supabase Storage free tier is 1GB. Sufficient for the demo. Beyond that, GOEO would need a paid plan or move to S3/Cloudflare R2 in production.
- **Spam control:** open submit is risky in production. For the demo we accept the risk; in production, add a Cloudflare Turnstile challenge before submission.
- **Duplicate handling:** what if two people both create profiles for the same company? Phase 1: tolerate it (manual cleanup). Phase 2: name+domain match check at submit time.
