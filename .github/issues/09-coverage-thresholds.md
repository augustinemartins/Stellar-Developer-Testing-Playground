---
title: Raise unit test coverage to 75% and enforce it in CI
labels: complexity: medium, area: tests
---

Overall statement coverage is about 50% (`pnpm test:coverage`). The packages are well tested; most gaps are in `apps/web`.

## Task

Add tests until total statement coverage is ≥ 75%, then set `coverage.thresholds` in `vitest.config.ts` so CI fails if it drops.

## Acceptance criteria

- `pnpm test:coverage` passes with thresholds for statements, branches, functions and lines.
- Tests use recorded fixtures, not live network calls.

## Pointers

`vitest.config.ts`, `apps/web/test/`, `packages/result-parser/test/fixtures/`.
