---
name: html-page
description: Write a polished, self-contained HTML page - landing page, report, dashboard mock, docs page, email-safe layout or prototype - with semantic markup, design tokens, light and dark mode, responsive layout, accessible structure, fast loading and no build step. Use when asked for an HTML file, a single-page site, a static page, a prototype or a shareable page.
---

# HTML page

Start from `templates/page.html` next to this file (copy it, then edit). It already has: viewport and meta tags, colour tokens for light and dark, a fluid type scale, a responsive container and grid, skip link, focus styles, reduced-motion support and a print style.

## Structure
- `<header>`, `<nav>`, `<main id="main">`, `<section>` with headings in order (one `<h1>`), `<footer>`. Buttons for actions, links for navigation.
- `<title>` and `<meta name="description">` that say what the page is. Add Open Graph tags if it will be shared.
- `lang` on `<html>`; `alt` on every meaningful image (`alt=""` for decorative).

## Style
- All colours, spacing and radii as CSS custom properties on `:root`; dark mode by redefining them under `@media (prefers-color-scheme: dark)`.
- System font stack or one web font with `font-display: swap`. Limit to 2 weights.
- Mobile-first layout (see the `responsive-ui` skill). No horizontal scroll at 360 px.
- Pick a clear visual direction (see `frontend-design`); avoid template look-alikes.

## Behaviour
- Works without JavaScript where possible; JS small, inline or deferred, no framework for a static page.
- Pin exact versions if you load a library from a CDN, and only from a trusted CDN. No trackers unless asked.
- Forms: labels, `required`, `autocomplete`, clear error text; never post data anywhere the user did not name.

## Email HTML (different rules)
Table layout, inline styles, 600 px max width, no JS, no external CSS, web-safe fonts, alt text on images, test in a dark-mode mail client.

## Check
Open the file in a browser at phone and desktop widths, light and dark. Validate with the W3C validator or `npx html-validate page.html` if available. Run an accessibility check (axe or Lighthouse) for anything public.
