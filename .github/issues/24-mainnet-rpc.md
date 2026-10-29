---
title: Safe mainnet support with an RPC provider picker
labels: complexity: high, area: web, security
---

The mainnet preset needs users to bring their own RPC. Picking a provider and understanding the risks should be easier.

## Task

Add a curated list of public mainnet RPC providers (configurable via a JSON file), a health/latency check, clear "real network" styling across the workspace, and a confirmation the first time a user switches to mainnet.

## Acceptance criteria

- Mainnet is visually distinct everywhere (header, workspace, exports).
- Share links and scenarios record the network, and replays warn before using mainnet.
- Tests for the provider list and switching flow.
