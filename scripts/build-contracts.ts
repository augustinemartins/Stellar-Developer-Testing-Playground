/**
 * Builds the sample contracts and regenerates the JSON spec fixtures used by
 * the playground.
 *
 *   pnpm contracts:build            # cargo build + copy WASM + regenerate fixtures
 *   pnpm contracts:build --no-cargo # only regenerate fixtures from contracts/artifacts
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { specFromWasm, specFromXdr } from "../packages/contract-loader/src/normalize";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = join(root, "contracts/artifacts");
const fixtures = join(root, "packages/contract-loader/src/fixtures");
const CONTRACTS = [
  { crate: "counter", wasm: "counter.wasm" },
  { crate: "sample-token", wasm: "sample_token.wasm" },
];

mkdirSync(artifacts, { recursive: true });
mkdirSync(fixtures, { recursive: true });

if (!process.argv.includes("--no-cargo")) {
  execFileSync("cargo", ["build", "--release", "--target", "wasm32v1-none"], {
    cwd: join(root, "contracts"),
    stdio: "inherit",
  });
  for (const c of CONTRACTS) {
    copyFileSync(join(root, "contracts/target/wasm32v1-none/release", c.wasm), join(artifacts, c.wasm));
  }
}

function write(name: string, data: unknown) {
  writeFileSync(join(fixtures, name), JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote packages/contract-loader/src/fixtures/${name}`);
}

for (const c of CONTRACTS) {
  const wasm = readFileSync(join(artifacts, c.wasm));
  const wasmHash = createHash("sha256").update(wasm).digest("hex");
  write(`${c.crate}.spec.json`, { wasmHash, spec: specFromWasm(wasm) });
}

// The Stellar Asset Contract has no WASM; the SDK ships its interface as XDR.
const require = createRequire(import.meta.url);
// package.json is not exported, so resolve the entry point and walk up to the package root.
const sdkEntry = require.resolve("@stellar/stellar-sdk", { paths: [join(root, "packages/contract-loader")] });
const sdkRoot = sdkEntry.slice(0, sdkEntry.lastIndexOf("/lib/"));
const sacSource = readFileSync(join(sdkRoot, "lib/esm/bindings/sac-spec.js"), "utf8");
const match = /SAC_SPEC = "([A-Za-z0-9+/=]+)"/.exec(sacSource);
if (!match?.[1]) throw new Error("Could not find SAC_SPEC in the Stellar SDK");
write("stellar-asset.spec.json", { wasmHash: null, spec: specFromXdr(match[1]) });
