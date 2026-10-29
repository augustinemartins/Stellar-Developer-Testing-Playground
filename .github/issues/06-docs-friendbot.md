---
title: Docs: troubleshooting for friendbot and RPC rate limits
labels: complexity: trivial, area: docs, good first issue
---

**Create funded test account** and `pnpm contracts:deploy` rely on friendbot, and simulations rely on the public RPC. Neither failure mode is documented.

## Task

Add a section to `docs/errors.md` covering: friendbot errors (already funded, rate limited, down), HTTP 429 from the RPC, and how to switch to a custom RPC.

## Acceptance criteria

- Each case lists the message users see and what to do.
- Linked from the README troubleshooting text and rendered at `/docs/errors`.
