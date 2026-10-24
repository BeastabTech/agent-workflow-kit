---
name: responsive-ui
description: Make web pages and apps work well on every screen - phones, tablets, laptops, large screens, portrait and landscape, touch and mouse - with mobile-first CSS, fluid type and spacing, flexible grids, container queries, responsive images, safe areas and input-friendly forms. Also covers React Native / Flutter / PWA layout. Use when building or fixing any layout, when something breaks on mobile, or when asked for a responsive site or app.
---

# Responsive web and app UI

## Rules
1. **Mobile first.** Base styles for ~360 px wide; add `min-width` media or container queries as space grows. Content decides breakpoints, not device names. Common steps: 640, 768, 1024, 1280 px.
2. **Fluid, not fixed.** `max-width` + `width: 100%`, `minmax()`, `%`, `fr`, `clamp()`. No fixed pixel widths on containers. Fluid type: `font-size: clamp(1rem, 0.9rem + 0.5vw, 1.25rem)`.
3. **Layout tools.** Flexbox for one direction, Grid for two: `grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr))`. Container queries (`container-type: inline-size; @container (min-width: 30rem)`) for components that live in different widths.
4. **Viewport.** `<meta name="viewport" content="width=device-width, initial-scale=1">`. Use `100dvh` (not `100vh`) for full-height mobile screens. Respect `env(safe-area-inset-*)` for notches and home bars (`viewport-fit=cover`).
5. **Images and media.** `max-width: 100%; height: auto`; `srcset` + `sizes` or `<picture>`; `loading="lazy"` below the fold; set `width`/`height` or `aspect-ratio` to stop layout shift.
6. **Touch and input.** Targets ≥ 44×44 px with spacing; no hover-only actions (`@media (hover: hover)` for hover extras); correct `type`/`inputmode`/`autocomplete` on inputs; font-size ≥ 16 px on inputs so iOS does not zoom.
7. **Tables and wide content.** Wrap in an `overflow-x: auto` box, or switch to cards on small screens. Long words: `overflow-wrap: anywhere`.
8. **Navigation.** Collapse to a menu or bottom bar on phones; keep the primary action reachable by thumb.
9. **Preferences.** `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`; text must survive 200% zoom.

## Native and cross-platform apps
- React Native: `useWindowDimensions`, `SafeAreaView`/`react-native-safe-area-context`, flex layouts, `KeyboardAvoidingView`, test small Android and large iPhone plus tablet.
- Flutter: `LayoutBuilder`/`MediaQuery`, `SafeArea`, `Flexible`/`Expanded`, adaptive widgets for tablet and landscape.
- PWA: manifest, icons, offline fallback page, installable on phone.

## Check
Open at 360, 390, 768, 1024, 1440 px and in landscape; zoom 200%; keyboard open on mobile forms. Look for horizontal scroll (`document.documentElement.scrollWidth > innerWidth`), clipped text, overlapped fixed elements. `webapp-testing` has a smoke script that flags horizontal scroll at phone and desktop widths.
