---
title: Allow removing a single entry from Recent contracts
labels: complexity: trivial, area: web, good first issue
---

The home page lists recently opened contracts. There's a button to clear the whole list, but no way to remove just one entry.

## Task

Add a remove button to each entry, with an accessible label such as "Remove CABC… from recents", backed by a `removeRecent(contractId, networkPassphrase)` function in the settings context.

## Acceptance criteria

- Removal persists across reloads; other entries are untouched.
- The button is keyboard accessible and announced correctly.
- Component test for removing one entry.

## Pointers

`apps/web/src/components/home-view.tsx`, `apps/web/src/lib/settings.tsx` (`clearRecents` already exists).
