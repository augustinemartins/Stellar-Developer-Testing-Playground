import { Account, Operation, StrKey, TransactionBuilder, contract, rpc, xdr, type Transaction } from "@stellar/stellar-sdk";
import type {
  AuthMode,
  ContractSpec,
  FunctionSpec,
  JsonValue,
  NetworkConfig,
  SimulationReport,
} from "@playground/shared-types";
import { parseSimulation, type RawSimulation } from "@playground/result-parser";
import { encodeArgs, type ArgError } from "./encode";
import { getServer } from "./network";

/** Account used as the transaction source when none is supplied. It never needs to exist. */
export const PLACEHOLDER_SOURCE = contract.NULL_ACCOUNT;
export const DEFAULT_INCLUSION_FEE = "100";

export interface SourceInfo {
  address: string;
  kind: "provided" | "placeholder";
  /** Whether the account exists on the network (unknown for the placeholder). */
  exists?: boolean;
  sequence?: string;
}

export interface InvocationRequest {
  network: Pick<NetworkConfig, "rpcUrl" | "networkPassphrase">;
  contractId: string;
  method: string;
  /** JSON arguments keyed by parameter name. */
  args: Record<string, JsonValue>;
  spec: ContractSpec;
  source?: string;
  authMode?: AuthMode;
  inclusionFee?: string;
  server?: rpc.Server;
}

export interface SimulationRun {
  startedAt: string;
  durationMs: number;
  contractId: string;
  method: string;
  args: Record<string, JsonValue>;
  argsXdr: string[];
  source: SourceInfo;
  authMode: AuthMode;
  transactionXdr: string;
  /** The JSON-RPC result exactly as returned, for export and offline re-parsing. */
  raw: RawSimulation;
  report: SimulationReport;
}

export class InvocationInputError extends Error {
  constructor(
    message: string,
    readonly errors: ArgError[],
  ) {
    super(message);
    this.name = "InvocationInputError";
  }
}

export function findFunction(spec: ContractSpec, method: string): FunctionSpec {
  const fn = spec.functions.find((f) => f.name === method);
  if (!fn) throw new InvocationInputError(`The contract has no function "${method}".`, [{ path: "method", message: `Unknown function "${method}"` }]);
  return fn;
}

async function resolveSource(server: rpc.Server, source: string | undefined): Promise<{ account: Account; info: SourceInfo }> {
  if (!source) {
    return { account: new Account(PLACEHOLDER_SOURCE, "0"), info: { address: PLACEHOLDER_SOURCE, kind: "placeholder" } };
  }
  const trimmed = source.trim();
  if (!StrKey.isValidEd25519PublicKey(trimmed) && !StrKey.isValidMed25519PublicKey(trimmed)) {
    const message = trimmed.startsWith("S")
      ? "That is a secret key. The playground only ever needs public keys (G…)."
      : "The source account must be a valid G… or M… address.";
    throw new InvocationInputError(message, [{ path: "source", message }]);
  }
  try {
    const account = await server.getAccount(trimmed);
    return { account, info: { address: trimmed, kind: "provided", exists: true, sequence: account.sequenceNumber() } };
  } catch {
    // Simulation does not require the source to exist, so carry on with sequence 0.
    return { account: new Account(trimmed, "0"), info: { address: trimmed, kind: "provided", exists: false } };
  }
}

/** Builds the unsigned invocation transaction that will be simulated. */
export function buildInvocationTransaction(opts: {
  source: Account;
  networkPassphrase: string;
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  inclusionFee?: string;
}): Transaction {
  return new TransactionBuilder(opts.source, {
    fee: opts.inclusionFee ?? DEFAULT_INCLUSION_FEE,
    networkPassphrase: opts.networkPassphrase,
  })
    .addOperation(Operation.invokeContractFunction({ contract: opts.contractId, function: opts.method, args: opts.args }))
    .setTimeout(0)
    .build();
}

function envelopeSize(tx: Transaction): number {
  return tx.toEnvelope().toXdr().length;
}

/**
 * Encodes arguments, builds the transaction and simulates it. Never signs or
 * submits anything.
 */
export async function simulateInvocation(req: InvocationRequest): Promise<SimulationRun> {
  const fn = findFunction(req.spec, req.method);
  const encoded = encodeArgs(fn, req.args, req.spec);
  if (!encoded.ok) throw new InvocationInputError("Some arguments are invalid.", encoded.errors);

  const server = req.server ?? getServer(req.network);
  const authMode = req.authMode ?? "record";
  const inclusionFee = req.inclusionFee ?? DEFAULT_INCLUSION_FEE;
  const started = Date.now();
  const { account, info } = await resolveSource(server, req.source);
  const tx = buildInvocationTransaction({
    source: account,
    networkPassphrase: req.network.networkPassphrase,
    contractId: req.contractId,
    method: req.method,
    args: encoded.values,
    inclusionFee,
  });

  const raw = await server._simulateTransaction(tx, undefined, authMode);

  let txSizeBytes = envelopeSize(tx);
  if (!raw.error) {
    try {
      txSizeBytes = envelopeSize(rpc.assembleTransaction(tx, raw).build());
    } catch {
      // keep the unassembled size
    }
  }

  return {
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    contractId: req.contractId,
    method: req.method,
    args: req.args,
    argsXdr: encoded.values.map((v) => v.toXdr("base64")),
    source: info,
    authMode,
    transactionXdr: tx.toXDR(),
    raw,
    report: parseSimulation(raw, { spec: req.spec, fn, contractId: req.contractId, inclusionFee, txSizeBytes }),
  };
}
