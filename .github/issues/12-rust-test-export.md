---
title: Export a scenario as a Rust soroban-sdk test
labels: complexity: medium, area: simulation-engine
---

Scenarios can be exported as Vitest, CLI, curl and Markdown. Contract authors would also like a Rust test skeleton.

## Task

Add `scenarioToRustTest(scenario)` producing a `#[test]` that registers the contract from its WASM, builds the arguments as Rust values and asserts the expected result or error. Add it to the export tab.

## Acceptance criteria

- Handles all argument types supported by the encoder (numbers, addresses, structs, enums, vecs, maps, options).
- Unit tests for each type; one snapshot for a full scenario.

## Pointers

`packages/simulation-engine/src/export.ts`, `apps/web/src/components/results/export-tab.tsx`.
