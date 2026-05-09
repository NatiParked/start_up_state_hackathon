# Section: UI Criteria — Feature 0002, Phase 2

**Started:** 2026-05-09T07:55:00Z
**Completed:** 2026-05-09T08:05:00Z
**Results:** 0 passed | 4 failed | 0 skipped | 0 blocked

---

## Summary

The CompanyDrawer component is rendered in the DOM in its initial off-screen state (positioned at approximately x=930 in a ~930px-wide viewport, with the bulk of its 448px width extending off to the right). The company pins are visible on the map with `cursor: pointer` styling. However, clicking company pins using every available method (aria ref, CSS selector targeting wrapper divs and ol-overlay-container divs, img elements) **never triggers the drawer to animate into view**. No click-related JavaScript errors appear in the console. The Pinia "startups" store is installed but no store-state changes are observed during any click. All four UI success criteria fail.

**Evidence collected:** Multiple pins clicked successfully without pointer-intercept errors: Pocketbook, Treads, Driven (via aria-ref), and Pocketbook container (via CSS `.ol-overlay-container:has(img[alt="Pocketbook"])`). In all cases the drawer remained at x=viewport-width (off-screen). The drawer's Close button is "outside of the viewport" per Playwright when attempting a direct click.

---

## Results

### [FAIL] UI-1: Clicking a pin slides the drawer in from the right (visible smooth GSAP animation, ~350ms, `power2.out` ease)

**Expected:** Clicking any company pin on the map should trigger a GSAP animation that translates the CompanyDrawer from off-screen right into view over ~350ms with `power2.out` ease.

**Actual:** After clicking 10+ company pins using multiple methods (aria refs for Pocketbook, Treads, Driven; CSS selectors targeting `div.ol-overlay-container` wrapper for Pocketbook; double-click on Pocketbook; map container div click), the drawer remains fully off-screen at its initial position. Accessibility snapshot consistently shows `complementary [box=930,0,448,906]` (930px viewport) or `complementary [box=1385,0,448,885]` (1385px viewport) — the drawer left edge is always flush with the viewport's right boundary. No animation occurs.

**Severity:** Critical — Core feature (drawer open on pin click) is non-functional.

**Screenshot:** `.playwright-mcp/failure-drawer-not-opening.png` — Map view with pins; drawer absent from viewport. Visual state is identical before and after all click attempts.

**Console errors:** No JS errors. One startup warning: "No map visible because the map container's width or height are 0" (OpenLayers, transient). Favicon 404. No click handler logs, no store action logs.

**Snapshot excerpt (after clicking Pocketbook pin):**
```yaml
- complementary [ref=e638] [box=1385,0,448,885]:
  - button "Close" [ref=e640] [cursor=pointer] [box=1797,16,20,24]: ×
```
The drawer element contains ONLY the Close button — no company data whatsoever.

---

### [FAIL] UI-2: Drawer displays all company fields correctly: logo (or monogram), name, sector pill, stage pill, hiring badge (only when `is_hiring`), description, job titles preview with `+N more` overflow, website + LinkedIn icons (only if URL exists), investor pills + total raised (only when investors present), region

**Expected:** After clicking a pin, the drawer should display a rich company card with all listed fields rendered appropriately.

**Actual:** The drawer never enters view (see UI-1). The accessibility snapshot of the `complementary` element at all times shows only the Close button (`×`) — no company name, logo img, sector pill, stage pill, description text, or any other data fields. It is not possible to verify any individual field rendering.

Note: The stats bar shows "0 Hiring" and "0 With Investors" despite 223 companies being loaded, suggesting data may have incomplete `is_hiring` / investor fields in the database, but this cannot be verified further without drawer access.

**Severity:** Critical — All drawer content is unverifiable because the drawer never opens.

**Screenshot:** Same as UI-1.

**Console errors:** None related to data loading or rendering.

**Snapshot excerpt:**
```yaml
- complementary [ref=e638]:
  - button "Close" [ref=e640] [cursor=pointer]: ×
```

---

### [FAIL] UI-3: Clicking the X button or clicking outside the drawer (on the map background) slides it out and clears `selectedCompany`

**Expected:** With drawer open, pressing the Close (×) button or clicking the map background should animate the drawer back off-screen and clear the selected company state.

**Actual:** The drawer is already off-screen (initial state). The Close button at `box=1797,16,20,24` is outside the viewport and cannot be clicked — Playwright reports "element is outside of the viewport" when attempting. Click-outside behavior cannot be tested because the drawer never opens. Both dismiss paths are untestable.

**Severity:** Critical — Cannot verify dismiss behavior because prerequisite (drawer open) is not achievable.

**Screenshot:** `.playwright-mcp/failure-drawer-not-opening.png`.

**Console errors:** Close button click attempt timed out with "element is outside of the viewport".

**Snapshot excerpt:**
```yaml
- button "Close" [ref=e640] [cursor=pointer] [box=1797,16,20,24]: ×
```
(Position is off-screen — viewport width is 1385px but button is at x=1797)

---

### [FAIL] UI-4: Selecting a different pin while drawer is open swaps content seamlessly (still animated/visible)

**Expected:** With one company drawer open, clicking a different pin should seamlessly replace the displayed company content without closing and reopening the drawer.

**Actual:** Because no pin click opens the drawer (see UI-1), the prerequisite state — drawer open with a company selected — cannot be reached. Content swap behavior is untestable.

**Severity:** Critical — Prerequisite state cannot be achieved via any click method tested.

**Screenshot:** `.playwright-mcp/failure-drawer-not-opening.png`.

**Console errors:** None.

**Snapshot excerpt:** N/A — drawer never in open state.

---

## Diagnostic Notes

- The CompanyDrawer **is present in the DOM** and in its correct initial off-screen position.
- Company pins **are visible** on the map (132 pins rendered as img or span elements with `cursor: pointer`).
- Pin elements are inside `div.ol-overlay-container.ol-selectable` wrappers (OpenLayers overlay containers).
- Clicking pin img elements via aria-ref (Pocketbook, Treads, Driven) succeeds (no timeout/intercept error) but does NOT trigger drawer animation.
- Clicking the `ol-overlay-container` div wrapping a pin (CSS selector) also does NOT trigger drawer animation.
- The Pinia `startups` store is initialized. No state changes are detectable after any pin click.
- No JavaScript errors appear in the console during any interaction.
- **Root cause hypothesis:** The Vue `@click` handler on the CompanyPin component is either (a) not bound or bound to a non-functional element in the OpenLayers overlay context, (b) calls `selectCompany()` but the store action has no effect (e.g., store action doesn't exist or isn't properly defined), or (c) the GSAP watcher on `selectedCompany` is not set up correctly to trigger the animation even if the store state updates.
