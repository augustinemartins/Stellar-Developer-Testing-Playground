---
title: Add Open Graph and Twitter card metadata
labels: complexity: trivial, area: web, good first issue
---

Links to the playground show no preview in Discord, Slack or X.

## Task

Add `openGraph` and `twitter` fields to the root `metadata` and a static `opengraph-image` (1200×630) generated with `next/og` or committed as a PNG.

## Acceptance criteria

- `og:title`, `og:description`, `og:image` and `twitter:card=summary_large_image` are present on every page.
- Docs pages use their own title and description.

## Pointers

`apps/web/src/app/layout.tsx`, `apps/web/src/app/docs/[slug]/page.tsx`.
