---
name: design-review
description: Review a UI change or page visually and functionally - open it in a real browser at phone and desktop widths, light and dark, check hierarchy, consistency with the design system, states, accessibility and responsiveness, and report findings with screenshots or exact selectors. Use after UI work, before a release, or when asked to review, critique or QA a design.
---

# Design review

## Setup
Run the app (dev server command in `docs/context/CONVENTIONS.md`). Open the pages in a browser tool (built-in browser, Playwright, or the `webapp-testing` skill). Use test accounts and test data only.

## Look at each page at
- 375 px (phone), 768 px (tablet), 1280 px (desktop); light and dark; zoom 200%.

## Check
1. **Hierarchy:** one obvious primary action; headings and spacing guide the eye.
2. **Consistency:** tokens, components, headers, buttons and dialogs match the rest of the app and the design-system doc.
3. **States:** loading, empty, error, offline, long content, permission denied.
4. **Responsive:** no horizontal scroll, no clipped text, sticky elements behave, keyboard does not cover inputs on mobile.
5. **Accessibility:** contrast, focus order and visibility, labels, alt text, touch target size, reduced motion. Run an automated check if available (axe, Lighthouse) and note the score.
6. **Copy:** clear, short, consistent terms; errors say what to do next.
7. **Performance feel:** layout shift, slow images, janky scroll.

## Report
Ranked findings: `severity · page/component · what is wrong · where (selector or screenshot) · fix`. Blocking first (broken flow, unreadable, inaccessible), then polish. Include what you could not check.
