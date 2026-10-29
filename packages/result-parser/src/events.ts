import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";
import type { ContractSpec, DecodedEvent, EventSpec, JsonValue } from "@playground/shared-types";
import { decodeScVal, scValToJson, scValToTypedJson } from "./scval";

function matchSpecEvent(spec: ContractSpec | undefined, topics: xdr.ScVal[]): EventSpec | undefined {
  if (!spec?.events.length) return undefined;
  const topicStrings = topics.map((t) => (t.type === "scvSymbol" ? t.sym.toString() : t.type === "scvString" ? t.str.toString() : null));
  return spec.events.find((ev) => {
    const topicParams = ev.params.filter((p) => p.location === "topic").length;
    if (topics.length !== ev.prefixTopics.length + topicParams) return false;
    return ev.prefixTopics.every((p, i) => topicStrings[i] === p);
  });
}

function decodeParams(ev: EventSpec, topics: xdr.ScVal[], data: xdr.ScVal, spec: ContractSpec): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  const topicParams = ev.params.filter((p) => p.location === "topic");
  topicParams.forEach((p, i) => {
    const t = topics[ev.prefixTopics.length + i];
    if (t) out[p.name] = scValToTypedJson(t, p.type, spec);
  });
  const dataParams = ev.params.filter((p) => p.location === "data");
  if (ev.dataFormat === "single" && dataParams[0]) {
    out[dataParams[0].name] = scValToTypedJson(data, dataParams[0].type, spec);
  } else if (ev.dataFormat === "vec" && data.type === "scvVec") {
    dataParams.forEach((p, i) => {
      const d = data.vec?.[i];
      if (d) out[p.name] = scValToTypedJson(d, p.type, spec);
    });
  } else if (ev.dataFormat === "map" && data.type === "scvMap") {
    for (const entry of data.map ?? []) {
      const name = String(scValToJson(entry.key));
      const p = dataParams.find((x) => x.name === name);
      out[name] = p ? scValToTypedJson(entry.val, p.type, spec) : scValToJson(entry.val);
    }
  }
  return out;
}

const DIAGNOSTIC_MARKERS = new Set(["fn_call", "fn_return", "error", "log", "core_metrics"]);

/** Decodes a `DiagnosticEvent` (base64 or XDR). Events from other contracts are decoded without a spec. */
export function parseEvent(
  input: xdr.DiagnosticEvent | string,
  index: number,
  ctx: { spec?: ContractSpec; contractId?: string } = {},
): DecodedEvent {
  const diag = typeof input === "string" ? xdr.DiagnosticEvent.fromXdr(input, "base64") : input;
  const ev = diag.event;
  const body = ev.body.v0;
  const contractId = ev.contractId ? Address.contract(ev.contractId.toXdr()).toString() : undefined;
  const type = ev.type.name as DecodedEvent["type"];
  const topics = body.topics;
  const decoded: DecodedEvent = {
    index,
    type,
    contractId,
    inSuccessfulContractCall: diag.inSuccessfulContractCall,
    topics: topics.map((t) => decodeScVal(t)),
    data: decodeScVal(body.data),
    xdr: diag.toXdr("base64"),
  };
  const first = topics[0];
  if (type === "diagnostic" && first?.type === "scvSymbol" && DIAGNOSTIC_MARKERS.has(first.sym.toString())) {
    decoded.name = first.sym.toString();
    // fn_call topics are [fn_call, contract id bytes, function name]; show the strkey.
    const target = topics[1];
    if (decoded.name === "fn_call" && target?.type === "scvBytes") {
      const bytes = scValToNative(target) as Uint8Array;
      if (bytes.length === 32) {
        decoded.params = { contract: Address.contract(bytes).toString(), function: decoded.topics[2]?.json ?? null };
      }
    }
    return decoded;
  }
  const sameContract = !ctx.contractId || ctx.contractId === contractId;
  const match = sameContract ? matchSpecEvent(ctx.spec, topics) : undefined;
  if (match && ctx.spec) {
    decoded.name = match.name;
    decoded.params = decodeParams(match, topics, body.data, ctx.spec);
  } else if (first?.type === "scvSymbol") {
    decoded.name = first.sym.toString();
  }
  return decoded;
}
