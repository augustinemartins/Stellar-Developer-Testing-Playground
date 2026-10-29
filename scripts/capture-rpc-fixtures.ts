/**
 * Captures raw simulateTransaction responses from testnet into
 * packages/result-parser/test/fixtures so unit tests run offline against real
 * RPC output. Re-run after redeploying samples: `pnpm tsx scripts/capture-rpc-fixtures.ts`.
 */
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NETWORKS } from "../packages/shared-types/src";
import { SAMPLE_CONTRACTS, SAMPLE_DEPLOYMENTS } from "../packages/contract-loader/src";
import { simulateInvocation } from "../packages/simulation-engine/src";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "packages/result-parser/test/fixtures");
const { owner, holder } = SAMPLE_DEPLOYMENTS.accounts;

const cases: { name: string; sample: string; method: string; args: Record<string, never> | Record<string, unknown>; source?: string }[] = [
  { name: "counter-get", sample: "counter", method: "get", args: {} },
  { name: "counter-increment-by", sample: "counter", method: "increment_by", args: { step: 5 } },
  { name: "counter-invalid-step", sample: "counter", method: "increment_by", args: { step: 0 } },
  { name: "counter-reset", sample: "counter", method: "reset", args: { caller: owner } },
  { name: "counter-stats", sample: "counter", method: "stats", args: {} },
  {
    name: "token-transfer-with-memo",
    sample: "sample-token",
    method: "transfer_with_memo",
    args: { from: holder, to: owner, amount: "10000000", memo: { tag: "Text", values: ["thanks"] } },
  },
  { name: "token-overdraft", sample: "sample-token", method: "transfer", args: { from: owner, to: holder, amount: "1" } },
  { name: "token-metadata", sample: "sample-token", method: "metadata", args: {} },
  { name: "xlm-balance", sample: "native-xlm", method: "balance", args: { id: holder } },
];

for (const c of cases) {
  const sample = SAMPLE_CONTRACTS.find((s) => s.slug === c.sample)!;
  const run = await simulateInvocation({
    network: NETWORKS.testnet,
    contractId: sample.contractId!,
    method: c.method,
    args: c.args as never,
    spec: sample.spec,
    source: c.source,
  });
  const file = join(out, `${c.name}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      { contractId: run.contractId, sample: c.sample, method: c.method, args: c.args, argsXdr: run.argsXdr, raw: run.raw },
      null,
      2,
    ) + "\n",
  );
  console.log(`${c.name}: ${run.report.status}${run.report.error ? ` (${run.report.error.summary})` : ""}`);
}
