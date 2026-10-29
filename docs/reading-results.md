---
title: Reading simulation results
description: What every tab in the result panel means.
order: 6
---

# Reading simulation results

## Overview

- **Status** — `success`, `error`, or `restore_required` (the call would succeed once archived ledger entries are restored).
- **Return value** — decoded with the function's declared return type. *Typed tree* shows the raw `ScVal` with a type tag on every node. *Copy XDR* gives the exact base64 value.
- **Summary** — estimated fee, CPU instructions, contract events and signatures needed.
- **Context** — the ledger the simulation ran against, the source account and the auth mode. Results are only valid for that ledger state.

## Fees & resources

Soroban transactions pay two fees:

| Fee | Meaning |
| --- | --- |
| Resource fee | Pays for CPU, disk reads, writes, transaction size, events and rent. Simulation reports the minimum (`minResourceFee`). |
| Inclusion fee | Your bid for a place in the ledger. The playground uses the 100-stroop minimum; it rises under congestion. |

Resource meters compare this call's usage with the network's **per-transaction limits**. The playground reads those limits live from the network's config settings (marked *live network limits*); if that fails it falls back to documented defaults. A meter near 100% means the call is close to failing on a busier ledger or with larger inputs.

The **storage footprint** lists every ledger entry the call reads (read-only) or may modify (read-write). Labels show the contract data key, its durability (`persistent` / `temporary` / `instance`) and the owning contract.

## Auth

Each entry is an authorization a signer would need to provide:

- **Address credentials** — a separate signature by that address over the invocation tree shown. A wallet signs this.
- **Transaction source** — satisfied by the transaction's own signature when the signer is the source account.

The invocation tree shows the authorized function and any sub-invocations (for example a token transfer made by another contract on your behalf).

**Record** mode discovers these entries. **Enforce** mode requires them to be present and valid, which a read-only playground cannot provide — useful to confirm a call fails without auth.

## Events

- **Contract events** are emitted with `env.events().publish` or `#[contractevent]`. When the contract spec declares the event, its parameters are decoded by name.
- **Diagnostic events** form a trace of the execution: `fn_call` and `fn_return` markers (indented to show nesting), `log` output and `error` events. They are only produced in simulation.
- **System events** come from the host itself.

Events from failed calls are rolled back; the trace still shows them so you can see how far execution got.

## State

The ledger entries the transaction would create, update or delete, with before/after values for contract data. Nothing is written by a simulation.

## Raw

The JSON arguments, their XDR encoding, the unsigned transaction envelope and the RPC response exactly as received. Use these to reproduce a result in another tool or attach it to a bug report.
