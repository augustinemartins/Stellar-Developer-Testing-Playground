import { findUdt, type ContractSpec, type FunctionSpec, type JsonValue, type TypeDef } from "@playground/shared-types";

/**
 * JSON value conventions used for arguments and decoded results.
 *
 * | Soroban type                         | JSON form                                   |
 * | ------------------------------------ | ------------------------------------------- |
 * | bool                                 | `true` / `false`                            |
 * | u32, i32                             | number                                      |
 * | u64…i256, timepoint, duration        | decimal string (numbers accepted if safe)   |
 * | bytes, BytesN<n>                     | hex string (optional `0x` prefix)           |
 * | String, Symbol                       | string                                      |
 * | Address, MuxedAddress                | `G…`, `C…` or `M…` strkey                   |
 * | Option<T>                            | `null` or the value                         |
 * | Vec<T>, tuples                       | array                                       |
 * | Map<K,V>                             | object (string/symbol keys) or `[[k, v]…]`  |
 * | struct                               | object keyed by field name                  |
 * | tuple struct                         | array                                       |
 * | union                                | `"Case"` or `{ "tag": "Case", "values": [] }` |
 * | enum                                 | case value (number) or case name (string)   |
 * | Val (untyped)                        | `{ "type": "u32", "value": 1 }`             |
 */
export const VALUE_CONVENTIONS_DOC_ANCHOR = "docs/value-format.md";

const MAX_DEPTH = 8;

/** A minimal valid-looking example value for a type, used to pre-fill inputs. */
export function exampleValue(type: TypeDef, spec: ContractSpec, depth = 0): JsonValue {
  if (depth > MAX_DEPTH) return null;
  switch (type.kind) {
    case "bool":
      return false;
    case "void":
      return null;
    case "u32":
    case "i32":
      return 0;
    case "u64":
    case "i64":
    case "u128":
    case "i128":
    case "u256":
    case "i256":
    case "timepoint":
    case "duration":
      return "0";
    case "bytes":
      return "";
    case "bytes_n":
      return "00".repeat(type.n);
    case "string":
    case "symbol":
    case "address":
    case "muxed_address":
      return "";
    case "val":
      return { type: "u32", value: 0 };
    case "error":
      return null;
    case "option":
      return null;
    case "result":
      return exampleValue(type.ok, spec, depth + 1);
    case "vec":
      return [];
    case "map":
      return isStringKey(type.key, spec) ? {} : [];
    case "tuple":
      return type.elements.map((t) => exampleValue(t, spec, depth + 1));
    case "udt": {
      const udt = findUdt(spec, type.name);
      if (!udt) return null;
      switch (udt.kind) {
        case "struct":
          if (isTupleStruct(udt.fields)) return udt.fields.map((f) => exampleValue(f.type, spec, depth + 1));
          return Object.fromEntries(udt.fields.map((f) => [f.name, exampleValue(f.type, spec, depth + 1)]));
        case "union": {
          const first = udt.cases[0];
          if (!first) return null;
          if (first.kind === "void") return first.name;
          return { tag: first.name, values: first.types.map((t) => exampleValue(t, spec, depth + 1)) };
        }
        case "enum":
        case "error_enum":
          return udt.cases[0]?.value ?? 0;
      }
    }
  }
}

export function exampleArgs(fn: FunctionSpec, spec: ContractSpec): Record<string, JsonValue> {
  return Object.fromEntries(fn.inputs.map((i) => [i.name, exampleValue(i.type, spec)]));
}

export function isTupleStruct(fields: { name: string }[]): boolean {
  return fields.length > 0 && fields.every((f, i) => f.name === String(i));
}

/** Maps with string or symbol keys are written as JSON objects; all others as `[[key, value], …]`. */
export function isStringKey(type: TypeDef, _spec?: ContractSpec): boolean {
  return type.kind === "string" || type.kind === "symbol";
}
