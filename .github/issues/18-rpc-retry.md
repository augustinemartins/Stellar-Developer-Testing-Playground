---
title: Friendlier handling of RPC rate limits and timeouts
labels: complexity: medium, area: simulation-engine, area: web
---

When the public RPC returns HTTP 429 or times out, users see a generic "The RPC request failed" message.

## Task

Classify 429s, timeouts and network errors in the simulation engine, retry idempotent reads with exponential backoff (max 3 tries), and show a specific message with a **Retry** button and a suggestion to use a custom RPC.

## Acceptance criteria

- Unit tests with a mocked server for each error class.
- Simulations are never retried in a way that changes results (they're read-only, but keep it explicit).
