import { z } from "zod";

/**
 * A normalised, JSON-friendly view of a Soroban contract specification
 * (the `contractspecv0` custom section embedded in every contract WASM).
 *
 * It mirrors the XDR `ScSpecEntry` union but uses plain objects so specs can
 * be stored in fixtures, embedded in scenarios and diffed in code review.
 */

export const PRIMITIVE_TYPES = [
  "val",
  "bool",
  "void",
  "error",
  "u32",
  "i32",
  "u64",
  "i64",
  "timepoint",
  "duration",
  "u128",
  "i128",
  "u256",
  "i256",
  "bytes",
  "string",
  "symbol",
  "address",
  "muxed_address",
] as const;

export type PrimitiveTypeName = (typeof PRIMITIVE_TYPES)[number];

export type TypeDef =
  | { kind: PrimitiveTypeName }
  | { kind: "option"; value: TypeDef }
  | { kind: "result"; ok: TypeDef; error: TypeDef }
  | { kind: "vec"; element: TypeDef }
  | { kind: "map"; key: TypeDef; value: TypeDef }
  | { kind: "tuple"; elements: TypeDef[] }
  | { kind: "bytes_n"; n: number }
  | { kind: "udt"; name: string };

export const TypeDefSchema: z.ZodType<TypeDef> = z.lazy(() =>
  z.union([
    z.object({ kind: z.enum(PRIMITIVE_TYPES) }),
    z.object({ kind: z.literal("option"), value: TypeDefSchema }),
    z.object({ kind: z.literal("result"), ok: TypeDefSchema, error: TypeDefSchema }),
    z.object({ kind: z.literal("vec"), element: TypeDefSchema }),
    z.object({ kind: z.literal("map"), key: TypeDefSchema, value: TypeDefSchema }),
    z.object({ kind: z.literal("tuple"), elements: z.array(TypeDefSchema) }),
    z.object({ kind: z.literal("bytes_n"), n: z.number().int().nonnegative() }),
    z.object({ kind: z.literal("udt"), name: z.string().min(1) }),
  ]),
);

const doc = z.string().optional();

export const FunctionInputSchema = z.object({
  name: z.string(),
  doc,
  type: TypeDefSchema,
});
export type FunctionInput = z.infer<typeof FunctionInputSchema>;

export const FunctionSpecSchema = z.object({
  name: z.string().min(1),
  doc,
  inputs: z.array(FunctionInputSchema),
  outputs: z.array(TypeDefSchema),
});
export type FunctionSpec = z.infer<typeof FunctionSpecSchema>;

export const StructSpecSchema = z.object({
  kind: z.literal("struct"),
  name: z.string().min(1),
  doc,
  lib: z.string().optional(),
  fields: z.array(z.object({ name: z.string(), doc, type: TypeDefSchema })),
});
export type StructSpec = z.infer<typeof StructSpecSchema>;

export const UnionCaseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("void"), name: z.string().min(1), doc }),
  z.object({ kind: z.literal("tuple"), name: z.string().min(1), doc, types: z.array(TypeDefSchema) }),
]);
export type UnionCase = z.infer<typeof UnionCaseSchema>;

export const UnionSpecSchema = z.object({
  kind: z.literal("union"),
  name: z.string().min(1),
  doc,
  lib: z.string().optional(),
  cases: z.array(UnionCaseSchema),
});
export type UnionSpec = z.infer<typeof UnionSpecSchema>;

const EnumCaseSchema = z.object({ name: z.string().min(1), doc, value: z.number().int().nonnegative() });

export const EnumSpecSchema = z.object({
  kind: z.literal("enum"),
  name: z.string().min(1),
  doc,
  lib: z.string().optional(),
  cases: z.array(EnumCaseSchema),
});
export type EnumSpec = z.infer<typeof EnumSpecSchema>;

export const ErrorEnumSpecSchema = z.object({
  kind: z.literal("error_enum"),
  name: z.string().min(1),
  doc,
  lib: z.string().optional(),
  cases: z.array(EnumCaseSchema),
});
export type ErrorEnumSpec = z.infer<typeof ErrorEnumSpecSchema>;

export const UdtSpecSchema = z.discriminatedUnion("kind", [StructSpecSchema, UnionSpecSchema, EnumSpecSchema, ErrorEnumSpecSchema]);
export type UdtSpec = z.infer<typeof UdtSpecSchema>;

export const EventSpecSchema = z.object({
  name: z.string().min(1),
  doc,
  lib: z.string().optional(),
  prefixTopics: z.array(z.string()),
  params: z.array(
    z.object({
      name: z.string(),
      doc,
      type: TypeDefSchema,
      location: z.enum(["topic", "data"]),
    }),
  ),
  dataFormat: z.enum(["single", "vec", "map"]),
});
export type EventSpec = z.infer<typeof EventSpecSchema>;

export const ContractSpecSchema = z.object({
  functions: z.array(FunctionSpecSchema),
  types: z.array(UdtSpecSchema),
  events: z.array(EventSpecSchema).default([]),
});
export type ContractSpec = z.infer<typeof ContractSpecSchema>;

/** Human readable rendering of a type, close to Rust syntax (e.g. `Option<Vec<Address>>`). */
export function formatType(type: TypeDef): string {
  switch (type.kind) {
    case "option":
      return `Option<${formatType(type.value)}>`;
    case "result":
      return `Result<${formatType(type.ok)}, ${formatType(type.error)}>`;
    case "vec":
      return `Vec<${formatType(type.element)}>`;
    case "map":
      return `Map<${formatType(type.key)}, ${formatType(type.value)}>`;
    case "tuple":
      return `(${type.elements.map(formatType).join(", ")})`;
    case "bytes_n":
      return `BytesN<${type.n}>`;
    case "udt":
      return type.name;
    case "muxed_address":
      return "MuxedAddress";
    case "val":
      return "Val";
    case "void":
      return "()";
    case "bool":
    case "u32":
    case "i32":
    case "u64":
    case "i64":
    case "u128":
    case "i128":
    case "u256":
    case "i256":
      return type.kind;
    default:
      return type.kind.charAt(0).toUpperCase() + type.kind.slice(1);
  }
}

/** Renders a function signature, e.g. `transfer(from: Address, to: Address, amount: i128) -> ()`. */
export function formatSignature(fn: FunctionSpec): string {
  const params = fn.inputs.map((i) => `${i.name}: ${formatType(i.type)}`).join(", ");
  const out = fn.outputs.length === 0 ? "()" : fn.outputs.map(formatType).join(", ");
  return `${fn.name}(${params}) -> ${out}`;
}

export function findUdt(spec: ContractSpec, name: string): UdtSpec | undefined {
  return spec.types.find((t) => t.name === name);
}

/** All error enum cases declared by the contract, keyed by numeric code. */
export function contractErrorCases(spec: ContractSpec): Map<number, { enumName: string; name: string; doc?: string }> {
  const out = new Map<number, { enumName: string; name: string; doc?: string }>();
  for (const t of spec.types) {
    if (t.kind !== "error_enum") continue;
    for (const c of t.cases) out.set(c.value, { enumName: t.name, name: c.name, doc: c.doc });
  }
  return out;
}

/**
 * Heuristic: functions are likely read-only if their name matches common
 * getter conventions. Used only to sort and badge methods in the UI; the
 * simulation itself is always read-only regardless.
 */
export function looksReadOnly(fn: FunctionSpec): boolean {
  return /^(get|balance|allowance|decimals|name|symbol|metadata|total_supply|admin|stats|is_|has_|read|query|view|version)/.test(fn.name);
}
