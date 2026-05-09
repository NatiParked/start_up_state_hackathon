# Founder's Navigator: Design Brief

**Project:** Founder's Navigator (Utah startup resource finder)  
**Duration:** 6-hour sprint (1 hr tonight + 5 hrs tomorrow)  
**Designer:** Drew  
**Timeline:**
- **Tonight (1:30–2:30 PM):** Sketch 5 key screens (rough)
- **Tomorrow 8:00–9:00 AM:** Build component library + design system
- **Tomorrow 9:00–11:00 AM:** Polish landing page + animations
- **Tomorrow 11:00 AM–1:00 PM:** Testing + final tweaks

---

## **Design System Foundation**

### Brand Context
- **Product name:** Founder's Navigator
- **Audience (dual):** Founders seeking resources + Investors discovering Utah's startup ecosystem
- **Tone:** Helpful, not overwhelming. Clear navigation. Production-ready (could go live on startup.utah.gov).
- **Visual language:** Clean, modern, professional. Minimal but warm.

### Color Palette (locked)
```
Primary:
  - Ink Black (#1a1a1a)
  - Bone White (#f8f8f6)

Secondary:
  - Cedar Moss (#6b7d6a)
  - Storm Blue (#4a5f7f)

Tertiary (accents):
  - Rust Red (#c85a54)
  - Harvest Gold (#d4a574)

Backgrounds:
  - Off-white (#f5f5f3) for secondary areas
  - White (#ffffff) for primary content
  - Light gray (#ececec) for dividers/borders

Text:
  - Primary: Ink Black (#1a1a1a)
  - Secondary: #666666
  - Tertiary: #999999
  - Links: Storm Blue (#4a5f7f), hover: Rust Red (#c85a54)
```

### Typography (locked)
- **Display/Headlines:** IM Fell English (serif, classic letterpress feel)
- **Body text:** Libre Baskerville (serif, readable, elegant)
- **UI labels/buttons:** Special Elite (humanistic, approachable)
- **Monospace (code/data):** System mono or Monaco

### Design Principles
1. **Progressive disclosure:** One decision at a time (quiz questions appear individually, not all at once)
2. **Whitespace first:** Don't overcrowd. Breathing room = clarity
3. **Hierarchy through scale and weight:** Not color alone
4. **Micro-interactions:** Smooth transitions, delightful moments (GSAP)
5. **Mobile-first:** Responsive by default (Tailwind responsive classes)

---

## **5 Key Screens to Sketch Tonight**

### Screen 1: Landing Page / Home
**What it shows:**
- Hero headline: "Find the resources you need in under 2 minutes"
- Short value prop (1 sentence)
- Two CTA buttons: "Start guided quiz" (primary) + "Explore all resources" (secondary)
- Optional: Small subheader showing user persona options ("For founders at any stage")

**Key elements:**
- Clean, centered layout
- Large, readable headline (IM Fell English)
- Generous padding/whitespace
- Button states (default, hover, active)

**Design notes:**
- Don't over-design. Home page is a gateway. Make it obvious: quiz or skip.
- Use color sparingly. Maybe a subtle Cedar Moss accent behind the hero.

---

### Screen 2: Quiz Question Screen (Q1: Stage)
**What it shows:**
- Question at top: "What stage is your company?"
- Four answer cards in a 2x2 or vertical stack:
  - Pre-revenue
  - Early revenue
  - Scaling
  - Established
- Small text under question: "This helps us personalize resources for you" (reassurance)
- Optional: Skip button (bottom, subtle gray text)
- Progress indicator: "1 of 3" (top right, small)

**Key elements:**
- Question card has clear hierarchy
- Answer options are clickable cards (not radio buttons—cards feel more interactive)
- Selected card highlights with Storm Blue border + background tint
- Smooth transition to next question (GSAP fade + slide)

**Design notes:**
- Make answer cards feel like buttons (cursor: pointer, hover state)
- Hover state: subtle background tint (Cedar Moss at 10% opacity)
- Active state: Storm Blue border (2px) + slightly elevated (box-shadow)
- Don't show all 3 questions at once. One question per screen. Clean cognitive load.

---

### Screen 3: Quiz Results/Dashboard
**What it shows:**
- Headline: "Here are your top resources" (personalized: "Top resources for early-stage SaaS founders in Salt Lake")
- Resource cards in a grid (or vertical stack on mobile):
  - Resource title (bold, IM Fell English)
  - Category/type badge (small pill, Cedar Moss background)
  - Short description (2 lines max)
  - "Learn more" link (Storm Blue, underline on hover)
  - Icon or visual cue (optional: colored circle with category initial)
- Optional: Search/filter bar (nice-to-have, but nice for UX)
- Refinement chat widget (optional, bottom): "Need something else?" + input + send button

**Key elements:**
- Card design: subtle drop shadow, hover state lifts card slightly
- Badge styling: Cedar Moss background, white text, rounded corners
- Link styling: Storm Blue, underline on hover, cursor: pointer
- Grid layout: 2-3 columns on desktop, 1 on mobile

**Design notes:**
- Results should feel like a curated list, not a dump
- Each card is clickable (leads to detail page)
- Animations: Results fade in and slide up, staggered (GSAP timeline)
- Card hover: slight scale (1.02x) + shadow deepens
- If chat widget exists: keep it minimal. Small input field + send button. Don't make it compete with results.

---

### Screen 4: Resource Detail Page
**What it shows:**
- Back button or close (top left)
- Resource title (large, IM Fell English)
- Category badges (multiple, stacked)
- Resource description (full text, 3-4 paragraphs max)
- Key details:
  - Organization name
  - Contact email (linked, clickable)
  - Website link (external, icon)
  - Service areas/locations (if available)
- Call-to-action: "Visit website" (primary button, Rust Red) or "Contact" (secondary, Storm Blue)
- Share options (optional: email, copy link)

**Key elements:**
- Clean, readable layout (max-width: 600px for text readability)
- Generous margins and line-spacing (serif body copy needs breathing room)
- Link styling: Storm Blue, underline
- Button styling: See button specs below
- Subtle dividers (light gray, #ececec)

**Design notes:**
- This page should feel like a detail view, not overwhelming
- Use color strategically: maybe a small Rust Red accent bar on the left side of the card
- Back button should be clear (arrow + text, not icon-only)

---

### Screen 5: Business Profile Submission Form
**What it shows:**
- Headline: "Add your startup to Utah's ecosystem"
- Form fields (11 total, organized in logical groups):
  
  **Group 1: Basics**
  - Name (text input, required)
  - Website (URL input, optional)
  - Year founded (number input, optional)
  
  **Group 2: Business info**
  - Sector/Industry (dropdown, required)
  - Employees (number input, optional)
  - Hiring status (radio: Yes | No | Maybe, optional)
  - Job postings (text area, optional)
  
  **Group 3: Marketing**
  - Description (text area, required, 150 words max)
  - LinkedIn profile (URL input, optional)
  - Address (text input, optional)
  
  **Group 4: Media**
  - Photo upload (file input, optional) – drag & drop area
  
  **Submit button:** "Add my startup" (primary, Rust Red)
  **Success state:** Toast notification or modal: "Thanks! Your startup has been added."

**Key elements:**
- Form grouped by section (visual dividers, light backgrounds)
- Labels above inputs (not placeholder text as labels)
- Input focus states: Storm Blue border, subtle background tint
- Validation messages: Red text (#c85a54) below invalid fields
- Submit button: Disabled state (gray) until required fields filled
- Drag-and-drop for image upload (nice visual touch)

**Design notes:**
- Keep form clean. Don't cram all 11 fields on one page visually. Use visual grouping.
- Required fields marked with * (red asterisk, IM Fell English)
- Success feedback is important. Clear message when form submits.
- File upload: accept image formats only (jpg, png, webp)
- Responsive: form should be single-column on mobile

---

## **Component Library (to build 8–9 AM tomorrow)**

Build these reusable components in React/Tailwind. Use Storybook or just export as `.jsx` files.

### Button Component
```
States: Default, Hover, Active, Disabled, Loading
Variants:
  - Primary (Rust Red background, white text)
  - Secondary (Storm Blue background, white text)
  - Tertiary (border only, no fill, Storm Blue border)
  - Ghost (no background, Storm Blue text)
Sizes: Small, Medium (default), Large
Examples: "Start quiz", "Learn more", "Add startup", "Contact"
```

### Card Component
```
Base: White background, subtle drop shadow (#000 5%), rounded corners (var(--radius-lg))
Variants:
  - Resource card (title, badge, description, link)
  - Quiz option card (option text, selected state highlight)
  - Detail card (larger, max-width layout)
Hover states: Scale slightly (1.02x), shadow deepens
```

### Badge Component
```
Background: Cedar Moss (#6b7d6a)
Text: White
Sizes: Small, Medium
Variants: Cedar Moss (default), Rust Red (accent), Storm Blue (secondary)
Used for: Categories, status labels, badges
```

### Input Component
```
Types: Text, Number, URL, Text area, Select (dropdown)
States: Default, Focus (Storm Blue border), Error (Rust Red border + message)
Labels: Above input, IM Fell English for required marker (*)
Placeholder: Subtle gray text
Focus ring: 2px Storm Blue border, subtle box-shadow
```

### Form Section Component
```
Groups related form fields
Light background: #f5f5f3
Padding: 1.5rem
Divider between sections: Light gray border, #ececec
Title: IM Fell English, medium weight
```

### Progress Indicator
```
"1 of 3" or similar
Small, top right of screen
Text: Secondary gray
Optional: Visual progress bar (thin line across top, fills as user progresses)
```

### Toast/Notification Component
```
Used for: Success message after form submit, error alerts
Variants: Success (Cedar Moss), Error (Rust Red), Info (Storm Blue)
Position: Bottom right
Auto-dismiss after 4 seconds
```

### Navigation Component
```
Simple header:
  - Logo/title (left): "Founder's Navigator"
  - Links (right): Home, About (optional), Help (optional)
  - Mobile: Hamburger menu (simple, no animation needed)
```

---

## **GSAP Animation Specifications**

Use GSAP for smooth, delightful interactions. Keep it subtle—don't overdo it.

### Page Transitions
- **Quiz screen change:** Fade out current question (200ms) → fade in next question (300ms)
- **Quiz → Results:** Fade out quiz (200ms) → scale in results cards (400ms, staggered 50ms each)

### Card Interactions
- **Hover on quiz option:** Background tint appears (150ms ease-out)
- **Click quiz option:** Scale to 0.98x (100ms), then back to 1 (200ms)
- **Result cards appear:** Fade in + slide up 20px (300ms, staggered 100ms each)
- **Hover on result card:** Scale to 1.02x (150ms), shadow deepens

### Button States
- **Hover:** Slight color darken (no scale needed, too much movement)
- **Click:** Quick pulse (scale 0.95 → 1) (100ms)

### Form Interactions
- **Input focus:** Border color change (Storm Blue) (150ms), optional subtle glow
- **Error message appear:** Fade in + slide down 10px (200ms)
- **Success toast:** Slide in from bottom right (300ms), slide out on dismiss (200ms)

### General Principle
- Durations: 150–400ms (never >500ms, feels sluggish)
- Easing: `ease-out` for snappy interactions, `ease-in-out` for transitions
- No bounces or springs—keep it professional

---

## **Responsive Design (Tailwind breakpoints)**

- **Mobile (320px–640px):** Single column, full-width cards, touch-friendly buttons
- **Tablet (641px–1024px):** 2-column layouts where appropriate, slightly larger cards
- **Desktop (1025px+):** Multi-column, max-width containers (960px–1200px), generous whitespace

**Mobile-first approach:**
- Design for mobile first (smallest screen)
- Use Tailwind's `md:`, `lg:` prefixes to enhance for larger screens
- Buttons & touch targets: Minimum 44x44px (mobile accessibility)

---

## **Accessibility & UX Details**

1. **Color contrast:** All text meets WCAG AA standards (4.5:1 ratio for body text)
2. **Focus states:** Clear keyboard navigation (visible focus rings on all interactive elements)
3. **Skip button:** Text-only, small but visible. Allows power users to jump straight to full resource list.
4. **Alt text:** All icons/images have alt text (or are marked as decorative with aria-hidden)
5. **Form labels:** Associated with inputs (not placeholder-only)
6. **Loading states:** Visual feedback (spinner or shimmer) if API call takes >500ms

---

## **Figma/Design File Setup (Tonight)**

Create a simple file structure:
- **Frame 1:** Colors & type spec (reference)
- **Frame 2:** Landing page (rough sketch)
- **Frame 3:** Quiz Q1, Q2, Q3 (same template, different question)
- **Frame 4:** Results page (card layout)
- **Frame 5:** Detail page (modal or full page)
- **Frame 6:** Form (business profile)

Don't pixel-perfect tonight. Wireframe-level detail is fine. Tomorrow you'll refine.

---

## **Tonight's Deliverables (by 2:30 PM)**

1. ✅ 5 screens sketched (Figma or paper scans)
2. ✅ Color palette locked (hex codes noted)
3. ✅ Typography choices confirmed (font weights, sizes for headings/body)
4. ✅ Component list drafted (what components Cayden needs to build)
5. ✅ Animation brief written (key interactions + timings)

---

## **Tomorrow's Deliverables (8:00–9:00 AM)**

1. ✅ Tailwind config with color tokens + breakpoints
2. ✅ Component library built (Button, Card, Badge, Input, Form Section, Toast)
3. ✅ GSAP animation setup (utility functions or hooks)
4. ✅ Landing page shell in React (nav, hero, CTAs)

---

## **What NOT to do**

❌ Don't design edge cases or error states beyond the brief (focus on happy path)  
❌ Don't add features not in the plan (no fancy animations, no complex illustrations)  
❌ Don't wait for Figma perfectionism. Rough is good enough.  
❌ Don't overthink mobile. Tailwind will handle it if you build mobile-first.  
❌ Don't add more than 5 key screens. This is an MVP.

---

## **Success Criteria**

By 1:00 PM tomorrow:
- ✅ App looks production-ready (could go live on startup.utah.gov)
- ✅ Quiz flow feels intuitive (no confusion about what to do next)
- ✅ Results feel personalized (user sees their specific resources ranked)
- ✅ Forms work smoothly (validation + success feedback)
- ✅ Mobile looks great (not broken, properly responsive)
- ✅ GSAP animations are subtle but present (feels polished, not overdone)

---

## **Tools & Resources**

- **Design:** Figma (or Sketch, or even pencil + photos)
- **React components:** Build in `.jsx` files alongside Cayden
- **Tailwind:** v3+ (pre-configured, use existing config)
- **GSAP:** `npm install gsap` (use v3)
- **Icons:** Heroicons (if needed, small set only)
- **Fonts:** Google Fonts (IM Fell English, Libre Baskerville, Special Elite)

---

## **Quick Reference: Color Codes**

```
Ink Black:       #1a1a1a
Bone White:      #f8f8f6
Cedar Moss:      #6b7d6a
Storm Blue:      #4a5f7f
Rust Red:        #c85a54
Harvest Gold:    #d4a574
Off-white:       #f5f5f3
Light gray:      #ececec
Text Secondary:  #666666
Text Tertiary:   #999999
```

---

**Questions? Ask Cayden about API responses, or Beau about data fields.**

**Go ship. You've got this.** 🚀
