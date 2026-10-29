---
title: Architecture
description: How the packages fit together.
order: 10
---

# Architecture

The playground is a pnpm monorepo. All network traffic goes directly from the browser to the RPC you choose; the Next.js server only serves the app.

```text
apps/web ──▶ simulation-engine ──▶ result-parser ──▶ shared-types
   │               │                                     ▲
   │               └──────▶ contract-loader ─────────────┘
   └────────────────────────────▶ (all of the above)
                          @stellar/stellar-sdk ──▶ Stellar RPC
```

| Package                      | Responsibility                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/shared-types`      | The normalised contract spec model, the simulation report schema and the versioned scenario schema (zod). No network code.                                                                                         |
| `packages/contract-loader`   | Resolves a contract ID to its executable, downloads WASM, parses `contractspecv0` into the spec model, validates contract IDs, builds example values and JSON Schemas, and holds the sample registry and fixtures. |
| `packages/simulation-engine` | Validates and encodes typed JSON arguments to `ScVal`, builds the unsigned transaction, simulates it, checks scenario expectations, and exports scenarios (Vitest, CLI, curl, Markdown, share links).              |
| `packages/result-parser`     | Turns the raw `simulateTransaction` response into a JSON-safe report: decoded values, resources, footprint, auth trees, events matched to the spec, state changes and classified errors.                           |
| `apps/web`                   | The Next.js UI.                                                                                                                                                                                                    |
| `contracts/`                 | Rust sample contracts built with `soroban-sdk`, with unit tests.                                                                                                                                                   |
| `examples/scenarios`         | Example scenario files, replayed in CI.                                                                                                                                                                            |
| `tests/`                     | End-to-end tests against testnet (opt-in).                                                                                                                                                                         |

## A simulation, step by step

1. **Spec.** `contract-loader` fetches the contract instance. For WASM contracts it downloads the code and parses the spec; for Stellar Asset Contracts it uses the built-in token interface.
2. **Encode.** `simulation-engine` validates the JSON arguments against the function's input types, collecting every error with its path, and encodes them to `ScVal` (structs as sorted maps, unions as `[Symbol, ...values]`, and so on).
3. **Build.** An `invokeHostFunction` transaction is built with the source account — the real sequence number if the account exists, otherwise a placeholder. It is never signed.
4. **Simulate.** The raw JSON-RPC response is kept verbatim, so it can be stored, exported and re-parsed offline.
5. **Parse.** `result-parser` produces a `SimulationReport` that is plain JSON and validated by the shared schema.

## Design choices

- **Read-only by construction.** There is no signing code path. Submission would be a separate, explicitly confirmed feature using a wallet.
- **Raw responses are the source of truth.** Reports are derived data; recorded scenarios keep both so future versions can re-derive better reports.
- **Own spec model.** The XDR spec is normalised into plain JSON, which makes fixtures diffable, lets scenarios embed a spec snapshot, and keeps the UI independent of SDK internals.
- **Schemas at the boundary.** Every imported or shared scenario is validated before use; unknown expectation keys are rejected.
