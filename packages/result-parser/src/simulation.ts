import { rpc, xdr } from "@stellar/stellar-sdk";
import type {
  ContractSpec,
  FunctionSpec,
  SimulationReport,
  StateChange,
} from "@playground/shared-types";
import { parseAuthEntry } from "./auth";
import { parseSimulationError } from "./errors";
import { parseEvent } from "./events";
import { describeLedgerKey } from "./ledger";
import { decodeScVal, scValToTypedJson } from "./scval";

export type RawSimulation = rpc.Api.RawSimulateTransactionResponse;

export interface ParseContext {
  spec?: ContractSpec;
  /** The invoked function, used to decode the return value with its declared type. */
  fn?: FunctionSpec;
  contractId?: string;
  /** Inclusion fee (stroops) used when the transaction was built. */
  inclusionFee?: string;
  txSizeBytes?: number;
}

function resourcesFrom(dataB64: string, txSizeBytes?: number): SimulationReport["resources"] {
  const data = xdr.SorobanTransactionData.fromXdr(dataB64, "base64");
  const r = data.resources;
  const readOnly = r.footprint.readOnly.map((k) => describeLedgerKey(k));
  const readWrite = r.footprint.readWrite.map((k) => describeLedgerKey(k));
  return {
    instructions: r.instructions,
    diskReadBytes: r.diskReadBytes,
    writeBytes: r.writeBytes,
    readOnlyEntries: readOnly.length,
    readWriteEntries: readWrite.length,
    txSizeBytes,
    footprint: { readOnly, readWrite },
  };
}

const CHANGE_TYPES: Record<string, StateChange["type"]> = {
  "0": "created",
  "1": "updated",
  "2": "deleted",
  "4": "restored",
  created: "created",
  updated: "updated",
  deleted: "deleted",
  restored: "restored",
};

function entryValue(b64: string | null) {
  if (!b64) return undefined;
  const entry = xdr.LedgerEntry.fromXdr(b64, "base64");
  return entry.data.type === "contractData" ? decodeScVal(entry.data.contractData.val) : undefined;
}

function stateChangesFrom(raw: RawSimulation): StateChange[] {
  return (raw.stateChanges ?? []).map((c) => ({
    type: CHANGE_TYPES[String(c.type)] ?? "updated",
    key: describeLedgerKey(c.key),
    before: entryValue(c.before),
    after: entryValue(c.after),
  }));
}

/**
 * Turns a raw `simulateTransaction` JSON-RPC result into a `SimulationReport`.
 *
 * Works from the raw (base64) response so it can be stored in scenarios and
 * re-parsed later, offline, with a newer version of the playground.
 */
export function parseSimulation(raw: RawSimulation, ctx: ParseContext = {}): SimulationReport {
  const events = (raw.events ?? []).map((e, i) => parseEvent(e, i, { spec: ctx.spec, contractId: ctx.contractId }));
  const inclusionFee = ctx.inclusionFee ?? "100";

  if (raw.error) {
    return {
      status: "error",
      latestLedger: raw.latestLedger,
      auth: [],
      events,
      stateChanges: [],
      error: parseSimulationError(raw.error, ctx.spec),
    };
  }

  const result = raw.results?.[0];
  const returnValue = result?.xdr ? decodeScVal(result.xdr) : undefined;
  const outType = ctx.fn?.outputs[0];
  const report: SimulationReport = {
    status: raw.restorePreamble ? "restore_required" : "success",
    latestLedger: raw.latestLedger,
    returnValue,
    returnValueTyped:
      returnValue && outType && ctx.spec
        ? scValToTypedJson(xdr.ScVal.fromXdr(returnValue.xdr, "base64"), outType, ctx.spec)
        : undefined,
    fees: raw.minResourceFee !== undefined ? { minResourceFee: raw.minResourceFee, inclusionFee } : undefined,
    resources: raw.transactionData ? resourcesFrom(raw.transactionData, ctx.txSizeBytes) : undefined,
    auth: (result?.auth ?? []).map((a) => parseAuthEntry(a)),
    events,
    stateChanges: stateChangesFrom(raw),
  };
  if (raw.restorePreamble) {
    const restoreData = xdr.SorobanTransactionData.fromXdr(raw.restorePreamble.transactionData, "base64");
    report.restore = {
      minResourceFee: raw.restorePreamble.minResourceFee,
      entries: restoreData.resources.footprint.readWrite.map((k) => describeLedgerKey(k)),
    };
  }
  return report;
}

/** Contract events only (no diagnostics), in emission order. */
export function contractEvents(report: SimulationReport) {
  return report.events.filter((e) => e.type === "contract");
}

/** Total fee estimate in stroops: inclusion fee + minimum resource fee. */
export function estimatedTotalFee(report: SimulationReport): bigint | undefined {
  if (!report.fees) return undefined;
  return BigInt(report.fees.inclusionFee) + BigInt(report.fees.minResourceFee);
}

export const STROOPS_PER_XLM = 10_000_000n;

export function formatStroops(stroops: string | bigint): string {
  const v = BigInt(stroops);
  const whole = v / STROOPS_PER_XLM;
  const frac = (v % STROOPS_PER_XLM).toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""} XLM`;
}
