# Feature 0005: Admin Management UI — State

> Last updated: 2026-05-09

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | Phase 1: Auth Foundation & Route Guard |
| **Status** | 🔲 Pending |
| **Blocker** | None |

## Phase Progress

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 1: Auth Foundation & Route Guard | 🔲 Pending | — | — |
| Phase 2: Admin Shell & Dashboard | 🔲 Pending | — | — |
| Phase 3: Submission Queue & Company CRUD | 🔲 Pending | — | — |
| Phase 4: Refresh Control, Subscriber Shell & Roadmap Page | 🔲 Pending | — | — |

## Task Progress

(Tasks will be added when phases are planned)

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-09 | Initial feature specification created | Roadmap drafted from Milestone 6 spec; 4-phase split chosen so each phase is independently verifiable: auth substrate, then shell, then CRUD, then operational tools + public roadmap. |
| 2026-05-09 | `CompanyEditor` writes go through the anon client + admin RLS policy rather than a dedicated Edge Function | Simpler for hackathon scope and keeps the edit loop snappy; RLS still gates writes to allow-listed emails. Revisit if audit logging becomes a requirement. |
| 2026-05-09 | `SubscriberPanel.vue` ships as a UI shell with hardcoded zeros and a "Populates in M9" badge | Lets M6 close cleanly without waiting on M9; M9 swaps in live data without changing layout. |
| 2026-05-09 | Magic-link auth (email OTP), not OAuth | Matches the documented auth pattern and avoids per-provider configuration overhead during the hackathon. |
| 2026-05-09 | Migration seeds placeholder allow-list emails | Keeps the migration reviewable end-to-end; real GOED addresses land via a follow-on migration once confirmed. |

## Blockers & Issues

(None)

---
*Updated by `/spec:execute-phase` during implementation*
