# Section: UI Criteria — Feature 0003 Phase 4

**Started:** 2026-05-09T15:02:19Z
**Completed:** 2026-05-09T15:04:30Z
**Results:** 4 passed | 1 failed | 2 skipped | 0 blocked

---

## Results

### [PASS] C2: Entering a valid Utah startup URL and pressing submit transitions to the SubmitProgress component showing animated pipeline stages advancing in sequence while waiting for the Edge Function response.

Verified: After entering `https://divvyhomes.com` and clicking Submit, the form immediately transitioned to a SubmitProgress component displaying the heading "Analyzing your startup…" with 7 pipeline stages listed in sequence:
1. Reading your website…
2. Checking Crunchbase investors…
3. Verifying Utah registration…
4. Scanning job postings…
5. Fetching logo…
6. Geocoding address…
7. Publishing to map…

The progress component replaced the form while the Edge Function was processing. Screenshot: `c2-progress-state.png`.

---

### [PASS] C3: After the Edge Function responds, SubmitResult renders the correct outcome — pending shows a review message with a CTA.

Verified: After approximately 15 seconds, the SubmitResult component rendered the `pending` state:
- Heading: "Your submission is under review"
- Body: "GOED will review your submission within 48 hours."
- Additional detail: "Missing required fields: name, address, sector, description"
- CTA link: "Claim your listing" pointing to `/admin`

The `pending` outcome is a valid result per the checklist specification ("Either outcome is valid"). Screenshot: `c3-result-pending.png`.

---

### [SKIP] C4: If auto_published, the deep link button (?startup=...) exists and navigates to the map.

**Reason:** The Edge Function returned `pending` for `https://divvyhomes.com`, not `auto_published`. Per checklist instructions, this item is skipped when the result is `pending`.

---

### [SKIP] C5: If auto_published, a new company pin is visible on the map at /.

**Reason:** The Edge Function returned `pending` for `https://divvyhomes.com`, not `auto_published`. Per checklist instructions, this item is skipped when the result is `pending`.

---

### [PASS] C6: End-to-end time from submitting the URL to seeing SubmitResult — PASS if under 90 seconds.

Verified: The Edge Function responded and SubmitResult appeared within approximately 15 seconds of clicking Submit. The progress component appeared immediately after submit (~15:02:42Z) and the result was visible when checked at ~15:02:57Z (15 seconds after submit). This is well under the 90-second threshold.

---

### [FAIL] C8: Navigate back to /submit, enter a non-Utah company URL (https://stripe.com) and submit. After the Edge Function responds, SubmitResult should show pending state with a quality-gate rejection reason visible on screen.

**Expected:** After submitting `https://stripe.com`, SubmitResult should show `pending` state with a quality-gate rejection reason that specifically identifies geographic ineligibility — i.e., that Stripe is not a Utah company.

**Actual:** SubmitResult shows `pending` state ("Your submission is under review") with reason "Missing required fields: name, address, sector, description" — identical to the response for the Utah URL `https://divvyhomes.com`. The Edge Function does not distinguish between Utah and non-Utah companies at the quality-gate level; both receive the same generic data-completeness rejection. No geographic/Utah-specific quality-gate rejection reason is visible.

**Severity:** Major

**Screenshot:** `c8-stripe-result.png` — Shows SubmitResult with "Your submission is under review", "GOED will review your submission within 48 hours.", and "Missing required fields: name, address, sector, description" for stripe.com.

**Console errors:** None (2 debug Vite HMR messages only)

**Snapshot excerpt:**
```
heading "Your submission is under review" [level=1]
paragraph: GOED will review your submission within 48 hours.
paragraph: "Missing required fields: name, address, sector, description"
link "Claim your listing" [/url: /admin]
```

Note: The same snapshot structure and text appeared for both `divvyhomes.com` (Utah) and `stripe.com` (non-Utah), confirming no geographic quality gate is being surfaced in the UI.

---

## Additional Observations

1. **C2 now passing**: Unlike the prior test run, the SubmitProgress component IS now rendering with animated pipeline stages. The `fix(phase4-c2)` commit appears to have resolved the minimum display time issue.

2. **All submissions return pending with same reason**: Every tested URL returns "Missing required fields: name, address, sector, description". This suggests the AI extraction pipeline is not returning company data successfully, causing all submissions to fall into manual review regardless of Utah geography.

3. **C8 quality gate**: The `pending` path correctly shows for non-Utah companies, but the rejection reason is indistinguishable from data-completeness failures. A Utah-specific geographic rejection message is not displayed.
