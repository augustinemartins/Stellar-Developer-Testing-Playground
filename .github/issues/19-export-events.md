---
title: Export events as JSON or CSV from the event inspector
labels: complexity: medium, area: web
---

## Task

Add **Download JSON** and **Download CSV** buttons to the Events tab that export the currently filtered events (index, type, contract, name, topics, data, decoded params).

## Acceptance criteria

- CSV escapes commas, quotes and newlines correctly.
- Respects the active filter and search.
- Unit tests for the CSV builder.

## Pointers

`apps/web/src/components/results/events-tab.tsx`, `apps/web/src/lib/files.ts`.
