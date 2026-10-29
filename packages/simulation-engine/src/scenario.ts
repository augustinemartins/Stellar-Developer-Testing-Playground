import type { rpc } from "@stellar/stellar-sdk";
import {
  SCENARIO_SCHEMA_ID,
  SCENARIO_VERSION,
  canonicalJson,
  jsonEqual,
  type ContractSpec,
  type NetworkConfig,
  type Scenario,
  type ScenarioExpectations,
  type SimulationReport,
} from "@playground/shared-types";
import { loadContractFromNetwork } from "@playground/contract-loader";
import { contractEvents, requiredSigners } from "@playground/result-parser";
import { simulateInvocation, type SimulationRun } from "./simulate";

export const PLAYGROUND_VERSION = "stellar-dev-playground@0.1.0";

export interface AssertionResult {
  key: keyof ScenarioExpectations;
  label: string;
  expected: string;
  actual: string;
  passed: boolean;
}

function show(value: unknown): string {
  return value === undefined ? "(none)" : typeof value === "string" ? value : canonicalJson(value);
}

/** Compares a simulation report against a scenario's expectations. */
export function checkExpectations(report: SimulationReport, expect: ScenarioExpectations | undefined): AssertionResult[] {
  if (!expect) return [];
  const out: AssertionResult[] = [];
  const push = (key: keyof ScenarioExpectations, label: string, expected: unknown, actual: unknown, passed: boolean) =>
    out.push({ key, label, expected: show(expected), actual: show(actual), passed });

  if (expect.status !== undefined) push("status", "Status", expect.status, report.status, report.status === expect.status);
  if (expect.returnValue !== undefined) {
    const actual = report.returnValue?.json;
    push("returnValue", "Return value", expect.returnValue, actual, jsonEqual(actual, expect.returnValue));
  }
  if (expect.contractErrorCode !== undefined) {
    const actual = report.error?.contractErrorCode;
    push("contractErrorCode", "Contract error code", expect.contractErrorCode, actual, actual === expect.contractErrorCode);
  }
  if (expect.maxResourceFee !== undefined) {
    const actual = report.fees?.minResourceFee;
    push(
      "maxResourceFee",
      "Resource fee ≤",
      `${expect.maxResourceFee} stroops`,
      actual === undefined ? undefined : `${actual} stroops`,
      actual !== undefined && BigInt(actual) <= BigInt(expect.maxResourceFee),
    );
  }
  if (expect.maxInstructions !== undefined) {
    const actual = report.resources?.instructions;
    push("maxInstructions", "CPU instructions ≤", expect.maxInstructions, actual, actual !== undefined && actual <= expect.maxInstructions);
  }
  if (expect.contractEventCount !== undefined) {
    const actual = contractEvents(report).length;
    push("contractEventCount", "Contract events", expect.contractEventCount, actual, actual === expect.contractEventCount);
  }
  if (expect.requiredAuth !== undefined) {
    const actual = requiredSigners(report.auth).sort();
    const expected = [...expect.requiredAuth].sort();
    push("requiredAuth", "Required signers", expected, actual, jsonEqual(actual, expected));
  }
  return out;
}

/**
 * Derives expectations from a run so it can be locked in as a regression test.
 * Fee and instruction bounds get headroom because they depend on ledger state.
 */
export function expectationsFromReport(report: SimulationReport, headroom = 1.25): ScenarioExpectations {
  const expect: ScenarioExpectations = { status: report.status };
  if (report.status !== "error" && report.returnValue) expect.returnValue = report.returnValue.json;
  if (report.error?.contractErrorCode !== undefined) expect.contractErrorCode = report.error.contractErrorCode;
  if (report.fees) {
    const scaled = (BigInt(report.fees.minResourceFee) * BigInt(Math.round(headroom * 100)) + 99n) / 100n;
    expect.maxResourceFee = scaled.toString();
  }
  if (report.resources) expect.maxInstructions = Math.ceil(report.resources.instructions * headroom);
  if (report.status !== "error") {
    expect.contractEventCount = contractEvents(report).length;
    expect.requiredAuth = requiredSigners(report.auth);
  }
  return expect;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "scenario"
  );
}

function randomSuffix(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CreateScenarioOptions {
  name: string;
  description?: string;
  tags?: string[];
  network: NetworkConfig;
  spec: ContractSpec;
  contractLabel?: string;
  wasmHash?: string;
  /** Lock the run's outcome as expectations (default true). */
  lockExpectations?: boolean;
}

/** Captures a simulation run as a reproducible, shareable scenario. */
export function createScenario(run: SimulationRun, opts: CreateScenarioOptions): Scenario {
  const now = new Date().toISOString();
  return {
    schema: SCENARIO_SCHEMA_ID,
    version: SCENARIO_VERSION,
    id: `${slugify(opts.name)}-${randomSuffix()}`,
    name: opts.name,
    description: opts.description,
    tags: opts.tags,
    createdAt: now,
    updatedAt: now,
    network: {
      id: opts.network.id,
      rpcUrl: opts.network.rpcUrl,
      networkPassphrase: opts.network.networkPassphrase,
      ...(opts.network.friendbotUrl ? { friendbotUrl: opts.network.friendbotUrl } : {}),
    },
    contract: { id: run.contractId, label: opts.contractLabel, spec: opts.spec, wasmHash: opts.wasmHash },
    invocation: {
      method: run.method,
      args: run.args,
      source: run.source.kind === "provided" ? run.source.address : undefined,
      authMode: run.authMode,
    },
    expect: opts.lockExpectations === false ? undefined : expectationsFromReport(run.report),
    recorded: {
      at: run.startedAt,
      latestLedger: run.report.latestLedger,
      argsXdr: run.argsXdr,
      transactionXdr: run.transactionXdr,
      report: run.report,
    },
    createdWith: PLAYGROUND_VERSION,
  };
}

export interface Drift {
  label: string;
  recorded: string;
  current: string;
}

/** Differences between the recorded run and a replay, independent of expectations. */
export function compareWithRecorded(scenario: Scenario, report: SimulationReport): Drift[] {
  const rec = scenario.recorded?.report;
  if (!rec) return [];
  const drift: Drift[] = [];
  if (rec.status !== report.status) drift.push({ label: "Status", recorded: rec.status, current: report.status });
  if (rec.returnValue?.xdr !== report.returnValue?.xdr) {
    drift.push({ label: "Return value", recorded: show(rec.returnValue?.json), current: show(report.returnValue?.json) });
  }
  if (rec.fees?.minResourceFee !== report.fees?.minResourceFee) {
    drift.push({ label: "Resource fee", recorded: show(rec.fees?.minResourceFee), current: show(report.fees?.minResourceFee) });
  }
  if (rec.resources?.instructions !== report.resources?.instructions) {
    drift.push({ label: "Instructions", recorded: show(rec.resources?.instructions), current: show(report.resources?.instructions) });
  }
  const recEvents = contractEvents(rec).length;
  const curEvents = contractEvents(report).length;
  if (recEvents !== curEvents) drift.push({ label: "Contract events", recorded: String(recEvents), current: String(curEvents) });
  return drift;
}

export interface ScenarioRunResult {
  scenario: Scenario;
  run: SimulationRun;
  assertions: AssertionResult[];
  drift: Drift[];
  passed: boolean;
}

/** Replays a scenario against the network and checks its expectations. */
export async function runScenario(scenario: Scenario, opts: { server?: rpc.Server } = {}): Promise<ScenarioRunResult> {
  const spec =
    scenario.contract.spec ?? (await loadContractFromNetwork(scenario.contract.id, scenario.network, { server: opts.server })).spec;
  const run = await simulateInvocation({
    network: scenario.network,
    contractId: scenario.contract.id,
    method: scenario.invocation.method,
    args: scenario.invocation.args,
    spec,
    source: scenario.invocation.source,
    authMode: scenario.invocation.authMode,
    server: opts.server,
  });
  const assertions = checkExpectations(run.report, scenario.expect);
  return {
    scenario,
    run,
    assertions,
    drift: compareWithRecorded(scenario, run.report),
    passed: assertions.every((a) => a.passed),
  };
}
