# Contributing

Thanks for helping improve the playground.

## Setup

```sh
corepack enable
pnpm install
pnpm dev
```

For the sample contracts you also need Rust (stable). Run `cargo test` in `contracts/`.

## Before opening a pull request

```sh
pnpm check          # lint, typecheck, unit tests, build
pnpm format         # apply Prettier
```

If you changed the UI, also run the browser tests (they need Chromium and use testnet):

```sh
pnpm exec playwright install --with-deps chromium
pnpm build && pnpm test:e2e
```

## Guidelines

- **Keep it read-only.** The playground must never handle secret keys or sign transactions.
- **Tests.** Add or update tests with each change. Package tests run offline against recorded RPC responses; record new ones with `scripts/capture-rpc-fixtures.ts` instead of calling the network in unit tests.
- **Browser-safe packages.** Code in `packages/` runs in the browser: don't use Node APIs such as `Buffer` or `fs` there.
- **Accessibility.** Controls need labels, errors must be linked to their fields, and everything must work with the keyboard.
- **Docs.** User-facing changes should update the relevant page in `docs/`.
- **Commits.** Small, focused commits with clear messages.

## Testnet resets

Testnet is reset periodically, which deletes the sample contracts. If testnet tests fail with "contract not found", run `pnpm contracts:deploy` (see [docs/deploying-samples.md](docs/deploying-samples.md)) and commit the updated `deployments.json`.
