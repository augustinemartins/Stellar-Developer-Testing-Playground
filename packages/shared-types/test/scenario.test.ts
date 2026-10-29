import { describe, expect, it } from "vitest";
import { NETWORKS, canonicalJson, formatSignature, formatType, jsonEqual, parseScenarioJson, parseScenarios, type Scenario } from "../src";

const base: Scenario = {
  schema: "stellar-playground/scenario",
  version: 1,
  id: "counter-get-1",
  name: "Counter get",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  network: NETWORKS.testnet,
  contract: { id: "CCXDNSDDFAEBDFNKTCWHVPGDSED37GMTFWDEY6Q4DMXBQ3BUHY3UMTJW" },
  invocation: { method: "get", args: {}, authMode: "record" },
};

describe("scenario schema", () => {
  it("accepts a minimal scenario and defaults authMode", () => {
    const { authMode: _omit, ...invocation } = base.invocation;
    const r = parseScenarios({ ...base, invocation });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]!.invocation.authMode).toBe("record");
  });

  it("accepts arrays and collections", () => {
    expect(parseScenarios([base, base]).ok).toBe(true);
    const collection = {
      schema: "stellar-playground/scenario-collection",
      version: 1,
      exportedAt: "2026-10-01T00:00:00.000Z",
      scenarios: [base],
    };
    const r = parseScenarios(collection);
    expect(r.ok && r.value.length).toBe(1);
  });

  it("reports precise paths for invalid fields", () => {
    const r = parseScenarios({ ...base, contract: { id: "GABC" }, version: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join("\n")).toMatch(/version/);
      expect(r.errors.join("\n")).toMatch(/contract\.id: must be a contract address/);
    }
  });

  it("rejects unknown expectation keys (typos should not silently pass)", () => {
    const r = parseScenarios({ ...base, expect: { stauts: "success" } });
    expect(r.ok).toBe(false);
  });

  it("rejects malformed JSON with a readable message", () => {
    const r = parseScenarioJson("{ nope");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/^Invalid JSON/);
  });

  it("indexes errors inside arrays", () => {
    const r = parseScenarios([base, { ...base, name: "" }]);
    expect(!r.ok && r.errors[0]).toMatch(/^\[1\] name/);
  });
});

describe("json helpers", () => {
  it("compares structurally, ignoring key order", () => {
    expect(jsonEqual({ a: 1, b: [1, { c: null }] }, { b: [1, { c: null }], a: 1 })).toBe(true);
    expect(jsonEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(jsonEqual([1, 2], [2, 1])).toBe(false);
    expect(jsonEqual("1", 1)).toBe(false);
    expect(jsonEqual(null, undefined)).toBe(false);
  });

  it("produces canonical JSON", () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}');
  });
});

describe("type formatting", () => {
  it("renders Rust-like type names", () => {
    expect(formatType({ kind: "option", value: { kind: "vec", element: { kind: "address" } } })).toBe("Option<Vec<Address>>");
    expect(formatType({ kind: "map", key: { kind: "symbol" }, value: { kind: "i128" } })).toBe("Map<Symbol, i128>");
    expect(formatType({ kind: "tuple", elements: [{ kind: "u32" }, { kind: "bytes_n", n: 32 }] })).toBe("(u32, BytesN<32>)");
    expect(formatType({ kind: "result", ok: { kind: "void" }, error: { kind: "udt", name: "Err" } })).toBe("Result<(), Err>");
  });

  it("renders signatures", () => {
    expect(
      formatSignature({
        name: "transfer",
        inputs: [
          { name: "from", type: { kind: "address" } },
          { name: "amount", type: { kind: "i128" } },
        ],
        outputs: [],
      }),
    ).toBe("transfer(from: Address, amount: i128) -> ()");
  });
});
