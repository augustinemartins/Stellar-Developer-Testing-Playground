---
title: Contract storage explorer
labels: complexity: high, area: web, area: result-parser
---

Users can see state _changes_ from a simulation, but not the contract's current storage.

## Task

Add a **Storage** view that lists a contract's instance storage and lets users look up persistent/temporary entries by key (typed with the spec where possible) via `getLedgerEntries`, showing value, durability and TTL / live-until ledger, with a restore hint for archived entries.

## Acceptance criteria

- Keys and values decoded with the same value format as arguments.
- Handles missing and archived entries clearly.
- Unit tests with recorded `getLedgerEntries` responses.
