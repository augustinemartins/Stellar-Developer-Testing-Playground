---
title: Component tests for the Saved Scenarios screen
labels: complexity: medium, area: tests
---

`apps/web/src/components/scenarios-view.tsx` (≈400 lines) has browser coverage but no component tests.

## Task

Test importing (file, pasted JSON, invalid JSON), deleting with confirmation, export downloads, and the shared-link banner, with the simulation engine mocked.

## Acceptance criteria

- Each user action above has at least one test.
- No network access during the tests.
