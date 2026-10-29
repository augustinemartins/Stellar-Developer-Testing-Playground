import { contract, type xdr } from "@stellar/stellar-sdk";
import type { ContractSpec, EventSpec, FunctionSpec, PrimitiveTypeName, TypeDef, UdtSpec } from "@playground/shared-types";

type XdrStringLike = { toString(): string } | string;

function str(s: XdrStringLike): string {
  return typeof s === "string" ? s : s.toString();
}

function docOf(s: XdrStringLike): string | undefined {
  const d = str(s).trim();
  return d.length ? d : undefined;
}

const PRIMITIVE_BY_VARIANT: Record<string, PrimitiveTypeName> = {
  scSpecTypeVal: "val",
  scSpecTypeBool: "bool",
  scSpecTypeVoid: "void",
  scSpecTypeError: "error",
  scSpecTypeU32: "u32",
  scSpecTypeI32: "i32",
  scSpecTypeU64: "u64",
  scSpecTypeI64: "i64",
  scSpecTypeTimepoint: "timepoint",
  scSpecTypeDuration: "duration",
  scSpecTypeU128: "u128",
  scSpecTypeI128: "i128",
  scSpecTypeU256: "u256",
  scSpecTypeI256: "i256",
  scSpecTypeBytes: "bytes",
  scSpecTypeString: "string",
  scSpecTypeSymbol: "symbol",
  scSpecTypeAddress: "address",
  scSpecTypeMuxedAddress: "muxed_address",
};

/** Converts an XDR `ScSpecTypeDef` into the playground's `TypeDef`. */
export function normalizeTypeDef(t: xdr.ScSpecTypeDef): TypeDef {
  const primitive = PRIMITIVE_BY_VARIANT[t.type];
  if (primitive) return { kind: primitive };
  switch (t.type) {
    case "scSpecTypeOption":
      return { kind: "option", value: normalizeTypeDef(t.option.valueType) };
    case "scSpecTypeResult":
      return { kind: "result", ok: normalizeTypeDef(t.result.okType), error: normalizeTypeDef(t.result.errorType) };
    case "scSpecTypeVec":
      return { kind: "vec", element: normalizeTypeDef(t.vec.elementType) };
    case "scSpecTypeMap":
      return { kind: "map", key: normalizeTypeDef(t.map.keyType), value: normalizeTypeDef(t.map.valueType) };
    case "scSpecTypeTuple":
      return { kind: "tuple", elements: t.tuple.valueTypes.map(normalizeTypeDef) };
    case "scSpecTypeBytesN":
      return { kind: "bytes_n", n: t.bytesN.n };
    case "scSpecTypeUdt":
      return { kind: "udt", name: str(t.udt.name) };
    default:
      throw new Error(`Unsupported spec type: ${(t as { type: string }).type}`);
  }
}

/** Converts XDR spec entries into a `ContractSpec`. Unknown entry kinds are skipped. */
export function normalizeSpecEntries(entries: readonly xdr.ScSpecEntry[]): ContractSpec {
  const functions: FunctionSpec[] = [];
  const types: UdtSpec[] = [];
  const events: EventSpec[] = [];

  for (const entry of entries) {
    switch (entry.type) {
      case "scSpecEntryFunctionV0": {
        const f = entry.functionV0;
        functions.push({
          name: str(f.name),
          doc: docOf(f.doc),
          inputs: f.inputs.map((i) => ({ name: str(i.name), doc: docOf(i.doc), type: normalizeTypeDef(i.type) })),
          outputs: f.outputs.map(normalizeTypeDef),
        });
        break;
      }
      case "scSpecEntryUdtStructV0": {
        const s = entry.udtStructV0;
        types.push({
          kind: "struct",
          name: str(s.name),
          doc: docOf(s.doc),
          lib: docOf(s.lib),
          fields: s.fields.map((f) => ({ name: str(f.name), doc: docOf(f.doc), type: normalizeTypeDef(f.type) })),
        });
        break;
      }
      case "scSpecEntryUdtUnionV0": {
        const u = entry.udtUnionV0;
        types.push({
          kind: "union",
          name: str(u.name),
          doc: docOf(u.doc),
          lib: docOf(u.lib),
          cases: u.cases.map((c) =>
            c.type === "scSpecUdtUnionCaseVoidV0"
              ? { kind: "void" as const, name: str(c.voidCase.name), doc: docOf(c.voidCase.doc) }
              : {
                  kind: "tuple" as const,
                  name: str(c.tupleCase.name),
                  doc: docOf(c.tupleCase.doc),
                  types: c.tupleCase.type.map(normalizeTypeDef),
                },
          ),
        });
        break;
      }
      case "scSpecEntryUdtEnumV0":
      case "scSpecEntryUdtErrorEnumV0": {
        const e = entry.type === "scSpecEntryUdtEnumV0" ? entry.udtEnumV0 : entry.udtErrorEnumV0;
        types.push({
          kind: entry.type === "scSpecEntryUdtEnumV0" ? "enum" : "error_enum",
          name: str(e.name),
          doc: docOf(e.doc),
          lib: docOf(e.lib),
          cases: e.cases.map((c) => ({ name: str(c.name), doc: docOf(c.doc), value: c.value })),
        });
        break;
      }
      case "scSpecEntryEventV0": {
        const ev = entry.eventV0;
        const format = ev.dataFormat.value;
        events.push({
          name: str(ev.name),
          doc: docOf(ev.doc),
          lib: docOf(ev.lib),
          prefixTopics: ev.prefixTopics.map(str),
          params: ev.params.map((p) => ({
            name: str(p.name),
            doc: docOf(p.doc),
            type: normalizeTypeDef(p.type),
            location: p.location.value === 1 ? ("topic" as const) : ("data" as const),
          })),
          dataFormat: format === 0 ? "single" : format === 1 ? "vec" : "map",
        });
        break;
      }
      default:
        break;
    }
  }

  return { functions, types, events };
}

/** Extracts and normalises the spec embedded in a contract WASM binary. */
export function specFromWasm(wasm: Uint8Array): ContractSpec {
  return normalizeSpecEntries(contract.Spec.fromWasm(wasm).entries);
}

/** Normalises a spec given as base64 XDR entries (e.g. output of `stellar contract info interface --output xdr-base64-array`). */
export function specFromXdr(entries: string[] | string): ContractSpec {
  return normalizeSpecEntries(new contract.Spec(entries as string[]).entries);
}
