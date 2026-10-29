---
title: Publish the scenario runner as a reusable GitHub Action
labels: complexity: high, area: ci
---

`pnpm scenarios:run` replays scenario files, but other repositories can't use it without copying this one.

## Task

Package the runner as a composite or JavaScript action (`uses: <owner>/Stellar-Developer-Testing-Playground/actions/run-scenarios@v1`) with inputs for the file glob, network and RPC URL, a job summary table of results, and non-zero exit on failure.

## Acceptance criteria

- Example workflow in `docs/testing-in-ci.md`.
- This repository's CI uses the action itself.
- Versioned with tags.
