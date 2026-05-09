# Founder's Navigator — Task Tracker

Format: `[ ]` pending · `[~]` in progress · `[x]` done

---

## Phase 1 — Data & Scoring
- [ ] Scaffold Vite + React project (`npm create vite@latest`)
- [ ] Copy `tagged_resources.json` into `src/data/`
- [ ] Write `src/lib/scoring.js` — pure scoring function
- [ ] Verify scoring in browser console with sample inputs

## Phase 2 — Quiz UI
- [ ] Write `src/styles/main.css` — CSS variables, base styles, mobile-first
- [ ] Build `QuizStep.jsx` — single-select and multi-select modes
- [ ] Build `ProgressBar.jsx`
- [ ] Build `Quiz.jsx` — step state machine + skip logic
- [ ] Build `Landing.jsx` — hero + CTA
- [ ] Wire `App.jsx` — view state, Landing → Quiz → Results navigation

## Phase 3 — Results
- [ ] Build `ResultCard.jsx` — name, badge, summary, eligibility, links, score
- [ ] Build `FilterChips.jsx` — only types present in top-15
- [ ] Build `Pagination.jsx` — prev/next, X of Y, 5 per page
- [ ] Build `Results.jsx` — filter + pagination as derived state
- [ ] Connect scoring output from Quiz → App → Results

## Phase 4 — Polish
- [ ] Mobile responsive pass (375px)
- [ ] CSS transitions between quiz steps
- [ ] Retake quiz → reset all state → Landing
- [ ] Meta title + favicon

## Deploy
- [ ] `npm run build` — verify dist/ output
- [ ] Deploy to Vercel or Netlify
