---
title: Make the result tabs easier to use on phones
labels: complexity: medium, area: web, accessibility
---

On phone screens the result tab bar overflows horizontally and later tabs (Events, State, Raw, Save & export) are off screen with no visual hint.

## Task

Make the tab list scroll horizontally with edge fades, scroll the selected tab into view, and support arrow-key navigation per the WAI-ARIA tabs pattern.

## Acceptance criteria

- All tabs reachable by touch and keyboard at 360px width.
- The `mobile` Playwright project covers switching to the last tab.
- axe checks still pass.
