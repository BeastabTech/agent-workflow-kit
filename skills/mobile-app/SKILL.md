---
name: mobile-app
description: Build and ship mobile apps and installable web apps - React Native / Expo, Flutter or a PWA shell - with safe areas, offline and slow-network handling, contextual permissions, push notifications, deep links, app-store builds, environment config and parity with the web design system. Use for any mobile, iOS, Android, Expo, Flutter or PWA task.
---

# Mobile apps

## Structure
- Share types, API client and validation with the web app where the stack allows. Keep platform code thin.
- Environment config per build profile (dev, preview, production); never hard-code API hosts or keys in source. Public keys only in the app bundle; secrets stay on the server.
- Match the web design system: same tokens (colours, radius, type scale), same component names where possible, light and dark.

## UX rules
- Safe areas on every screen (notch, home indicator, status bar colour that matches the screen).
- Touch targets ≥ 44 pt; thumb-reachable primary actions; keyboard never covers the focused input.
- **Permissions in context**: ask for camera, location, notifications or health data at the moment the feature needs it, with a one-line reason first. Handle "denied" and "limited" gracefully with a path to settings.
- Every screen has loading, empty, error and offline states. Cache the last good data; queue writes for retry when offline if the feature needs it.
- Respect system font size, reduced motion and dark mode.

## Platform features
- Push notifications: register after the user opts in; store tokens per device; handle token refresh and logout; notification taps deep-link to the right screen.
- Deep links / universal links tested from cold start and from background.
- Background work is limited by the OS; do not rely on timers when the app is closed.

## Build and release
- Version and build numbers bumped per release; release notes.
- Test on a small Android phone, a recent iPhone, and a tablet (or simulators), plus slow 3G.
- Store builds and submissions are outward-facing: they need a human's typed yes (see the `deploy` skill).
- PWA: manifest, icons, service worker with an offline fallback, install prompt only after engagement.
