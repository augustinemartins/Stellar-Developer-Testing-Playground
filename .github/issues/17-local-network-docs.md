---
title: Document and test the local quickstart network
labels: complexity: medium, area: docs, area: tests
---

There is a `local` network preset, but no guide for running the playground against `stellar container start local`.

## Task

Write `docs/local-network.md` (start quickstart, deploy samples with `STELLAR_RPC_URL`, select the preset) and add an optional CI job that runs the scenario runner against a quickstart container.

## Acceptance criteria

- Following the doc from a clean checkout works.
- The CI job is manual (`workflow_dispatch`) so it doesn't slow pull requests.
