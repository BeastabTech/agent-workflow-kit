---
name: frontend-design
description: Build distinctive, production-grade web UI that fits the product - pick a clear design direction, use the project's design system and tokens, mobile-first layouts, every page state (loading, empty, error, offline), accessibility and motion with restraint. Use when building or restyling pages, components, landing pages or dashboards.
---

# Frontend design

## 1. Direction before code
- Read the project's design rules (design-system doc, tokens, existing components). Reuse primitives before writing new ones.
- No design system yet? Pick one direction in a sentence (for example "calm, dense, data-first" or "bold editorial, big type") and define tokens: colour roles (background, surface, text, muted, accent, danger, success), type scale, spacing scale, radius, shadow. Light and dark.
- Avoid the generic look: default fonts everywhere, purple gradients, everything centred, every card the same.

## 2. Layout
- Mobile first (360–430 px wide), then tablet and desktop. No horizontal scroll at any width.
- One primary action per screen; clear hierarchy (size, weight, colour, space).
- Spacing and alignment from the scale only. Consistent page headers, search and section patterns across pages.

## 3. States (every page and component)
Loading (skeletons, not spinners for content), empty (what it is and the next action), error (what happened, retry), offline or slow network, partial data, long text and big numbers, permission denied.

## 4. Accessibility baseline
- Semantic elements; labels on every input; focus visible; keyboard reachable; logical tab order.
- Contrast at least WCAG AA (4.5:1 text, 3:1 large text and UI). Do not rely on colour alone.
- Touch targets at least 44×44 px. Respect `prefers-reduced-motion`.
- Never use native browser `alert/confirm/prompt`; use the app's dialog component.

## 5. Motion and polish
Short (150–250 ms), purposeful transitions; no layout shift; lazy-load heavy pages and media; optimise images.

## 6. Check it
Run the app and look at it at phone and desktop widths in light and dark mode. Then run the `design-review` skill, and `webapp-testing` for the flows.
