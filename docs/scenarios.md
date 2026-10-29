---
title: Save, replay and share scenarios
description: Turn a simulation into a reproducible test case.
order: 3
---

# Save, replay and share scenarios

A **scenario** records _what you called_ and _what you expect_. It is the playground's unit of reproducibility.

## Save a scenario

After any simulation, open the **Save & export** tab:

1. Give the scenario a name and, ideally, a description of what it checks.
2. Leave **Lock this result as expectations** on. The playground derives checks from the run:
   - `status` — `success`, `error` or `restore_required`;
   - `returnValue` — the JSON rendering of the return value;
   - `contractErrorCode` — for scenarios that test failure paths;
   - `maxResourceFee` and `maxInstructions` — the recorded values plus 25% headroom, because costs move a little with ledger state;
   - `contractEventCount` — the number of contract events;
   - `requiredAuth` — the set of addresses that must sign.
3. Press **Save scenario**. It is stored in this browser (localStorage).

## Replay

On **Scenarios**, press **Replay**. The playground simulates the call again against the current ledger and shows a table of expectations with expected and actual values. Under _Changed since recording_ you will also see differences from the recorded run that are not expectations — for example a fee that moved but stayed under the bound.

**Run all** replays every saved scenario in order.

## Share

- **Share link** compresses the scenario into the link's `#fragment`. Browsers do not send fragments to servers, so the scenario never leaves the people you send it to. Links drop the recorded run to stay short; they keep the arguments, expectations and contract spec.
- **JSON** downloads the full scenario, including the recorded run. Commit these files next to your contract code.
- **Export all** downloads a collection file that **Import files** accepts.

## The file format

```json
{
  "schema": "stellar-playground/scenario",
  "version": 1,
  "id": "counter-invalid-step",
  "name": "Counter: Trigger InvalidStep",
  "network": { "id": "testnet", "rpcUrl": "https://soroban-testnet.stellar.org", "networkPassphrase": "Test SDF Network ; September 2015" },
  "contract": { "id": "C…", "label": "Counter", "spec": { "functions": [], "types": [], "events": [] } },
  "invocation": { "method": "increment_by", "args": { "step": 0 }, "authMode": "record" },
  "expect": { "status": "error", "contractErrorCode": 2 },
  "recorded": { "at": "…", "latestLedger": 5449615, "argsXdr": ["AAAAAwAAAAA="], "transactionXdr": "…", "report": {} }
}
```

- `args` use the [value format](value-format.md), so they are readable and editable by hand.
- `contract.spec` is a snapshot of the contract interface, so replays don't depend on fetching WASM.
- `recorded.argsXdr` holds the exact encoded arguments, so exports reproduce the call byte for byte.
- Unknown keys in `expect` are rejected, so a typo such as `stauts` cannot silently pass.

The schema lives in `packages/shared-types/src/scenario.ts` and is validated on every import.

## Example scenarios

`examples/scenarios/` contains scenarios for every sample contract, including failure and authorization cases. Import them from the Scenarios page or run them from the command line, as described in [Turn scenarios into CI tests](testing-in-ci.md).
