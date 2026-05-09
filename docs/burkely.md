# Burkely — DevOps + Unblocker

You're the deploy pipeline owner, the infrastructure backstop, and the person with authority to enforce cutlines. You're also the live-demo narrator.

---

## Your superpower for this build

You have the deepest IT/automation expertise on the team and the longest runway with PowerShell-grade rigor. **Use it on the parts that fail silently in a hackathon: deploy pipelines, environment variables, branch hygiene, and demo backstop.** Let Cayden and Beau build features. You make sure the building never collapses underneath them.

---

## Tonight (1:30–2:30 PM) — 10 minutes of work

### Your task

Wire the deploy pipeline so a `git push` goes live.

1. Confirm Cayden has created the GitHub repo and posted the framework decision in Slack.
2. Connect Netlify to https://github.com/NatiParked/start_up_state_hackathon.
3. Configure Netlify build settings:
   - Base directory: repo root
   - Build command: `pnpm build` (or whatever Cayden chooses)
   - Publish directory: `dist` (Vite default; `out` if Next.js)
   - Node version: 20 (set in Environment Variables: `NODE_VERSION=20`)
4. Configure environment variables in Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY` (server-only — verify this does NOT have the `VITE_` prefix)
   - `VITE_MAPBOX_TOKEN` (placeholder for now, real token Phase 2)
5. Verify a test push to `main` deploys. Verify `feat/map` deploys to a separate preview URL.
6. Pin the production URL in Slack.

### Output at 2:30 PM

- Production URL live and pinned in Slack.
- Both `main` and `feat/map` auto-deploy on push.
- Env vars set; Anthropic key is server-only.

---

## Tomorrow

### 8:00–11:00 AM — Monitor + unblock

You don't have a major build task during the parallel-build phase. Your job is **vigilance**:

- Watch deploys on every push. Catch broken builds in the first 30 seconds, not 30 minutes later.
- When Cayden or Beau asks "is the deploy working?" you have the answer in 5 seconds, not 5 minutes.
- Monitor Slack for blockers. If anyone is stuck for >10 minutes on infra, environment, or deploy issues, you intervene.
- **Enforce cutlines.** If Cayden tries to add a feature past 11:00 AM, you say no. If Beau is rabbit-holing on the concierge after 11:50 AM, you say cut. You have the authority because you're the only one not deep in code.

### 11:00 AM — Standup check-in

Lead the "are we connected?" standup. Goal: confirm front-end is calling real APIs and getting real data. If not, that's the only work for the next hour. Ruthless.

### 11:50 AM — 12:40 PM — Testing co-pilot

Help with E2E testing on the live URL:

- Walk through all 6 personas (the 4 not in the demo are insurance — don't skip them).
- Test on real mobile device (your phone, Drew's phone, both iOS and Android if available).
- Test on a fresh browser session (incognito) — catches localStorage assumption bugs.
- Test the deploy from a fresh commit to make sure the pipeline still works under load.
- File any blocking bug to Cayden or Beau immediately. Triage non-blocking bugs to "fix if time."

### 12:40–1:00 PM — Deploy + rehearsal

You own the final deploy. Process:

1. Verify both branches are green on Netlify.
2. Optional: merge `feat/map` into `main` if both halves are ship-ready and integration is clean. **If in doubt, leave them on separate URLs.** Two stable URLs > one broken URL.
3. Smoke test with the team — every route, every persona, every form submission.
4. Rehearse the demo with Drew (he narrates, you assist on the technical commentary, Cayden clicks).

### 1:00 PM onward — Demo backstop

During the live demo:

- Have a backup browser tab open with the demo state pre-loaded.
- Have screenshots ready for every key screen in case the live site fails mid-demo.
- If something breaks live, narrate around it: *"You can see the architecture here even though we're showing the static fallback — the live version handles this exact case."*

---

## Demo narration role

You and Drew co-narrate. Suggested split:

| Beat | Who | What |
|---|---|---|
| 0:00–0:15 (the problem) | Drew | Frame the pain: world-class resources, broken discovery |
| 0:15–0:45 (Maria walkthrough) | Drew | Live walk Maria through the quiz |
| 0:45–1:15 (Priya walkthrough) | Burkely | Take over: same quiz, completely different dashboard |
| 1:15–1:40 (Concierge + analytics narrative) | Burkely | Land the GOEO analytics angle: unanswered questions = content gap report |
| 1:40–2:00 (Map flash + close) | Drew | Quick `/directory` flash, claim form, close on "ready for production" |

You take Priya + the concierge analytics moment specifically because:
- Priya is the SaaS persona; investors recognize themselves in her, and you can speak fluently to that founder type.
- The concierge analytics narrative is the technical-credibility moment of the demo. It's where judges shift from "this is nice" to "this could actually ship to production." Your IT/automation background lets you talk credibly about the data flow.

---

## Things you should NOT do

- Do not write feature code. Cayden owns the front-end; Beau owns the API. If they need help, that's a different problem (pair on debugging, not on building).
- Do not introduce new tools the team didn't agree on. Hackathon = use the stack we picked.
- Do not silence the cutline call to "be nice." Saying no at 11:00 AM is what wins the demo.

---

## Files / surfaces you own

- Netlify project settings
- GitHub repo settings (branch protection if useful, default branch, etc.)
- `.env.example` (you keep this file accurate as new vars are added)
- `netlify.toml` (build command, redirects, function bundler config)
- The pinned Slack message with all live URLs and credentials

---

## Slack templates

Save these as snippets, paste at the right moment:

**Cutline enforcement:**
> Cutline: it's [10:00 AM / 11:00 AM / 11:50 AM]. Per the sprint plan, no new features past this point. What you have is what we ship. Drop the in-progress work cleanly, mark it as Phase 2.

**Deploy status:**
> ✅ Deploy live: [url] — last commit [hash] — by [name]

**Bug triage:**
> Found in testing: [description]. Severity: [blocker / major / minor]. Owner: [name]. Fix-or-defer call by [time].
