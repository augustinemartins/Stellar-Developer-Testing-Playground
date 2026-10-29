---
title: Remember the last arguments per contract and method
labels: complexity: medium, area: web
---

Reloading the workspace resets arguments to example values.

## Task

Persist arguments per network, contract and method (localStorage, size-capped) and restore them on load, with a **Reset to example** button.

## Acceptance criteria

- Scenarios and share links still take precedence over saved arguments.
- Storage failures don't break the page.
- Tests for restore, reset and precedence.

## Pointers

`apps/web/src/components/workspace/use-workspace.ts`, `apps/web/src/lib/storage.ts`.
