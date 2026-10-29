import { z } from "zod";
import { JsonValueSchema } from "./json";

/** An ScVal decoded for display: the exact XDR plus a JSON-friendly rendering. */
export const DecodedValueSchema = z.object({
  /** Base64 XDR of the `ScVal`; the source of truth. */
  xdr: z.string(),
  /** Short ScVal type tag such as `i128`, `vec`, `map`, `address`. */
  type: z.string(),
  /** JSON-friendly value using the same conventions as argument input. */
  json: JsonValueSchema,
});
export type DecodedValue = z.infer<typeof DecodedValueSchema>;

export const LedgerKeyInfoSchema = z.object({
  type: z.string(),
  xdr: z.string(),
  /** A one-line, human readable summary such as `contract_data(CABC…, Balance(GA…), persistent)`. */
  label: z.string(),
  contractId: z.string().optional(),
  accountId: z.string().optional(),
  durability: z.enum(["persistent", "temporary"]).optional(),
  key: DecodedValueSchema.optional(),
});
export type LedgerKeyInfo = z.infer<typeof LedgerKeyInfoSchema>;

export type InvocationNode = {
  kind: "contract_fn" | "create_contract" | "unknown";
  contractId?: string;
  functionName?: string;
  args: { type: string; json: unknown }[];
  subInvocations: InvocationNode[];
};
export const InvocationNodeSchema: z.ZodType<InvocationNode> = z.lazy(() =>
  z.object({
    kind: z.enum(["contract_fn", "create_contract", "unknown"]),
    contractId: z.string().optional(),
    functionName: z.string().optional(),
    args: z.array(z.object({ type: z.string(), json: z.unknown() })),
    subInvocations: z.array(InvocationNodeSchema),
  }),
);

export const AuthEntryInfoSchema = z.object({
  /** `source_account` means the transaction source signs implicitly. */
  credentials: z.enum(["source_account", "address"]),
  address: z.string().optional(),
  nonce: z.string().optional(),
  signatureExpirationLedger: z.number().optional(),
  invocation: InvocationNodeSchema,
  xdr: z.string(),
});
export type AuthEntryInfo = z.infer<typeof AuthEntryInfoSchema>;

export const DecodedEventSchema = z.object({
  index: z.number(),
  type: z.enum(["contract", "system", "diagnostic"]),
  contractId: z.string().optional(),
  inSuccessfulContractCall: z.boolean(),
  topics: z.array(DecodedValueSchema),
  data: DecodedValueSchema,
  /** Name of the matching `#[contractevent]` from the spec, or a diagnostic marker such as `fn_call`. */
  name: z.string().optional(),
  /** Event params decoded with the spec, when a matching event definition exists. */
  params: z.record(z.string(), JsonValueSchema).optional(),
  xdr: z.string(),
});
export type DecodedEvent = z.infer<typeof DecodedEventSchema>;

export const StateChangeSchema = z.object({
  type: z.enum(["created", "updated", "deleted", "restored"]),
  key: LedgerKeyInfoSchema,
  before: DecodedValueSchema.optional(),
  after: DecodedValueSchema.optional(),
});
export type StateChange = z.infer<typeof StateChangeSchema>;

export const ErrorKindSchema = z.enum([
  /** The contract returned one of its own error codes (`Error(Contract, #n)`). */
  "contract",
  /** The host rejected the call (budget, storage, auth, value conversion...). */
  "host",
  /** The RPC rejected the request or returned an unexpected payload. */
  "rpc",
  /** The RPC could not be reached. */
  "network",
  /** The playground refused to build the transaction (bad input). */
  "validation",
]);
export type ErrorKind = z.infer<typeof ErrorKindSchema>;

export const SimulationErrorSchema = z.object({
  kind: ErrorKindSchema,
  /** One-line summary suitable for headings and screen readers. */
  summary: z.string(),
  /** Actionable hint, when the playground recognises the failure. */
  hint: z.string().optional(),
  /** Host error type, e.g. `Contract`, `Budget`, `Storage`, `Auth`. */
  hostErrorType: z.string().optional(),
  /** Host error code, e.g. `ExceededLimit`, or the contract error number as a string. */
  hostErrorCode: z.string().optional(),
  contractErrorCode: z.number().optional(),
  contractErrorName: z.string().optional(),
  contractErrorDoc: z.string().optional(),
  /** Full error text as returned by the RPC. */
  raw: z.string(),
});
export type SimulationError = z.infer<typeof SimulationErrorSchema>;

export const ResourceUsageSchema = z.object({
  instructions: z.number(),
  diskReadBytes: z.number(),
  writeBytes: z.number(),
  readOnlyEntries: z.number(),
  readWriteEntries: z.number(),
  /** Size of the simulated transaction envelope in bytes. */
  txSizeBytes: z.number().optional(),
  footprint: z.object({
    readOnly: z.array(LedgerKeyInfoSchema),
    readWrite: z.array(LedgerKeyInfoSchema),
  }),
});
export type ResourceUsage = z.infer<typeof ResourceUsageSchema>;

export const NetworkLimitsSchema = z.object({
  txMaxInstructions: z.number(),
  txMaxDiskReadBytes: z.number(),
  txMaxWriteBytes: z.number(),
  txMaxDiskReadEntries: z.number(),
  txMaxWriteLedgerEntries: z.number(),
  txMaxSizeBytes: z.number(),
  /** Whether these came from the network (`live`) or are documented defaults (`default`). */
  source: z.enum(["live", "default"]),
});
export type NetworkLimits = z.infer<typeof NetworkLimitsSchema>;

export const SimulationStatusSchema = z.enum(["success", "error", "restore_required"]);
export type SimulationStatus = z.infer<typeof SimulationStatusSchema>;

export const SimulationReportSchema = z.object({
  status: SimulationStatusSchema,
  latestLedger: z.number(),
  returnValue: DecodedValueSchema.optional(),
  /** Return value decoded with the function's declared output type (e.g. unions as `{tag, values}`). */
  returnValueTyped: JsonValueSchema.optional(),
  fees: z
    .object({
      /** Minimum resource fee in stroops reported by the simulation. */
      minResourceFee: z.string(),
      /** Inclusion fee used when building the transaction, in stroops. */
      inclusionFee: z.string(),
    })
    .optional(),
  resources: ResourceUsageSchema.optional(),
  auth: z.array(AuthEntryInfoSchema),
  events: z.array(DecodedEventSchema),
  stateChanges: z.array(StateChangeSchema),
  error: SimulationErrorSchema.optional(),
  restore: z
    .object({
      minResourceFee: z.string(),
      entries: z.array(LedgerKeyInfoSchema),
    })
    .optional(),
});
export type SimulationReport = z.infer<typeof SimulationReportSchema>;
