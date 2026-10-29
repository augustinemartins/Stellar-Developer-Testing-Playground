import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";
import {
  bytesToHex,
  findUdt,
  type ContractSpec,
  type DecodedValue,
  type JsonValue,
  type TypeDef,
} from "@playground/shared-types";

/** Short, stable type tags for ScVal variants (`scvU32` → `u32`). */
const TYPE_TAGS: Record<string, string> = {
  scvBool: "bool",
  scvVoid: "void",
  scvError: "error",
  scvU32: "u32",
  scvI32: "i32",
  scvU64: "u64",
  scvI64: "i64",
  scvTimepoint: "timepoint",
  scvDuration: "duration",
  scvU128: "u128",
  scvI128: "i128",
  scvU256: "u256",
  scvI256: "i256",
  scvBytes: "bytes",
  scvString: "string",
  scvSymbol: "symbol",
  scvVec: "vec",
  scvMap: "map",
  scvAddress: "address",
  scvContractInstance: "contract_instance",
  scvLedgerKeyContractInstance: "ledger_key_contract_instance",
  scvLedgerKeyNonce: "ledger_key_nonce",
  scvExecutableTag: "executable_tag",
};

export function scValTypeTag(v: xdr.ScVal): string {
  return TYPE_TAGS[v.type] ?? v.type;
}

export function toScVal(input: xdr.ScVal | string): xdr.ScVal {
  return typeof input === "string" ? xdr.ScVal.fromXdr(input, "base64") : input;
}

function xdrString(s: { toString(): string; bytes?: Uint8Array }): string {
  return s.toString();
}

export function scAddressToString(a: xdr.ScAddress): string {
  return Address.fromScAddress(a).toString();
}

function errorToJson(e: xdr.ScError): JsonValue {
  const kind = e.type.replace(/^sce/, "");
  if (e.type === "sceContract") return { error: { type: "Contract", code: e.contractCode } };
  return { error: { type: kind, code: String((e as { code?: { name?: string } }).code?.name ?? "unknown") } };
}

function bigToJson(v: xdr.ScVal): string {
  return (scValToNative(v) as bigint).toString();
}

/**
 * JSON rendering of an ScVal without type information. Uses the same
 * conventions as argument input (see contract-loader `templates.ts`), so a
 * returned value can be pasted back as an argument of the same type.
 */
export function scValToJson(v: xdr.ScVal): JsonValue {
  switch (v.type) {
    case "scvBool":
      return v.b;
    case "scvVoid":
      return null;
    case "scvError":
      return errorToJson(v.error);
    case "scvU32":
      return v.u32;
    case "scvI32":
      return v.i32;
    case "scvU64":
      return v.u64.toString();
    case "scvI64":
      return v.i64.toString();
    case "scvTimepoint":
      return v.timepoint.toString();
    case "scvDuration":
      return v.duration.toString();
    case "scvU128":
    case "scvI128":
    case "scvU256":
    case "scvI256":
      return bigToJson(v);
    case "scvBytes":
      return bytesToHex(scValToNative(v) as Uint8Array);
    case "scvString":
      return xdrString(v.str);
    case "scvSymbol":
      return xdrString(v.sym);
    case "scvAddress":
      return scAddressToString(v.address);
    case "scvVec":
      return (v.vec ?? []).map(scValToJson);
    case "scvMap": {
      const entries = v.map ?? [];
      const stringKeys = entries.every((e) => e.key.type === "scvSymbol" || e.key.type === "scvString");
      if (stringKeys) {
        return Object.fromEntries(entries.map((e) => [scValToJson(e.key) as string, scValToJson(e.val)]));
      }
      return entries.map((e) => [scValToJson(e.key), scValToJson(e.val)]);
    }
    case "scvLedgerKeyContractInstance":
      return "<contract instance>";
    case "scvLedgerKeyNonce":
      return { nonce: v.nonceKey.nonce.toString() };
    case "scvContractInstance":
      return { contract_instance: v.instance.executable.type.replace(/^contractExecutable/, "") };
    case "scvExecutableTag":
      return { executable_tag: xdrString(v.executableTag) };
    default:
      return `<${(v as { type: string }).type}>`;
  }
}

export function decodeScVal(input: xdr.ScVal | string): DecodedValue {
  const v = toScVal(input);
  return { xdr: v.toXdr("base64"), type: scValTypeTag(v), json: scValToJson(v) };
}

/**
 * Spec-aware JSON rendering. Differences from `scValToJson`:
 * unions become `{ tag, values }` (or the bare case name for void cases),
 * enums become their case name, and `Result`/`Option` are unwrapped.
 * Falls back to the untyped rendering whenever the value does not match the type.
 */
export function scValToTypedJson(v: xdr.ScVal, type: TypeDef, spec: ContractSpec, depth = 0): JsonValue {
  if (depth > 32) return scValToJson(v);
  switch (type.kind) {
    case "option":
      return v.type === "scvVoid" ? null : scValToTypedJson(v, type.value, spec, depth + 1);
    case "result":
      return v.type === "scvError" ? scValToJson(v) : scValToTypedJson(v, type.ok, spec, depth + 1);
    case "vec":
      return v.type === "scvVec" ? (v.vec ?? []).map((e) => scValToTypedJson(e, type.element, spec, depth + 1)) : scValToJson(v);
    case "tuple":
      return v.type === "scvVec"
        ? (v.vec ?? []).map((e, i) => {
            const t = type.elements[i];
            return t ? scValToTypedJson(e, t, spec, depth + 1) : scValToJson(e);
          })
        : scValToJson(v);
    case "map": {
      if (v.type !== "scvMap") return scValToJson(v);
      const entries = v.map ?? [];
      if (type.key.kind === "string" || type.key.kind === "symbol") {
        return Object.fromEntries(
          entries.map((e) => [String(scValToJson(e.key)), scValToTypedJson(e.val, type.value, spec, depth + 1)]),
        );
      }
      return entries.map((e) => [
        scValToTypedJson(e.key, type.key, spec, depth + 1),
        scValToTypedJson(e.val, type.value, spec, depth + 1),
      ]);
    }
    case "udt": {
      const udt = findUdt(spec, type.name);
      if (!udt) return scValToJson(v);
      if (udt.kind === "struct") {
        const isTuple = udt.fields.length > 0 && udt.fields.every((f, i) => f.name === String(i));
        if (isTuple && v.type === "scvVec") {
          return (v.vec ?? []).map((e, i) => {
            const f = udt.fields[i];
            return f ? scValToTypedJson(e, f.type, spec, depth + 1) : scValToJson(e);
          });
        }
        if (v.type === "scvMap") {
          const out: Record<string, JsonValue> = {};
          for (const e of v.map ?? []) {
            const name = String(scValToJson(e.key));
            const f = udt.fields.find((x) => x.name === name);
            out[name] = f ? scValToTypedJson(e.val, f.type, spec, depth + 1) : scValToJson(e.val);
          }
          return out;
        }
        return scValToJson(v);
      }
      if (udt.kind === "union") {
        if (v.type !== "scvVec" || !v.vec?.length || v.vec[0]?.type !== "scvSymbol") return scValToJson(v);
        const [head, ...rest] = v.vec;
        const tag = String(scValToJson(head!));
        const c = udt.cases.find((x) => x.name === tag);
        if (!c || c.kind === "void") return tag;
        return {
          tag,
          values: rest.map((e, i) => {
            const t = c.types[i];
            return t ? scValToTypedJson(e, t, spec, depth + 1) : scValToJson(e);
          }),
        };
      }
      if (udt.kind === "enum" && v.type === "scvU32") {
        return udt.cases.find((c) => c.value === v.u32)?.name ?? v.u32;
      }
      return scValToJson(v);
    }
    default:
      return scValToJson(v);
  }
}

/** A typed tree for rendering values with type badges in the UI. */
export type ValueNode =
  | { kind: "scalar"; type: string; value: JsonValue }
  | { kind: "vec"; type: string; items: ValueNode[] }
  | { kind: "map"; type: string; entries: { key: ValueNode; value: ValueNode }[] };

export function scValToTree(input: xdr.ScVal | string): ValueNode {
  const v = toScVal(input);
  const type = scValTypeTag(v);
  if (v.type === "scvVec") return { kind: "vec", type, items: (v.vec ?? []).map(scValToTree) };
  if (v.type === "scvMap") {
    return { kind: "map", type, entries: (v.map ?? []).map((e) => ({ key: scValToTree(e.key), value: scValToTree(e.val) })) };
  }
  return { kind: "scalar", type, value: scValToJson(v) };
}
