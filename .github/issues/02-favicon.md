---
title: Add a favicon and app icons
labels: complexity: trivial, area: web, good first issue
---

The app has no favicon, so browser tabs show a blank icon.

## Task

Add an SVG favicon (matching the ✦ mark in the header) plus a 180×180 Apple touch icon using Next.js file conventions (`app/icon.svg`, `app/apple-icon.png`).

## Acceptance criteria

- Tabs show the icon in light and dark browser themes.
- No new requests to third-party origins (the CSP must stay unchanged).

## Pointers

`apps/web/src/app/`, header mark in `apps/web/src/components/app-header.tsx`.
