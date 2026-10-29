/**
 * End-to-end checks against Stellar testnet. Skipped unless
 * STELLAR_PLAYGROUND_TESTNET=1 (see `pnpm test:testnet`), because they depend
 * on network availability and on the sample deployments still existing.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NETWORKS, parseScenarioJson } from "@playground/shared-types";
import { SAMPLE_CONTRACTS, loadContractFromNetwork } from "@playground/contract-loader";
import {
  checkNetwork,
  fetchNetworkLimits,
  getServer,
  runScenario,
  scenarioToVitest,
  simulateInvocation,
} from "@playground/simulation-engine";

const enabled = process.env.STELLAR_PLAYGROUND_TESTNET === "1";
const root = join(__dirname, "..");

describe.skipIf(!enabled)("testnet", () => {
  it("reaches the RPC and reads live limits", async () => {
    const health = await checkNetwork(NETWORKS.testnet);
    expect(health.ok).toBe(true);
    const limits = await fetchNetworkLimits(getServer(NETWORKS.testnet));
    expect(limits.source).toBe("live");
    expect(limits.txMaxInstructions).toBeGreaterThan(1_000_000);
  });

  it.each(SAMPLE_CONTRACTS.map((s) => [s.slug, s] as const))("loads the %s sample spec from the network", async (_slug, sample) => {
    const loaded = await loadContractFromNetwork(sample.contractId!, NETWORKS.testnet);
    expect(loaded.spec.functions.map((f) => f.name).sort()).toEqual(sample.spec.functions.map((f) => f.name).sort());
  });

  it("runs every suggested call without input errors", async () => {
    for (const sample of SAMPLE_CONTRACTS) {
      for (const call of sample.suggestedCalls) {
        const run = await simulateInvocation({
          network: NETWORKS.testnet,
          contractId: sample.contractId!,
          method: call.method,
          args: call.args,
          spec: sample.spec,
        });
        expect(run.report.error?.kind, `${sample.slug}: ${call.title}`).not.toBe("rpc");
      }
    }
  });

  it("replays the example scenarios", async () => {
    const dir = join(root, "examples/scenarios");
    for (const file of readdirSync(dir)) {
      const parsed = parseScenarioJson(readFileSync(join(dir, file), "utf8"));
      expect(parsed.ok, file).toBe(true);
      if (!parsed.ok) continue;
      const result = await runScenario(parsed.value[0]!);
      expect(result.assertions.filter((a) => !a.passed), file).toEqual([]);
    }
  });

  it("exports a Vitest file that passes on its own", () => {
    const parsed = parseScenarioJson(readFileSync(join(root, "examples/scenarios/token-transfer-with-memo.json"), "utf8"));
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    const dir = join(root, "packages/simulation-engine/.generated");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "exported.test.ts"), scenarioToVitest(parsed.value[0]!));
    writeFileSync(join(dir, "vitest.config.mjs"), "export default { test: { include: ['exported.test.ts'] } };\n");
    try {
      // Run inside a package that depends on @stellar/stellar-sdk so the import resolves.
      execFileSync("npx", ["vitest", "run", "--config", join(dir, "vitest.config.mjs")], { cwd: dir, stdio: "pipe" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
