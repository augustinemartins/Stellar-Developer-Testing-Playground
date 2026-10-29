# Stellar Developer Testing Playground

A browser workspace for **simulating Soroban smart contract calls** on Stellar networks. Load a contract, call any method with typed arguments and see exactly what the network would do — return value, fees, resources, required signatures, events and state changes — **without signing or submitting anything**.

Any simulation can be saved as a **reproducible scenario**: replay it later with pass/fail checks, share it as a link, or export it as a Vitest test, a `stellar` CLI command, a `curl` request or a Markdown summary.

## Features

- **Any contract.** Paste a contract ID; its interface is read from the on-chain WASM. Stellar Asset Contracts (including native XLM) work too, and you can import a spec from JSON, XDR or a `.wasm` file.
- **Typed inputs.** A form control for each Soroban type, or a JSON editor with autocomplete and inline errors generated from the contract spec. Validation errors point at the exact field.
- **Clear results.** Return values decoded with the contract's own types, fees and resource use against live network limits, auth trees, an event inspector with the full call trace, state changes, and errors mapped to the contract's error enum (e.g. `CounterError::InvalidStep`).
- **Scenarios.** Save, replay, share and export simulations; run them headlessly in CI with `pnpm scenarios:run`.
- **Safe by design.** No keys, no signing code, no analytics. Requests go straight from your browser to the RPC you pick. Strict Content-Security-Policy; the editor is self-hosted.
- **Samples.** A Counter and a token contract (Rust, in `contracts/`) deployed on testnet, plus native XLM.

## Quick start

Requires Node.js 24 (see `.nvmrc`) and pnpm (`corepack enable`).

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

### Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Faugustinemartins%2FStellar-Developer-Testing-Playground&root-directory=apps%2Fweb&project-name=stellar-playground)

On Vercel, import the repository and set **Root Directory** to `apps/web`; the other settings are detected. Every push then redeploys automatically, and pull requests get preview URLs. The app's security headers (CSP and others) come from `next.config.ts`, so they apply on Vercel too.

Or with Docker:

```sh
docker build -t stellar-playground .
docker run --rm -p 3000:3000 stellar-playground
```

## Scripts

| Command                      | What it does                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`                   | Start the web app in development mode                                            |
| `pnpm build` / `start`       | Production build / serve it                                                      |
| `pnpm test`                  | Unit and component tests (offline, using recorded RPC fixtures)                  |
| `pnpm test:coverage`         | The same, with a coverage report                                                 |
| `pnpm test:testnet`          | Integration tests against Stellar testnet                                        |
| `pnpm test:e2e`              | Browser tests at desktop and phone size, with accessibility checks; uses testnet |
| `pnpm lint` / `format`       | ESLint / Prettier                                                                |
| `pnpm typecheck`             | TypeScript across all packages                                                   |
| `pnpm check`                 | Lint, typecheck, test and build                                                  |
| `pnpm scenarios:run <files>` | Replay scenario files and report pass/fail                                       |
| `pnpm contracts:build`       | Build the sample contracts                                                       |
| `pnpm contracts:deploy`      | Redeploy the samples to testnet (needed after a testnet reset)                   |

## Project layout

```text
apps/web                     Next.js UI
packages/shared-types        Spec, report and scenario schemas
packages/contract-loader     Contract ID → spec, sample registry
packages/simulation-engine   Argument encoding, simulation, scenarios, exports
packages/result-parser       Raw simulation → readable report
contracts/                   Rust sample contracts
examples/scenarios           Example scenarios, replayed in CI
docs/                        User docs (also served in the app at /docs)
e2e/, tests/                 Browser and testnet tests
```

See [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Documentation

Start with the [overview](docs/index.md) and the [five-minute tutorial](docs/first-simulation.md). The docs are also available in the app under **Docs**.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE). The sample contracts are for learning and testing only; they are not audited and must not hold real value.
