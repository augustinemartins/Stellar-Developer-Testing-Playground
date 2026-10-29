---
title: Add a third sample contract with nested authorization
labels: complexity: medium, area: contracts
---

The Counter and token samples only show single-level auth. A contract that calls the token on behalf of a user would demonstrate nested `require_auth` trees in the Auth tab.

## Task

Add a small escrow contract in `contracts/escrow` (deposit pulls tokens with `transfer`, release/refund by an arbiter), with Rust unit tests, deployment in `scripts/deploy-samples.ts`, a sample entry with suggested calls, and an example scenario.

## Acceptance criteria

- `cargo test` passes; clippy is clean.
- The Auth tab shows the nested token transfer under the escrow call.
- Docs list the new sample.
