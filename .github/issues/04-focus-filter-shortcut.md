---
title: Press `/` to focus the method filter
labels: complexity: trivial, area: web, good first issue, accessibility
---

Contracts with many methods (the Stellar Asset Contract has 16) are quicker to navigate with a keyboard shortcut.

## Task

Pressing `/` anywhere in the workspace focuses the **Filter methods** search box, unless focus is already in a text field or the JSON editor.

## Acceptance criteria

- `/` focuses the filter; typing in inputs is unaffected.
- The placeholder or a tooltip mentions the shortcut.
- A component test covers it.

## Pointers

`apps/web/src/components/workspace/method-list.tsx`.
