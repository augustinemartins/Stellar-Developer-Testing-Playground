import { describe, expect, it } from "vitest";
import { Keypair, StrKey, xdr } from "@stellar/stellar-sdk";
import type { ContractSpec, FunctionSpec, TypeDef } from "@playground/shared-types";
import { SAMPLE_CONTRACTS } from "@playground/contract-loader";
import { scValToJson, scValToTypedJson } from "@playground/result-parser";
import { encodeArgs, encodeValue, validateArgs } from "../src";

const tokenSpec = SAMPLE_CONTRACTS.find((s) => s.slug === "sample-token")!.spec;
const fn = (name: string) => tokenSpec.functions.find((f) => f.name === name)!;
const G = Keypair.random().publicKey();
const C = StrKey.encodeContract(new Uint8Array(32).fill(1));

const spec: ContractSpec = {
  functions: [],
  events: [],
  types: [
    {
      kind: "struct",
      name: "Point",
      fields: [
        { name: "y", type: { kind: "i32" } },
        { name: "x", type: { kind: "i32" } },
      ],
    },
    {
      kind: "struct",
      name: "Pair",
      fields: [
        { name: "0", type: { kind: "u32" } },
        { name: "1", type: { kind: "bool" } },
      ],
    },
    {
      kind: "enum",
      name: "Color",
      cases: [
        { name: "Red", value: 0 },
        { name: "Green", value: 1 },
      ],
    },
    {
      kind: "union",
      name: "Shape",
      cases: [
        { kind: "void", name: "Empty" },
        { kind: "tuple", name: "Circle", types: [{ kind: "u32" }] },
        { kind: "tuple", name: "Rect", types: [{ kind: "u32" }, { kind: "u32" }] },
      ],
    },
  ],
};

function ok(type: TypeDef, value: unknown) {
  const r = encodeValue(type, value, spec);
  if (!r.ok) throw new Error(`${r.error.path}: ${r.error.message}`);
  return r.value;
}

function err(type: TypeDef, value: unknown) {
  const r = encodeValue(type, value, spec);
  if (r.ok) throw new Error("expected an error");
  return r.error;
}

describe("primitive encoding", () => {
  it("encodes integers with range checks", () => {
    expect(ok({ kind: "u32" }, 7).type).toBe("scvU32");
    expect(ok({ kind: "u32" }, "4294967295").type).toBe("scvU32");
    expect(err({ kind: "u32" }, 4294967296).message).toMatch(/out of range for u32/);
    expect(err({ kind: "u32" }, -1).message).toMatch(/out of range/);
    expect(err({ kind: "i32" }, 1.5).message).toMatch(/must be an integer/);
    expect(err({ kind: "u64" }, 2 ** 60).message).toMatch(/safe integer range; pass it as a string/);
    expect(scValToJson(ok({ kind: "i128" }, "-170141183460469231731687303715884105728"))).toBe("-170141183460469231731687303715884105728");
    expect(err({ kind: "i128" }, "170141183460469231731687303715884105728").message).toMatch(/out of range for i128/);
    expect(scValToJson(ok({ kind: "u256" }, (2n ** 256n - 1n).toString()))).toBe((2n ** 256n - 1n).toString());
    expect(scValToJson(ok({ kind: "u64" }, "0xff"))).toBe("255");
    expect(err({ kind: "i64" }, "12abc").message).toMatch(/expects an integer/);
    expect(ok({ kind: "timepoint" }, "1700000000").type).toBe("scvTimepoint");
    expect(ok({ kind: "duration" }, 60).type).toBe("scvDuration");
  });

  it("encodes booleans strictly", () => {
    expect(ok({ kind: "bool" }, true).type).toBe("scvBool");
    expect(err({ kind: "bool" }, "true").message).toMatch(/true or false/);
  });

  it("encodes bytes and BytesN", () => {
    expect(scValToJson(ok({ kind: "bytes" }, "0xDEADbeef"))).toBe("deadbeef");
    expect(err({ kind: "bytes" }, "abc").message).toMatch(/even-length hex/);
    expect(ok({ kind: "bytes_n", n: 4 }, "00112233").type).toBe("scvBytes");
    expect(err({ kind: "bytes_n", n: 32 }, "00").message).toMatch(/exactly 32 bytes/);
  });

  it("validates symbols", () => {
    expect(ok({ kind: "symbol" }, "hello_World9").type).toBe("scvSymbol");
    expect(err({ kind: "symbol" }, "has space").message).toMatch(/may only contain/);
    expect(err({ kind: "symbol" }, "a".repeat(33)).message).toMatch(/at most 32/);
  });

  it("validates addresses and warns about secret keys", () => {
    expect(scValToJson(ok({ kind: "address" }, ` ${G} `))).toBe(G);
    expect(scValToJson(ok({ kind: "address" }, C))).toBe(C);
    expect(err({ kind: "address" }, "").message).toMatch(/required/);
    expect(err({ kind: "address" }, Keypair.random().secret()).message).toMatch(/secret key/);
    expect(err({ kind: "address" }, "GABC").message).toMatch(/not a valid/);
  });

  it("requires explicit types for Val and supports raw XDR anywhere", () => {
    expect(ok({ kind: "val" }, { type: "u32", value: 3 }).type).toBe("scvU32");
    expect(err({ kind: "val" }, 3).message).toMatch(/explicit type/);
    expect(err({ kind: "val" }, { type: "nope", value: 1 }).path).toBe("value.type");
    const raw = xdr.ScVal.scvU32(9).toXdr("base64");
    expect(ok({ kind: "address" }, { $xdr: raw }).type).toBe("scvU32");
    expect(err({ kind: "u32" }, { $xdr: "!!" }).message).toMatch(/not a valid base64/);
  });
});

describe("compound encoding", () => {
  it("encodes options, vecs, tuples and maps", () => {
    expect(ok({ kind: "option", value: { kind: "u32" } }, null).type).toBe("scvVoid");
    expect(ok({ kind: "option", value: { kind: "u32" } }, 1).type).toBe("scvU32");
    expect(scValToJson(ok({ kind: "vec", element: { kind: "u32" } }, [1, 2]))).toEqual([1, 2]);
    expect(err({ kind: "vec", element: { kind: "u32" } }, [1, "x"]).path).toBe("value[1]");
    expect(err({ kind: "tuple", elements: [{ kind: "u32" }] }, [1, 2]).message).toMatch(/1 items/);
    const map = ok({ kind: "map", key: { kind: "symbol" }, value: { kind: "u32" } }, { b: 2, a: 1 });
    // Host requires sorted keys.
    expect(map.type === "scvMap" && map.map!.map((e) => scValToJson(e.key))).toEqual(["a", "b"]);
    const pairs = ok({ kind: "map", key: { kind: "u32" }, value: { kind: "bool" } }, [
      [2, true],
      [1, false],
    ]);
    expect(scValToJson(pairs)).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(err({ kind: "map", key: { kind: "u32" }, value: { kind: "bool" } }, { 1: true }).message).toMatch(/pairs/);
    expect(err({ kind: "map", key: { kind: "symbol" }, value: { kind: "u32" } }, { a: "x" }).path).toBe("value.a");
  });

  it("encodes structs as sorted maps and reports missing/unknown fields", () => {
    const v = ok({ kind: "udt", name: "Point" }, { y: 2, x: 1 });
    expect(v.type === "scvMap" && v.map!.map((e) => scValToJson(e.key))).toEqual(["x", "y"]);
    expect(err({ kind: "udt", name: "Point" }, { x: 1 }).message).toMatch(/Missing field "y"/);
    expect(err({ kind: "udt", name: "Point" }, { x: 1, y: 2, z: 3 }).path).toBe("value.z");
    expect(err({ kind: "udt", name: "Point" }, [1, 2]).message).toMatch(/expects an object/);
    expect(scValToJson(ok({ kind: "udt", name: "Pair" }, [1, true]))).toEqual([1, true]);
  });

  it("encodes unions and enums", () => {
    expect(scValToJson(ok({ kind: "udt", name: "Shape" }, "Empty"))).toEqual(["Empty"]);
    expect(scValToJson(ok({ kind: "udt", name: "Shape" }, { tag: "Rect", values: [2, 3] }))).toEqual(["Rect", 2, 3]);
    expect(err({ kind: "udt", name: "Shape" }, { tag: "Rect", values: [2] }).message).toMatch(/takes 2 value/);
    expect(err({ kind: "udt", name: "Shape" }, "Triangle").message).toMatch(/no case "Triangle". Cases: Empty, Circle, Rect/);
    expect(err({ kind: "udt", name: "Shape" }, { tag: "Empty", values: [1] }).message).toMatch(/takes no values/);
    expect(scValToJson(ok({ kind: "udt", name: "Color" }, "Green"))).toBe(1);
    expect(scValToJson(ok({ kind: "udt", name: "Color" }, 0))).toBe(0);
    expect(err({ kind: "udt", name: "Color" }, "Blue").message).toMatch(/Red \(0\), Green \(1\)/);
    expect(err({ kind: "udt", name: "Missing" }, 1).message).toMatch(/does not define type Missing/);
  });

  it("round-trips typed values through decode", () => {
    const cases: [TypeDef, unknown][] = [
      [
        { kind: "udt", name: "Shape" },
        { tag: "Circle", values: [5] },
      ],
      [
        { kind: "udt", name: "Point" },
        { x: -1, y: 2 },
      ],
      [{ kind: "vec", element: { kind: "udt", name: "Color" } }, ["Red", "Green"]],
      [{ kind: "option", value: { kind: "i128" } }, "42"],
    ];
    for (const [type, value] of cases) {
      expect(scValToTypedJson(ok(type, value), type, spec)).toEqual(value);
    }
  });
});

describe("encodeArgs", () => {
  it("encodes a real function with nested structs", () => {
    const r = encodeArgs(fn("transfer_batch"), { from: G, payments: [{ to: C, amount: "5" }] }, tokenSpec);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toHaveLength(2);
  });

  it("collects one error per argument, with paths", () => {
    const errors = validateArgs(fn("transfer_with_memo"), { from: "bad", amount: "x", memo: { tag: "Nope" }, extra: 1 }, tokenSpec);
    expect(errors.map((e) => e.path)).toEqual(["from", "to", "amount", "memo", "extra"]);
    expect(errors[1]!.message).toMatch(/Missing argument "to" \(Address\)/);
    expect(errors[4]!.message).toMatch(/no parameter "extra"/);
  });

  it("allows omitting Option arguments", () => {
    const f: FunctionSpec = { name: "f", inputs: [{ name: "o", type: { kind: "option", value: { kind: "u32" } } }], outputs: [] };
    expect(encodeArgs(f, {}, spec).ok).toBe(true);
  });
});
