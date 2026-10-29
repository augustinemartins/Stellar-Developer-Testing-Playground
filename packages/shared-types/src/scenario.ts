import { z } from "zod";
import { JsonValueSchema } from "./json";
import { NetworkConfigSchema } from "./network";
import { ContractSpecSchema } from "./spec";
import { SimulationReportSchema, SimulationStatusSchema } from "./report";

export const SCENARIO_SCHEMA_ID = "stellar-playground/scenario";
export const SCENARIO_VERSION = 1;

const contractId = z.string().regex(/^C[A-Z2-7]{55}$/, "must be a contract address (C…)");
const accountId = z.string().regex(/^[GM][A-Z2-7]{55,}$/, "must be an account address (G… or M…)");
const stroops = z.string().regex(/^\d+$/, "must be a non-negative integer string (stroops)");

export const AuthModeSchema = z.enum(["record", "enforce", "record_allow_nonroot"]);
export type AuthMode = z.infer<typeof AuthModeSchema>;

export const ScenarioExpectationsSchema = z
  .object({
    status: SimulationStatusSchema.optional(),
    /** Expected JSON rendering of the return value (see `DecodedValue.json`). */
    returnValue: JsonValueSchema.optional(),
    /** Expected contract error code, for scenarios that test failure paths. */
    contractErrorCode: z.number().int().optional(),
    /** Upper bound on the reported minimum resource fee. */
    maxResourceFee: stroops.optional(),
    /** Upper bound on CPU instructions. */
    maxInstructions: z.number().int().nonnegative().optional(),
    /** Exact number of contract (non-diagnostic) events. */
    contractEventCount: z.number().int().nonnegative().optional(),
    /** Addresses whose authorization must be required, in any order. */
    requiredAuth: z.array(z.string()).optional(),
  })
  .strict();
export type ScenarioExpectations = z.infer<typeof ScenarioExpectationsSchema>;

export const ScenarioSchema = z.object({
  schema: z.literal(SCENARIO_SCHEMA_ID),
  version: z.literal(SCENARIO_VERSION),
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  network: NetworkConfigSchema,
  contract: z.object({
    id: contractId,
    label: z.string().max(200).optional(),
    /** Spec snapshot so the scenario can be encoded and replayed without fetching WASM. */
    spec: ContractSpecSchema.optional(),
    wasmHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  }),
  invocation: z.object({
    method: z.string().min(1).max(64),
    /** Arguments keyed by parameter name, using the playground's JSON value conventions. */
    args: z.record(z.string(), JsonValueSchema),
    /** Source account for the simulated transaction. Omit to use a placeholder account. */
    source: accountId.optional(),
    authMode: AuthModeSchema.default("record"),
  }),
  expect: ScenarioExpectationsSchema.optional(),
  /** The run this scenario was saved from, kept for comparison and offline inspection. */
  recorded: z
    .object({
      at: z.iso.datetime(),
      latestLedger: z.number().int(),
      argsXdr: z.array(z.string()),
      transactionXdr: z.string(),
      report: SimulationReportSchema,
    })
    .optional(),
  createdWith: z.string().optional(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;
export type ScenarioInput = z.input<typeof ScenarioSchema>;

export const ScenarioCollectionSchema = z.object({
  schema: z.literal("stellar-playground/scenario-collection"),
  version: z.literal(SCENARIO_VERSION),
  exportedAt: z.iso.datetime(),
  scenarios: z.array(ScenarioSchema),
});
export type ScenarioCollection = z.infer<typeof ScenarioCollectionSchema>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`);
}

/**
 * Parses untrusted input (a file, a paste or a shared link) into scenarios.
 * Accepts a single scenario, an array of scenarios or a collection.
 */
export function parseScenarios(input: unknown): ParseResult<Scenario[]> {
  if (Array.isArray(input)) {
    const out: Scenario[] = [];
    const errors: string[] = [];
    input.forEach((item, i) => {
      const r = ScenarioSchema.safeParse(item);
      if (r.success) out.push(r.data);
      else errors.push(...formatIssues(r.error).map((e) => `[${i}] ${e}`));
    });
    return errors.length ? { ok: false, errors } : { ok: true, value: out };
  }
  if (input && typeof input === "object" && (input as { schema?: unknown }).schema === "stellar-playground/scenario-collection") {
    const r = ScenarioCollectionSchema.safeParse(input);
    return r.success ? { ok: true, value: r.data.scenarios } : { ok: false, errors: formatIssues(r.error) };
  }
  const r = ScenarioSchema.safeParse(input);
  return r.success ? { ok: true, value: [r.data] } : { ok: false, errors: formatIssues(r.error) };
}

export function parseScenarioJson(text: string): ParseResult<Scenario[]> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
  }
  return parseScenarios(data);
}
