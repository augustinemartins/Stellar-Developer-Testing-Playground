---
title: Show relative times in the run history menu
labels: complexity: trivial, area: web, good first issue
---

The run history dropdown shows clock times (`1:49:47 PM`). Relative times ("2 min ago") are easier to scan.

## Task

Use `Intl.RelativeTimeFormat` for runs under 24 hours old and keep the full timestamp in a `title`/accessible description.

## Acceptance criteria

- Labels update at least once a minute.
- Unit test for the formatting helper.

## Pointers

`apps/web/src/components/results/result-panel.tsx`.
