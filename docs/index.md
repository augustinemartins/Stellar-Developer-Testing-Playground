---
title: Overview
description: What the playground does, and where to start.
order: 1
---

# Stellar Developer Testing Playground

The playground is a browser workspace for **simulating** Soroban smart contract calls on Stellar networks and inspecting exactly what would happen — without signing or submitting anything.

You pick a contract, choose a method, enter typed arguments and press **Simulate**. The playground builds an unsigned `invokeHostFunction` transaction, sends it to the network's RPC `simulateTransaction` endpoint and shows you:

- the **return value**, decoded with the contract's own types;
- the **fees** and **resources** (CPU, ledger reads and writes, transaction size) against the network's per-transaction limits;
- the **authorization** entries a wallet would have to sign;
- the **events** the call emits, including the diagnostic call trace;
- the **state changes** the call would make;
- **errors**, mapped to the contract's error enum and explained.

## What makes it different: reproducible scenarios

Any simulation can be saved as a **scenario**: a small, versioned JSON document holding the network, contract, method, arguments and the outcome you expect. Scenarios can be:

- **replayed** later, with each expectation checked and differences from the recorded run highlighted;
- **shared** as a link (the scenario is compressed into the URL fragment, which never reaches a server);
- **exported** as a self-contained Vitest test, a `stellar contract invoke --send=no` command, a raw JSON-RPC `curl` request or a Markdown summary for issues;
- **run in CI** with `pnpm scenarios:run`.

## Start here

1. [Simulate your first call](first-simulation.md) — a five-minute tour with the Counter sample.
2. [Save, replay and share scenarios](scenarios.md).
3. [Turn scenarios into CI tests](testing-in-ci.md).
4. [Use your own contract](your-own-contract.md).

## Reference

- [Argument and value format](value-format.md)
- [Reading simulation results](reading-results.md)
- [Errors and troubleshooting](errors.md)
- [Architecture](architecture.md)
- [Security and privacy](security.md)
- [Redeploying the samples](deploying-samples.md)
