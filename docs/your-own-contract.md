---
title: Use your own contract
description: Simulate calls against any deployed contract.
order: 8
---

# Use your own contract

## A deployed contract

1. Choose the network in the header. For a local node started with `stellar container start local`, pick **Local (stellar/quickstart)**.
2. Paste the contract ID (`C…`) on the home page and press **Open**.

The playground fetches the contract instance, downloads its WASM and reads the interface in your browser. Specs are cached by WASM hash, so contracts sharing code load instantly.

Stellar Asset Contracts (wrapped classic assets such as native XLM) have no WASM; the playground recognises them and uses the standard token interface.

## A contract that is not deployed yet

Deploy it first. Simulation needs the contract on the network. With the Stellar CLI:

```bash
stellar contract build
stellar contract deploy --wasm target/wasm32v1-none/release/my_contract.wasm --source alice --network testnet
```

## When the spec cannot be read

Use **Import spec** in the workspace header. It accepts:

- the contract's `.wasm` file;
- `stellar contract info interface --output xdr-base64-array` output;
- a playground spec JSON (`{ "functions": [], "types": [], "events": [] }`).

The imported spec is used to build arguments and decode results; the simulation still runs against the deployed contract.

## Tips

- Leave the **source account** empty unless your contract inspects it. A placeholder account is used and needs no funding.
- `require_auth` on the source account is satisfied implicitly. To see auth for another address, pass that address as an argument.
- Save scenarios for the calls your frontend makes. Replaying them after each contract upgrade is a quick regression check.
