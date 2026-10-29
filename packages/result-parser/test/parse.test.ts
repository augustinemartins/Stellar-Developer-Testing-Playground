import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Address, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { SimulationReportSchema, type ContractSpec } from "@playground/shared-types";
import { SAMPLE_CONTRACTS } from "@playground/contract-loader";
import {
  contractEvents,
  decodeScVal,
  estimatedTotalFee,
  formatStroops,
  parseSimulation,
  parseSimulationError,
  requiredSigners,
  scValToJson,
  scValToTree,
  scValToTypedJson,
  type RawSimulation,
} from "../src";

interface Fixture {
  contractId: string;
  sample: string;
  method: string;
  raw: RawSimulation;
}

const dir = join(__dirname, "fixtures");
const fixtures = Object.fromEntries(
  readdirSync(dir).map((f) => [f.replace(/\.json$/, ""), JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture]),
);

function parse(name: string) {
  const f = fixtures[name]!;
  const spec = SAMPLE_CONTRACTS.find((s) => s.slug === f.sample)!.spec;
  return parseSimulation(f.raw, { spec, fn: spec.functions.find((x) => x.name === f.method), contractId: f.contractId });
}

describe("parseSimulation on recorded testnet responses", () => {
  it.each(Object.keys(fixtures))("%s produces a schema-valid, JSON-serialisable report", (name) => {
    const report = parse(name);
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it("decodes a read-only call", () => {
    const r = parse("counter-get");
    expect(r.status).toBe("success");
    expect(r.returnValue?.type).toBe("u32");
    expect(typeof r.returnValue?.json).toBe("number");
    expect(r.auth).toEqual([]);
    expect(contractEvents(r)).toHaveLength(0);
    expect(r.resources?.readWriteEntries).toBe(0);
    expect(Number(r.fees?.minResourceFee)).toBeGreaterThan(0);
  });

  it("decodes a state-changing call with an event and a write footprint", () => {
    const r = parse("counter-increment-by");
    const [ev] = contractEvents(r);
    expect(ev?.name).toBe("Incremented");
    expect(ev?.params).toMatchObject({ step: 5 });
    expect(r.resources?.footprint.readWrite.some((k) => k.label.startsWith("instance"))).toBe(true);
  });

  it("maps contract errors to the spec's error enum", () => {
    const r = parse("counter-invalid-step");
    expect(r.status).toBe("error");
    expect(r.error).toMatchObject({
      kind: "contract",
      contractErrorCode: 2,
      contractErrorName: "CounterError::InvalidStep",
    });
    expect(r.error?.hint).toMatch(/step/i);
    // Diagnostic events survive failed simulations, which is how the playground explains them.
    expect(r.events.some((e) => e.name === "fn_call")).toBe(true);
    const call = r.events.find((e) => e.name === "fn_call");
    expect(call?.params?.contract).toBe(fixtures["counter-invalid-step"]!.contractId);
  });

  it("decodes authorization requirements", () => {
    const r = parse("counter-reset");
    expect(r.auth).toHaveLength(1);
    expect(r.auth[0]).toMatchObject({ credentials: "address", invocation: { kind: "contract_fn", functionName: "reset" } });
    expect(requiredSigners(r.auth)).toEqual([r.auth[0]!.address]);
  });

  it("decodes struct returns with the declared type", () => {
    const r = parse("counter-stats");
    expect(r.returnValueTyped).toMatchObject({ max_step: 100, owner: expect.stringMatching(/^G/) });
  });

  it("decodes union arguments in events with the spec", () => {
    const r = parse("token-transfer-with-memo");
    const names = contractEvents(r).map((e) => e.name);
    expect(names).toEqual(["Transfer", "MemoAttached"]);
    expect(contractEvents(r)[1]?.params?.memo).toEqual({ tag: "Text", values: ["thanks"] });
    expect(r.auth[0]?.invocation.args.map((a) => a.type)).toEqual(["address", "address", "i128", "vec"]);
    expect(r.stateChanges.length).toBeGreaterThan(0);
  });

  it("decodes SAC calls", () => {
    const r = parse("xlm-balance");
    expect(r.returnValue?.type).toBe("i128");
    expect(BigInt(r.returnValue!.json as string)).toBeGreaterThan(0n);
  });
});

describe("parseSimulationError", () => {
  const spec = SAMPLE_CONTRACTS[0]!.spec;
  it.each([
    ["HostError: Error(Budget, ExceededLimit)", "host", /CPU/],
    ["HostError: Error(Auth, InvalidAction)", "host", /record/],
    ["HostError: Error(Storage, MissingValue)", "host", /does not exist/],
    ["HostError: Error(WasmVm, InvalidAction)", "host", /panicked/],
    ["HostError: Error(WasmVm, MissingValue)", "host", /function does not exist/],
  ])("classifies %s", (raw, kind, hint) => {
    const e = parseSimulationError(raw, spec);
    expect(e.kind).toBe(kind);
    expect(e.hint).toMatch(hint);
  });

  it("handles unknown contract codes", () => {
    expect(parseSimulationError("Error(Contract, #99)", spec)).toMatchObject({ kind: "contract", contractErrorCode: 99, summary: "Contract error #99" });
  });

  it("falls back to the first line for RPC errors", () => {
    expect(parseSimulationError("\n  bad request\nmore", spec)).toMatchObject({ kind: "rpc", summary: "bad request" });
  });
});

describe("ScVal decoding", () => {
  const g = Keypair.random().publicKey();
  it("renders JSON with argument conventions", () => {
    expect(scValToJson(nativeToScVal(5n, { type: "i128" }))).toBe("5");
    expect(scValToJson(nativeToScVal(-(2n ** 200n), { type: "i256" }))).toBe((-(2n ** 200n)).toString());
    expect(scValToJson(xdr.ScVal.scvBytes(new Uint8Array([1, 255])))).toBe("01ff");
    expect(scValToJson(new Address(g).toScVal())).toBe(g);
    expect(scValToJson(xdr.ScVal.scvVec([xdr.ScVal.scvU32(1), xdr.ScVal.scvVoid()]))).toEqual([1, null]);
    expect(scValToJson(xdr.ScVal.scvError(xdr.ScError.sceContract(3)))).toEqual({ error: { type: "Contract", code: 3 } });
    const nonStringKeys = xdr.ScVal.scvMap([new xdr.ScMapEntry({ key: xdr.ScVal.scvU32(1), val: xdr.ScVal.scvBool(true) })]);
    expect(scValToJson(nonStringKeys)).toEqual([[1, true]]);
  });

  it("round-trips through base64", () => {
    const v = xdr.ScVal.scvSymbol("hello");
    const d = decodeScVal(v.toXdr("base64"));
    expect(d).toEqual({ xdr: v.toXdr("base64"), type: "symbol", json: "hello" });
  });

  it("decodes typed unions, enums and options", () => {
    const spec: ContractSpec = {
      functions: [],
      events: [],
      types: [
        { kind: "union", name: "U", cases: [{ kind: "void", name: "None" }, { kind: "tuple", name: "Some", types: [{ kind: "u32" }] }] },
        { kind: "enum", name: "Color", cases: [{ name: "Red", value: 0 }, { name: "Blue", value: 1 }] },
      ],
    };
    const some = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Some"), xdr.ScVal.scvU32(4)]);
    expect(scValToTypedJson(some, { kind: "udt", name: "U" }, spec)).toEqual({ tag: "Some", values: [4] });
    expect(scValToTypedJson(xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("None")]), { kind: "udt", name: "U" }, spec)).toBe("None");
    expect(scValToTypedJson(xdr.ScVal.scvU32(1), { kind: "udt", name: "Color" }, spec)).toBe("Blue");
    expect(scValToTypedJson(xdr.ScVal.scvVoid(), { kind: "option", value: { kind: "u32" } }, spec)).toBeNull();
    // Mismatched shapes fall back to the untyped rendering instead of throwing.
    expect(scValToTypedJson(xdr.ScVal.scvU32(9), { kind: "udt", name: "U" }, spec)).toBe(9);
  });

  it("builds trees for nested values", () => {
    const v = xdr.ScVal.scvVec([xdr.ScVal.scvU32(1)]);
    expect(scValToTree(v)).toEqual({ kind: "vec", type: "vec", items: [{ kind: "scalar", type: "u32", value: 1 }] });
  });
});

describe("fee helpers", () => {
  it("formats stroops", () => {
    expect(formatStroops("10000000")).toBe("1 XLM");
    expect(formatStroops(1234567n)).toBe("0.1234567 XLM");
    expect(formatStroops("0")).toBe("0 XLM");
  });
  it("sums inclusion and resource fees", () => {
    const r = parse("counter-get");
    expect(estimatedTotalFee(r)).toBe(BigInt(r.fees!.minResourceFee) + 100n);
  });
});
