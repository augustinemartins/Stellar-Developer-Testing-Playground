---
title: Address book with names for frequently used accounts
labels: complexity: medium, area: web
---

Address fields suggest the sample accounts, but users can't save their own.

## Task

Let users save addresses with a label (stored in localStorage), manage them from a small dialog, and show them in address field suggestions as `label — G…`.

## Acceptance criteria

- Rejects invalid addresses and **never accepts secret keys (`S…`)**.
- Import/export the address book as JSON.
- Tests for validation and persistence.
