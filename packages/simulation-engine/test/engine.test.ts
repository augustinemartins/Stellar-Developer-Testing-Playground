import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Account, rpc } from "@stellar/stellar-sdk";
import { NETWORKS, ScenarioSchema, parseScenarios, type Scenario } from "@playground/shared-types";
import { SAMPLE_CONTRACTS, SAMPLE_DEPLOYMENTS } from "@playground/contract-loader";
import {
  InvocationInputError,
  MAX_SHARE_BYTES,
  PLACEHOLDER_SOURCE,
  checkExpectations,
  compareWithRecorded,
  createScenario,
  decodeShareToken,
  encodeShareToken,
  expectationsFromReport,
  runScenario,
  scenarioToCurl,
  scenarioToJson,
  scenarioToMarkdown,
  scenarioToStellarCli,
  scenarioToVitest,
  simulateInvocation,
  toCliValue,
} from "../src";

const fixturesDir = join(__dirname, "../../result-parser/test/fixtures");
const fixture = (name: string) => JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), "utf8"));
const counter = SAMPLE_CONTRACTS.find((s) => s.slug === "counter")!;
const token = SAMPLE_CONTRACTS.find((s) => s.slug === "sample-token")!;
const { owner, holder } = SAMPLE_DEPLOYMENTS.accounts;

/** A fake RPC server that replays a recorded response. */
function replayServer(name: string, opts: { accountExists?: boolean } = {}) {
  const f = fixture(name);
  const server = {
    _simulateTransaction: vi.fn().mockResolvedValue(f.raw),
    getAccount: vi.fn(async (id: string) => {
      if (opts.accountExists) return new Account(id, "12345");
      throw new Error("Account not found");
    }),
  };
  return { server: server as unknown as rpc.Server, mock: server, fixture: f };
}

async function run(name: string, sample = counter, extra: { source?: string } = {}) {
  const { server, mock, fixture: f } = replayServer(name, { accountExists: !!extra.source });
  const result = await simulateInvocation({
    network: NETWORKS.testnet,
    contractId: f.contractId,
    method: f.method,
    args: f.args,
    spec: sample.spec,
    server,
    ...extra,
  });
  return { result, mock, f };
}

describe("simulateInvocation", () => {
  it("builds the same arguments as recorded and parses the response", async () => {
    const { result, mock, f } = await run("counter-increment-by");
    expect(result.argsXdr).toEqual(f.argsXdr);
    expect(result.source).toEqual({ address: PLACEHOLDER_SOURCE, kind: "placeholder" });
    expect(result.report.status).toBe("success");
    expect(result.report.resources?.txSizeBytes).toBeGreaterThan(100);
    expect(mock._simulateTransaction).toHaveBeenCalledWith(expect.anything(), undefined, "record");
    expect(mock.getAccount).not.toHaveBeenCalled();
  });

  it("uses the real sequence of an existing source account", async () => {
    const { result } = await run("counter-get", counter, { source: holder });
    expect(result.source).toMatchObject({ address: holder, exists: true, sequence: "12345" });
  });

  it("rejects invalid input before calling the RPC", async () => {
    const { server, mock } = replayServer("counter-get");
    const base = { network: NETWORKS.testnet, contractId: counter.contractId!, spec: counter.spec, server };
    await expect(simulateInvocation({ ...base, method: "nope", args: {} })).rejects.toBeInstanceOf(InvocationInputError);
    const bad = await simulateInvocation({ ...base, method: "increment_by", args: { step: -1 } }).catch((e) => e);
    expect(bad.errors[0]).toMatchObject({ path: "step" });
    const secret = await simulateInvocation({ ...base, method: "get", args: {}, source: "SBAD" }).catch((e) => e);
    expect(secret.message).toMatch(/secret key/);
    expect(mock._simulateTransaction).not.toHaveBeenCalled();
  });
});

describe("scenarios", () => {
  async function scenarioFrom(name: string, sample = counter) {
    const { result } = await run(name, sample);
    return createScenario(result, { name: `Test ${name}`, network: NETWORKS.testnet, spec: sample.spec, contractLabel: sample.title });
  }

  it("creates schema-valid scenarios with locked expectations", async () => {
    const s = await scenarioFrom("counter-increment-by");
    expect(ScenarioSchema.safeParse(s).success).toBe(true);
    expect(s.id).toMatch(/^test-counter-increment-by-[0-9a-f]{8}$/);
    expect(s.expect).toMatchObject({ status: "success", contractEventCount: 1, requiredAuth: [] });
    expect(BigInt(s.expect!.maxResourceFee!)).toBeGreaterThan(BigInt(s.recorded!.report.fees!.minResourceFee));
    // Survives a JSON round trip through the importer.
    const parsed = parseScenarios(JSON.parse(scenarioToJson(s)));
    expect(parsed.ok && parsed.value[0]).toEqual(JSON.parse(JSON.stringify(s)));
  });

  it("locks failure scenarios on the contract error code", async () => {
    const s = await scenarioFrom("counter-invalid-step");
    expect(s.expect).toEqual({ status: "error", contractErrorCode: 2 });
  });

  it("passes when replayed against the same response", async () => {
    const s = await scenarioFrom("counter-reset");
    const { server } = replayServer("counter-reset");
    const r = await runScenario(s, { server });
    expect(r.passed).toBe(true);
    expect(r.drift).toEqual([]);
    expect(r.assertions.map((a) => a.key)).toEqual([
      "status",
      "returnValue",
      "maxResourceFee",
      "maxInstructions",
      "contractEventCount",
      "requiredAuth",
    ]);
  });

  it("fails and reports drift when the outcome changes", async () => {
    const s = await scenarioFrom("counter-increment-by");
    const errorReport = (await run("counter-invalid-step")).result.report;
    const results = checkExpectations(errorReport, s.expect);
    expect(results.find((a) => a.key === "status")).toMatchObject({ passed: false, expected: "success", actual: "error" });
    expect(compareWithRecorded(s, errorReport).map((d) => d.label)).toContain("Status");
  });

  it("checks fee and instruction bounds", async () => {
    const report = (await run("counter-get")).result.report;
    const tight = { maxResourceFee: "1", maxInstructions: 1 };
    expect(checkExpectations(report, tight).every((a) => !a.passed)).toBe(true);
    expect(checkExpectations(report, expectationsFromReport(report)).every((a) => a.passed)).toBe(true);
  });
});

describe("exports", () => {
  let scenario: Scenario;
  it("prepares a scenario", async () => {
    const { result } = await run("token-transfer-with-memo", token);
    scenario = createScenario(result, { name: "Memo transfer", network: NETWORKS.testnet, spec: token.spec });
  });

  it("generates a runnable Vitest file", () => {
    const code = scenarioToVitest(scenario);
    expect(code).toContain(`const CONTRACT_ID = "${token.contractId}"`);
    expect(code).toContain(`function: "transfer_with_memo"`);
    for (const a of scenario.recorded!.argsXdr) expect(code).toContain(a);
    expect(code).toContain("toBeLessThanOrEqual(");
    expect(code).toContain("toHaveLength(2)");
    // The generated file must at least be syntactically valid TypeScript-as-JS.
    const body = code.replace(/^import .*$/gm, "");
    expect(() => new Function("describe", "it", "expect", "rpc", "xdr", "Account", "Operation", "TransactionBuilder", body)).not.toThrow();
  });

  it("generates error assertions for failure scenarios", async () => {
    const { result } = await run("counter-invalid-step");
    const s = createScenario(result, { name: "Invalid", network: NETWORKS.testnet, spec: counter.spec });
    expect(scenarioToVitest(s)).toContain("Error\\(Contract, #2\\)");
  });

  it("generates a stellar CLI command with CLI-style unions", () => {
    const cmd = scenarioToStellarCli(scenario);
    expect(cmd).toContain("--send=no");
    expect(cmd).toContain(`--from ${holder}`);
    expect(cmd).toContain(`--memo '{"Text":"thanks"}'`);
    expect(toCliValue({ tag: "Hash", values: ["00"] }, { kind: "udt", name: "Memo" }, token.spec)).toEqual({ Hash: "00" });
  });

  it("generates a curl request for the recorded transaction", () => {
    const cmd = scenarioToCurl(scenario);
    expect(cmd).toContain('"method":"simulateTransaction"');
    expect(cmd).toContain(scenario.recorded!.transactionXdr);
  });

  it("summarises as Markdown", () => {
    const md = scenarioToMarkdown(scenario);
    expect(md).toContain("### Memo transfer");
    expect(md).toContain("Contract events: 2");
    expect(md).not.toMatch(/\n\n\n/);
  });

  it("round-trips share tokens without the recorded run", async () => {
    const token = await encodeShareToken(scenario);
    expect(token).toMatch(/^s1\.[A-Za-z0-9_-]+$/);
    const decoded = await decodeShareToken(token);
    const parsed = parseScenarios(decoded);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value[0]!.recorded).toBeUndefined();
      expect(parsed.value[0]!.invocation).toEqual(scenario.invocation);
      expect(parsed.value[0]!.expect).toEqual(scenario.expect);
    }
  });

  it("rejects corrupted and oversized share tokens", async () => {
    await expect(decodeShareToken("x1.abc")).rejects.toThrow(/Unrecognised/);
    await expect(decodeShareToken("s1.AAAA")).rejects.toThrow(/corrupted/);
    const bomb = new TextEncoder().encode(" ".repeat(MAX_SHARE_BYTES + 10));
    const compressed = new Uint8Array(
      await new Response(new Blob([bomb]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer(),
    );
    const b64 = btoa(String.fromCharCode(...compressed)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await expect(decodeShareToken(`s1.${b64}`)).rejects.toThrow(/too large/);
  });
});

describe("owner fixture sanity", () => {
  it("uses deployed accounts", () => {
    expect(owner).toMatch(/^G/);
  });
});
