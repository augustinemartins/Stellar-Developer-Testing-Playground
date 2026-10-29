import { findUdt, formatType, type ContractSpec, type FunctionSpec, type TypeDef } from "@playground/shared-types";
import { isStringKey, isTupleStruct } from "./templates";

/** Subset of JSON Schema (draft-07) used to drive editor validation and completion. */
export interface JsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: JsonSchema | JsonSchema[];
  prefixItems?: JsonSchema[];
  additionalItems?: boolean | JsonSchema;
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  required?: string[];
  enum?: (string | number | null)[];
  const?: string | number;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  definitions?: Record<string, JsonSchema>;
  default?: unknown;
  examples?: unknown[];
}

const INT_STRING = "^-?[0-9]+$";
const UINT_STRING = "^[0-9]+$";

function bigInt(signed: boolean, description: string): JsonSchema {
  return {
    description: `${description} Use a decimal string to avoid precision loss.`,
    oneOf: [
      { type: "string", pattern: signed ? INT_STRING : UINT_STRING },
      { type: "integer", ...(signed ? {} : { minimum: 0 }) },
    ],
    examples: ["0"],
  };
}

function schemaFor(type: TypeDef, spec: ContractSpec): JsonSchema {
  const label = formatType(type);
  switch (type.kind) {
    case "bool":
      return { type: "boolean", description: "bool" };
    case "void":
      return { type: "null", description: "()" };
    case "u32":
      return { type: "integer", minimum: 0, maximum: 4294967295, description: "u32" };
    case "i32":
      return { type: "integer", minimum: -2147483648, maximum: 2147483647, description: "i32" };
    case "u64":
    case "u128":
    case "u256":
      return bigInt(false, `${label}.`);
    case "i64":
    case "i128":
    case "i256":
      return bigInt(true, `${label}.`);
    case "timepoint":
      return bigInt(false, "Timepoint (seconds since Unix epoch).");
    case "duration":
      return bigInt(false, "Duration in seconds.");
    case "bytes":
      return { type: "string", pattern: "^(0x)?([0-9a-fA-F]{2})*$", description: "Bytes as hex." };
    case "bytes_n":
      return {
        type: "string",
        pattern: `^(0x)?[0-9a-fA-F]{${type.n * 2}}$`,
        description: `BytesN<${type.n}> as ${type.n * 2} hex characters.`,
      };
    case "string":
      return { type: "string", description: "String" };
    case "symbol":
      return { type: "string", pattern: "^[a-zA-Z0-9_]{0,32}$", description: "Symbol (up to 32 of a-z, A-Z, 0-9, _)." };
    case "address":
      return {
        type: "string",
        pattern: "^[GC][A-Z2-7]{55}$",
        description: "Address: an account (G…) or contract (C…).",
      };
    case "muxed_address":
      return { type: "string", pattern: "^[GMC][A-Z2-7]{55,}$", description: "MuxedAddress: G…, M… or C…." };
    case "val":
      return {
        type: "object",
        description: 'Untyped Val. Give an explicit type, e.g. { "type": "u32", "value": 1 }.',
        properties: { type: { type: "string" }, value: {} },
        required: ["type", "value"],
      };
    case "error":
      return { description: "Error" };
    case "option":
      return { description: label, anyOf: [{ type: "null" }, schemaFor(type.value, spec)] };
    case "result":
      return schemaFor(type.ok, spec);
    case "vec":
      return { type: "array", description: label, items: schemaFor(type.element, spec) };
    case "map":
      if (isStringKey(type.key, spec)) {
        return { type: "object", description: label, additionalProperties: schemaFor(type.value, spec) };
      }
      return {
        type: "array",
        description: `${label} as [[key, value], …] pairs.`,
        items: {
          type: "array",
          items: [schemaFor(type.key, spec), schemaFor(type.value, spec)],
          minItems: 2,
          maxItems: 2,
        },
      };
    case "tuple":
      return {
        type: "array",
        description: label,
        items: type.elements.map((t) => schemaFor(t, spec)),
        minItems: type.elements.length,
        maxItems: type.elements.length,
      };
    case "udt":
      return { $ref: `#/definitions/${type.name}` };
  }
}

function udtDefinitions(spec: ContractSpec): Record<string, JsonSchema> {
  const defs: Record<string, JsonSchema> = {};
  for (const udt of spec.types) {
    switch (udt.kind) {
      case "struct":
        if (isTupleStruct(udt.fields)) {
          defs[udt.name] = {
            type: "array",
            description: udt.doc ?? udt.name,
            items: udt.fields.map((f) => schemaFor(f.type, spec)),
            minItems: udt.fields.length,
            maxItems: udt.fields.length,
          };
        } else {
          defs[udt.name] = {
            type: "object",
            title: udt.name,
            description: udt.doc ?? `struct ${udt.name}`,
            properties: Object.fromEntries(
              udt.fields.map((f) => [f.name, { ...schemaFor(f.type, spec), description: f.doc ?? formatType(f.type) }]),
            ),
            required: udt.fields.map((f) => f.name),
            additionalProperties: false,
          };
        }
        break;
      case "union":
        defs[udt.name] = {
          title: udt.name,
          description: udt.doc ?? `enum ${udt.name}`,
          oneOf: udt.cases.map((c): JsonSchema =>
            c.kind === "void"
              ? { const: c.name, description: c.doc ?? c.name }
              : {
                  type: "object",
                  description: c.doc ?? `${c.name}(${c.types.map(formatType).join(", ")})`,
                  properties: {
                    tag: { const: c.name },
                    values: {
                      type: "array",
                      items: c.types.map((t) => schemaFor(t, spec)),
                      minItems: c.types.length,
                      maxItems: c.types.length,
                    },
                  },
                  required: ["tag", "values"],
                  additionalProperties: false,
                },
          ),
        };
        break;
      case "enum":
      case "error_enum":
        defs[udt.name] = {
          title: udt.name,
          description: udt.doc ?? `enum ${udt.name}: ${udt.cases.map((c) => `${c.name} = ${c.value}`).join(", ")}`,
          enum: [...udt.cases.map((c) => c.value), ...udt.cases.map((c) => c.name)],
        };
        break;
    }
  }
  return defs;
}

/** JSON Schema for the `{ argName: value }` object of a function call. */
export function argsJsonSchema(fn: FunctionSpec, spec: ContractSpec): JsonSchema {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: `${fn.name} arguments`,
    description: fn.doc,
    type: "object",
    properties: Object.fromEntries(
      fn.inputs.map((i) => {
        const s = schemaFor(i.type, spec);
        const description = [formatType(i.type), i.doc].filter(Boolean).join(" — ");
        return [i.name, s.$ref ? { allOf: [s], description } as JsonSchema : { ...s, description }];
      }),
    ),
    required: fn.inputs.map((i) => i.name),
    additionalProperties: false,
    definitions: udtDefinitions(spec),
  };
}
