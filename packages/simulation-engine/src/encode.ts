import { Address, StrKey, nativeToScVal, scvSortedMap, xdr } from "@stellar/stellar-sdk";
import {
  PRIMITIVE_TYPES,
  findUdt,
  formatType,
  hexToBytes,
  isHex,
  type ContractSpec,
  type FunctionSpec,
  type PrimitiveTypeName,
  type TypeDef,
} from "@playground/shared-types";

export interface ArgError {
  /** Path to the offending value, e.g. `payments[1].amount`. */
  path: string;
  message: string;
}

export type EncodeResult = { ok: true; values: xdr.ScVal[] } | { ok: false; errors: ArgError[] };

class EncodeError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(message);
  }
}

const INT_RANGES: Record<string, [bigint, bigint]> = {
  u32: [0n, 2n ** 32n - 1n],
  i32: [-(2n ** 31n), 2n ** 31n - 1n],
  u64: [0n, 2n ** 64n - 1n],
  i64: [-(2n ** 63n), 2n ** 63n - 1n],
  timepoint: [0n, 2n ** 64n - 1n],
  duration: [0n, 2n ** 64n - 1n],
  u128: [0n, 2n ** 128n - 1n],
  i128: [-(2n ** 127n), 2n ** 127n - 1n],
  u256: [0n, 2n ** 256n - 1n],
  i256: [-(2n ** 255n), 2n ** 255n - 1n],
};

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "string") return value.length > 24 ? `"${value.slice(0, 24)}…"` : `"${value}"`;
  return typeof value === "object" ? "an object" : `${typeof value} ${String(value)}`;
}

function toBigInt(value: unknown, kind: string, path: string): bigint {
  let n: bigint;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new EncodeError(path, `${kind} must be an integer, got ${value}.`);
    if (!Number.isSafeInteger(value)) {
      throw new EncodeError(path, `${value} is beyond JavaScript's safe integer range; pass it as a string.`);
    }
    n = BigInt(value);
  } else if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    n = BigInt(value.trim());
  } else if (typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value.trim())) {
    n = BigInt(value.trim());
  } else {
    throw new EncodeError(path, `${kind} expects an integer (number or decimal string), got ${describe(value)}.`);
  }
  const range = INT_RANGES[kind];
  if (range && (n < range[0] || n > range[1])) {
    throw new EncodeError(path, `${n} is out of range for ${kind} (${range[0]} to ${range[1]}).`);
  }
  return n;
}

function expectString(value: unknown, what: string, path: string): string {
  if (typeof value !== "string") throw new EncodeError(path, `${what} expects a string, got ${describe(value)}.`);
  return value;
}

function encodeAddress(value: unknown, path: string, allowMuxed: boolean): xdr.ScVal {
  const s = expectString(value, "Address", path).trim();
  if (!s) throw new EncodeError(path, "Address is required.");
  const valid =
    StrKey.isValidEd25519PublicKey(s) || StrKey.isValidContract(s) || (allowMuxed && StrKey.isValidMed25519PublicKey(s));
  if (!valid) {
    if (!allowMuxed && s.startsWith("M")) throw new EncodeError(path, "Muxed (M…) addresses are not accepted for Address; use G… or C….");
    if (s.startsWith("S")) throw new EncodeError(path, "That is a secret key. Never paste secret keys here; use the public key (G…).");
    throw new EncodeError(path, `"${s.slice(0, 12)}…" is not a valid ${allowMuxed ? "G…, M… or C…" : "G… or C…"} address.`);
  }
  return new Address(s).toScVal();
}

function encodeBytes(value: unknown, path: string, n?: number): xdr.ScVal {
  const s = expectString(value, n === undefined ? "Bytes" : `BytesN<${n}>`, path).trim();
  if (!isHex(s)) throw new EncodeError(path, "Bytes must be an even-length hex string (optional 0x prefix).");
  const bytes = hexToBytes(s);
  if (n !== undefined && bytes.length !== n) {
    throw new EncodeError(path, `BytesN<${n}> needs exactly ${n} bytes (${n * 2} hex characters), got ${bytes.length}.`);
  }
  return xdr.ScVal.scvBytes(bytes);
}

function encodePrimitive(kind: PrimitiveTypeName, value: unknown, path: string, spec: ContractSpec): xdr.ScVal {
  switch (kind) {
    case "bool":
      if (typeof value !== "boolean") throw new EncodeError(path, `bool expects true or false, got ${describe(value)}.`);
      return xdr.ScVal.scvBool(value);
    case "void":
      if (value !== null && value !== undefined) throw new EncodeError(path, `() expects null, got ${describe(value)}.`);
      return xdr.ScVal.scvVoid();
    case "u32":
      return xdr.ScVal.scvU32(Number(toBigInt(value, kind, path)));
    case "i32":
      return xdr.ScVal.scvI32(Number(toBigInt(value, kind, path)));
    case "u64":
      return xdr.ScVal.scvU64(toBigInt(value, kind, path));
    case "i64":
      return xdr.ScVal.scvI64(toBigInt(value, kind, path));
    case "timepoint":
      return xdr.ScVal.scvTimepoint(toBigInt(value, kind, path));
    case "duration":
      return xdr.ScVal.scvDuration(toBigInt(value, kind, path));
    case "u128":
    case "i128":
    case "u256":
    case "i256":
      return nativeToScVal(toBigInt(value, kind, path), { type: kind });
    case "bytes":
      return encodeBytes(value, path);
    case "string":
      return xdr.ScVal.scvString(expectString(value, "String", path));
    case "symbol": {
      const s = expectString(value, "Symbol", path);
      if (s.length > 32) throw new EncodeError(path, `Symbols are at most 32 characters (got ${s.length}).`);
      if (!/^[a-zA-Z0-9_]*$/.test(s)) throw new EncodeError(path, "Symbols may only contain a-z, A-Z, 0-9 and _.");
      return xdr.ScVal.scvSymbol(s);
    }
    case "address":
      return encodeAddress(value, path, false);
    case "muxed_address":
      return encodeAddress(value, path, true);
    case "val":
      return encodeUntyped(value, path, spec);
    case "error": {
      if (typeof value === "number") return xdr.ScVal.scvError(xdr.ScError.sceContract(value));
      throw new EncodeError(path, "Error values are given as a contract error code (number).");
    }
  }
}

/** `Val` arguments carry no type in the spec, so they must say which type they are. */
function encodeUntyped(value: unknown, path: string, spec: ContractSpec): xdr.ScVal {
  if (value && typeof value === "object" && !Array.isArray(value) && "type" in value) {
    const { type, value: inner } = value as { type: unknown; value: unknown };
    if (typeof type === "string" && (PRIMITIVE_TYPES as readonly string[]).includes(type) && type !== "val") {
      return encodePrimitive(type as PrimitiveTypeName, inner, `${path}.value`, spec);
    }
    throw new EncodeError(`${path}.type`, `Unknown type ${describe(type)}. Use one of: ${PRIMITIVE_TYPES.filter((t) => t !== "val").join(", ")}.`);
  }
  throw new EncodeError(path, 'Val arguments need an explicit type, e.g. { "type": "u32", "value": 1 }, or raw XDR as { "$xdr": "…" }.');
}

function rawXdr(value: unknown, path: string): xdr.ScVal | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "$xdr") return undefined;
  const b64 = (value as { $xdr: unknown }).$xdr;
  if (typeof b64 !== "string") throw new EncodeError(path, "$xdr must be a base64 ScVal string.");
  try {
    return xdr.ScVal.fromXdr(b64, "base64");
  } catch {
    throw new EncodeError(path, "$xdr is not a valid base64-encoded ScVal.");
  }
}

function join(path: string, key: string | number): string {
  if (typeof key === "number") return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

/** Encodes one JSON value as an ScVal of the given spec type. Throws `EncodeError` with a path. */
function encode(type: TypeDef, value: unknown, path: string, spec: ContractSpec, depth: number): xdr.ScVal {
  if (depth > 64) throw new EncodeError(path, "Value is nested too deeply.");
  const raw = rawXdr(value, path);
  if (raw) return raw;

  switch (type.kind) {
    case "option":
      return value === null || value === undefined ? xdr.ScVal.scvVoid() : encode(type.value, value, path, spec, depth + 1);
    case "result":
      return encode(type.ok, value, path, spec, depth + 1);
    case "vec": {
      if (!Array.isArray(value)) throw new EncodeError(path, `${formatType(type)} expects an array, got ${describe(value)}.`);
      return xdr.ScVal.scvVec(value.map((v, i) => encode(type.element, v, join(path, i), spec, depth + 1)));
    }
    case "tuple": {
      if (!Array.isArray(value) || value.length !== type.elements.length) {
        throw new EncodeError(path, `${formatType(type)} expects an array of ${type.elements.length} items, got ${describe(value)}.`);
      }
      return xdr.ScVal.scvVec(type.elements.map((t, i) => encode(t, value[i], join(path, i), spec, depth + 1)));
    }
    case "map": {
      let pairs: [unknown, unknown][];
      if (Array.isArray(value)) {
        if (!value.every((p) => Array.isArray(p) && p.length === 2)) {
          throw new EncodeError(path, `${formatType(type)} as an array must contain [key, value] pairs.`);
        }
        pairs = value as [unknown, unknown][];
      } else if (value && typeof value === "object") {
        if (type.key.kind !== "string" && type.key.kind !== "symbol") {
          throw new EncodeError(path, `${formatType(type)} has non-string keys; use [[key, value], …] pairs.`);
        }
        pairs = Object.entries(value);
      } else {
        throw new EncodeError(path, `${formatType(type)} expects an object or [[key, value], …], got ${describe(value)}.`);
      }
      const entries = pairs.map(
        ([k, v], i) =>
          new xdr.ScMapEntry({
            key: encode(type.key, k, `${join(path, i)}.key`, spec, depth + 1),
            val: encode(type.value, v, typeof k === "string" ? join(path, k) : `${join(path, i)}.value`, spec, depth + 1),
          }),
      );
      return scvSortedMap(entries);
    }
    case "bytes_n":
      return encodeBytes(value, path, type.n);
    case "udt":
      return encodeUdt(type.name, value, path, spec, depth);
    default:
      return encodePrimitive(type.kind, value, path, spec);
  }
}

function encodeUdt(name: string, value: unknown, path: string, spec: ContractSpec, depth: number): xdr.ScVal {
  const udt = findUdt(spec, name);
  if (!udt) throw new EncodeError(path, `The spec does not define type ${name}.`);
  switch (udt.kind) {
    case "struct": {
      const isTuple = udt.fields.length > 0 && udt.fields.every((f, i) => f.name === String(i));
      if (isTuple) {
        if (!Array.isArray(value) || value.length !== udt.fields.length) {
          throw new EncodeError(path, `${name} expects an array of ${udt.fields.length} items, got ${describe(value)}.`);
        }
        return xdr.ScVal.scvVec(udt.fields.map((f, i) => encode(f.type, value[i], join(path, i), spec, depth + 1)));
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new EncodeError(path, `${name} expects an object with fields ${udt.fields.map((f) => f.name).join(", ")}, got ${describe(value)}.`);
      }
      const obj = value as Record<string, unknown>;
      const unknown = Object.keys(obj).filter((k) => !udt.fields.some((f) => f.name === k));
      if (unknown.length) throw new EncodeError(join(path, unknown[0]!), `${name} has no field "${unknown[0]}".`);
      const entries = udt.fields.map((f) => {
        if (!(f.name in obj)) throw new EncodeError(join(path, f.name), `Missing field "${f.name}" (${formatType(f.type)}).`);
        return new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol(f.name),
          val: encode(f.type, obj[f.name], join(path, f.name), spec, depth + 1),
        });
      });
      return scvSortedMap(entries);
    }
    case "union": {
      let tag: string;
      let values: unknown[] = [];
      if (typeof value === "string") {
        tag = value;
      } else if (value && typeof value === "object" && !Array.isArray(value) && "tag" in value) {
        const v = value as { tag: unknown; values?: unknown };
        if (typeof v.tag !== "string") throw new EncodeError(join(path, "tag"), "tag must be a string.");
        tag = v.tag;
        if (v.values !== undefined && !Array.isArray(v.values)) throw new EncodeError(join(path, "values"), "values must be an array.");
        values = (v.values as unknown[] | undefined) ?? [];
      } else {
        throw new EncodeError(path, `${name} expects "Case" or { "tag": "Case", "values": [...] }. Cases: ${udt.cases.map((c) => c.name).join(", ")}.`);
      }
      const c = udt.cases.find((x) => x.name === tag);
      if (!c) throw new EncodeError(path, `${name} has no case "${tag}". Cases: ${udt.cases.map((x) => x.name).join(", ")}.`);
      if (c.kind === "void") {
        if (values.length) throw new EncodeError(join(path, "values"), `${name}::${tag} takes no values.`);
        return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(tag)]);
      }
      if (values.length !== c.types.length) {
        throw new EncodeError(join(path, "values"), `${name}::${tag} takes ${c.types.length} value(s): (${c.types.map(formatType).join(", ")}).`);
      }
      return xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol(tag),
        ...c.types.map((t, i) => encode(t, values[i], `${join(path, "values")}[${i}]`, spec, depth + 1)),
      ]);
    }
    case "enum": {
      const c =
        typeof value === "number" ? udt.cases.find((x) => x.value === value) : udt.cases.find((x) => x.name === value);
      if (!c) {
        throw new EncodeError(path, `${name} expects one of ${udt.cases.map((x) => `${x.name} (${x.value})`).join(", ")}, got ${describe(value)}.`);
      }
      return xdr.ScVal.scvU32(c.value);
    }
    case "error_enum": {
      const c =
        typeof value === "number" ? udt.cases.find((x) => x.value === value) : udt.cases.find((x) => x.name === value);
      if (!c) throw new EncodeError(path, `${name} expects one of ${udt.cases.map((x) => x.name).join(", ")}.`);
      return xdr.ScVal.scvError(xdr.ScError.sceContract(c.value));
    }
  }
}

/** Encodes a single value; returns errors instead of throwing. */
export function encodeValue(type: TypeDef, value: unknown, spec: ContractSpec, path = "value"): { ok: true; value: xdr.ScVal } | { ok: false; error: ArgError } {
  try {
    return { ok: true, value: encode(type, value, path, spec, 0) };
  } catch (e) {
    if (e instanceof EncodeError) return { ok: false, error: { path: e.path, message: e.message } };
    return { ok: false, error: { path, message: (e as Error).message } };
  }
}

/**
 * Validates and encodes `{ argName: value }` for a function. Collects one error
 * per argument so the UI can show them all at once.
 */
export function encodeArgs(fn: FunctionSpec, args: Record<string, unknown>, spec: ContractSpec): EncodeResult {
  const errors: ArgError[] = [];
  const values: xdr.ScVal[] = [];
  for (const input of fn.inputs) {
    if (!(input.name in args) && input.type.kind !== "option") {
      errors.push({ path: input.name, message: `Missing argument "${input.name}" (${formatType(input.type)}).` });
      continue;
    }
    const r = encodeValue(input.type, args[input.name], spec, input.name);
    if (r.ok) values.push(r.value);
    else errors.push(r.error);
  }
  for (const extra of Object.keys(args)) {
    if (!fn.inputs.some((i) => i.name === extra)) {
      errors.push({ path: extra, message: `${fn.name} has no parameter "${extra}".` });
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, values };
}

/** Validation only, for live feedback while typing. */
export function validateArgs(fn: FunctionSpec, args: Record<string, unknown>, spec: ContractSpec): ArgError[] {
  const r = encodeArgs(fn, args, spec);
  return r.ok ? [] : r.errors;
}
