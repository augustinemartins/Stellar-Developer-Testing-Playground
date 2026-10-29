---
title: Show ⌘+Enter instead of Ctrl+Enter on macOS
labels: complexity: trivial, area: web, good first issue
---

The simulate shortcut works with both Ctrl+Enter and ⌘+Enter, but the hint under the **Simulate** button always says `Ctrl + Enter`.

## Task

Detect macOS/iOS (e.g. `navigator.platform` / `navigator.userAgentData`) and show `⌘ + Enter` there. Render `Ctrl` on the server and switch after hydration to avoid a mismatch.

## Acceptance criteria

- macOS shows `⌘ + Enter`; other platforms show `Ctrl + Enter`.
- No hydration warning in the console.
- A component test covers both cases.

## Pointers

`apps/web/src/components/workspace/function-panel.tsx` (the `<kbd>` hint near the Simulate button).
