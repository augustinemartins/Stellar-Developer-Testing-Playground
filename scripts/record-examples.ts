/**
 * Records the example scenarios in examples/scenarios from live testnet runs.
 * Re-run after `pnpm contracts:deploy`: `pnpm tsx scripts/record-examples.ts`.
 */
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NETWORKS } from "../packages/shared-types/src";
import { SAMPLE_CONTRACTS } from "../packages/contract-loader/src";
import { createScenario, scenarioToJson, simulateInvocation } from "../packages/simulation-engine/src";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const picks: { sample: string; call: string; file: string; tags: string[] }[] = [
  { sample: "counter", call: "Read the count", file: "counter-get", tags: ["counter", "read-only"] },
  { sample: "counter", call: "Trigger InvalidStep", file: "counter-invalid-step", tags: ["counter", "errors"] },
  { sample: "counter", call: "Reset as owner", file: "counter-reset-auth", tags: ["counter", "auth"] },
  { sample: "sample-token", call: "Token metadata", file: "token-metadata", tags: ["token", "structs"] },
  { sample: "sample-token", call: "Transfer with memo", file: "token-transfer-with-memo", tags: ["token", "unions", "events"] },
  { sample: "sample-token", call: "Overdraft", file: "token-overdraft", tags: ["token", "errors"] },
  { sample: "native-xlm", call: "Decimals", file: "xlm-decimals", tags: ["sac", "read-only"] },
];

for (const p of picks) {
  const sample = SAMPLE_CONTRACTS.find((s) => s.slug === p.sample)!;
  const call = sample.suggestedCalls.find((c) => c.title === p.call)!;
  const run = await simulateInvocation({
    network: NETWORKS.testnet,
    contractId: sample.contractId!,
    method: call.method,
    args: call.args,
    spec: sample.spec,
  });
  const scenario = createScenario(run, {
    name: `${sample.title}: ${call.title}`,
    description: call.description,
    tags: p.tags,
    network: NETWORKS.testnet,
    spec: sample.spec,
    contractLabel: sample.title,
    wasmHash: sample.wasmHash ?? undefined,
  });
  // Stable IDs keep diffs small when examples are re-recorded.
  scenario.id = p.file;
  writeFileSync(join(root, "examples/scenarios", `${p.file}.json`), scenarioToJson(scenario));
  console.log(`${p.file}: ${run.report.status}`);
}
