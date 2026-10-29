---
title: Redeploying the samples
description: Rebuild and redeploy the sample contracts after a testnet reset.
order: 9
---

# Redeploying the samples

The **Counter** and **Sample token** contracts live in `contracts/` and are deployed to testnet. Testnet is reset roughly every quarter, which deletes every contract. When that happens the workspace shows *“This sample is not deployed on testnet right now”*.

The **Native XLM** sample is a Stellar Asset Contract whose ID is derived from the network passphrase, so it survives resets.

## Redeploy

```bash
pnpm contracts:deploy
```

The script funds two throwaway accounts with friendbot, uploads `contracts/artifacts/*.wasm`, creates both contracts with their constructors, mints 1000 PLAY to a demo holder and increments the counter. It writes the new IDs to `packages/contract-loader/src/fixtures/deployments.json`.

Then refresh the recorded fixtures and examples:

```bash
pnpm tsx scripts/capture-rpc-fixtures.ts   # offline unit-test fixtures
pnpm tsx scripts/record-examples.ts        # examples/scenarios
pnpm test && pnpm test:testnet
```

No secret is required or stored: the deployer key is generated per run and discarded.

## Rebuilding the contracts

```bash
pnpm contracts:build
```

This runs `cargo build --release --target wasm32v1-none`, copies the WASM to `contracts/artifacts/` and regenerates the spec fixtures in `packages/contract-loader/src/fixtures/`. You need Rust with the `wasm32v1-none` target:

```bash
rustup target add wasm32v1-none
```

The contracts use `soroban-sdk` 25.3, which builds with plain `cargo`. Releases from 26 onward require `stellar contract build` (stellar-cli 25.2+); if you upgrade, change the build script accordingly.

Run the contract unit tests with:

```bash
cd contracts && cargo test
```
