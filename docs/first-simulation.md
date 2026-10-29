---
title: Simulate your first call
description: A five-minute tour of the workspace using the Counter sample.
order: 2
---

# Simulate your first call

This tutorial uses the **Counter** sample contract, deployed on testnet from `contracts/counter` in this repository. You need nothing but a browser: no wallet, no account, no XLM.

## 1. Open the sample

On the home page, choose **Open Counter**. The workspace has three columns:

| Column  | What it shows                                                                                 |
| ------- | --------------------------------------------------------------------------------------------- |
| Methods | Every public function in the contract spec, with its signature. `read` marks likely getters.  |
| Inputs  | Typed fields for the selected method, the optional source account and the authorization mode. |
| Result  | Tabs for the outcome of the latest simulation.                                                |

The method list comes from the contract's **spec** — the `contractspecv0` section that `soroban-sdk` embeds in every contract WASM. For contracts you paste by ID, the playground downloads the WASM from the network and reads it in your browser.

## 2. Read a value

Select `get` and press **Simulate** (or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>).

The **Overview** tab shows a `u32` return value. Open **Fees & resources**: a read-only call needs very few CPU instructions, reads the contract instance and code, and writes nothing.

## 3. Call a method with arguments

Select `increment_by`. Its signature is `increment_by(step: u32) -> Result<u32, CounterError>`.

Type `5` and simulate. Now:

- the return value is the new count;
- **Events** shows an `Incremented` event, decoded with the parameter names from the contract (`step`, `count`);
- **State** shows the instance storage entry that _would_ be updated;
- the resource meters show one read-write entry.

Nothing was written. Simulate again and the count is the same, because simulation never changes the ledger.

## 4. Trigger an error

Set `step` to `0` and simulate. The simulation fails with **Contract error #2: CounterError::InvalidStep**, and the hint repeats the doc comment from the Rust source. Switch the **Events** tab to _Full trace_ to see the diagnostic events emitted up to the failure.

Try `-1` too: the playground rejects it before any network request, because `-1` is out of range for `u32`.

## 5. See what needs a signature

Select `reset`. It calls `caller.require_auth()`. Use the suggested call **Reset as owner** to fill in the owner address, then simulate in **Record** mode.

The **Auth** tab lists one authorization entry for the owner address and the invocation it covers (`reset` on the counter contract). This is exactly what a wallet would be asked to sign before the transaction could be submitted.

Switch the authorization mode to **Enforce** and simulate again: it fails with `Error(Auth, InvalidAction)`, because no signed entry was provided.

## Next

[Save this simulation as a scenario](scenarios.md) so you can replay and share it.
