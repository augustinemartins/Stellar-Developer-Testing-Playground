/**
 * Replays scenario files against the network and checks their expectations.
 * Exits non-zero if any scenario fails, so it can gate CI.
 *
 *   pnpm scenarios:run examples/scenarios/*.json
 *   pnpm scenarios:run my-scenarios.json --json   # machine-readable output
 */
import { readFileSync } from "node:fs";
import { parseScenarioJson, type Scenario } from "../packages/shared-types/src";
import { runScenario } from "../packages/simulation-engine/src";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length) {
  console.error("usage: pnpm scenarios:run <scenario.json>... [--json]");
  process.exit(2);
}

const scenarios: { file: string; scenario: Scenario }[] = [];
let invalid = 0;
for (const file of files) {
  const parsed = parseScenarioJson(readFileSync(file, "utf8"));
  if (!parsed.ok) {
    invalid++;
    console.error(`✗ ${file}: invalid scenario file\n  ${parsed.errors.join("\n  ")}`);
    continue;
  }
  for (const scenario of parsed.value) scenarios.push({ file, scenario });
}

const results = [];
for (const { file, scenario } of scenarios) {
  try {
    const r = await runScenario(scenario);
    results.push({ file, id: scenario.id, name: scenario.name, passed: r.passed, assertions: r.assertions, drift: r.drift });
    if (!asJson) {
      console.log(`${r.passed ? "✓" : "✗"} ${scenario.name}  (${file}, ledger ${r.run.report.latestLedger}, ${r.run.durationMs} ms)`);
      for (const a of r.assertions.filter((x) => !x.passed)) {
        console.log(`    ${a.label}: expected ${a.expected}, got ${a.actual}`);
      }
    }
  } catch (e) {
    results.push({ file, id: scenario.id, name: scenario.name, passed: false, error: (e as Error).message });
    if (!asJson) console.log(`✗ ${scenario.name}  (${file})\n    ${(e as Error).message}`);
  }
}

const failed = results.filter((r) => !r.passed).length + invalid;
if (asJson) console.log(JSON.stringify({ passed: results.length - failed + invalid, failed, results }, null, 2));
else console.log(`\n${results.length - (failed - invalid)} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
