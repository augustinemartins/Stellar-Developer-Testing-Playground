---
title: Turn scenarios into CI tests
description: Export Vitest tests and run scenario files headlessly.
order: 4
---

# Turn scenarios into CI tests

Scenarios are useful beyond the browser. There are two ways to run them automatically.

## Option A: export a Vitest test

**Save & export → Vitest test** downloads a self-contained `*.test.ts` file. It depends only on `vitest` and `@stellar/stellar-sdk`:

```bash
npm i -D vitest @stellar/stellar-sdk@^17
npx vitest run counter-reset.test.ts
```

The generated test:

- rebuilds the same transaction from the recorded argument XDR, so encoding is byte-identical;
- simulates it against the scenario's RPC;
- asserts the expectations — the exact return value XDR, the contract error code, the fee and instruction bounds, the event count and the number of auth entries.

The arguments are also written as a comment in the playground's JSON format, so the test stays readable in code review.

## Option B: run scenario files with the playground

Commit scenario JSON files and run them with the bundled runner:

```bash
pnpm scenarios:run examples/scenarios/*.json
```

```text
✓ Counter: Read the count  (examples/scenarios/counter-get.json, ledger 5449615, 250 ms)
✓ Counter: Trigger InvalidStep  (examples/scenarios/counter-invalid-step.json, ledger 5449615, 258 ms)
…
7 passed, 0 failed
```

The command exits non-zero if any scenario fails. Add `--json` for machine-readable output.

### GitHub Actions

```yaml
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with: { node-version: 24, cache: pnpm }
- run: pnpm install --frozen-lockfile
- run: pnpm scenarios:run scenarios/*.json
```

## Keeping scenarios green

Simulations run against live ledger state, so a scenario can legitimately start failing:

- **The contract changed.** That is what the scenario is for — investigate.
- **State changed.** For example, a balance check after someone transferred tokens. Prefer expectations that do not depend on mutable state, or use a contract you control on a local network.
- **Testnet was reset.** Contracts disappear; see [Redeploying the samples](deploying-samples.md). For CI, consider running a local network with `stellar container start local` and pointing scenarios at `http://localhost:8000/rpc`.
- **Costs drifted.** Fee and instruction bounds have 25% headroom. Edit `maxResourceFee` / `maxInstructions` in the JSON if a protocol upgrade moves costs permanently.
