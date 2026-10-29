import { StrKey, rpc } from "@stellar/stellar-sdk";
import { bytesToHex, type ContractSpec, type NetworkConfig } from "@playground/shared-types";
import { specFromWasm } from "./normalize";
import stellarAssetFixture from "./fixtures/stellar-asset.spec.json";

export type ContractExecutableInfo =
  | { type: "wasm"; wasmHash: string }
  | { type: "stellar_asset" }
  | { type: "external"; wasmHash: string }
  /** The spec was supplied directly (imported file or scenario), so the executable was not inspected. */
  | { type: "unknown" };

export interface LoadedContract {
  contractId: string;
  networkPassphrase: string;
  executable: ContractExecutableInfo;
  spec: ContractSpec;
  /** Where the spec came from. */
  specSource: "network" | "fixture" | "builtin" | "inline";
  wasmSize?: number;
  loadedAt: string;
}

export type ContractLoadErrorCode = "invalid_id" | "not_found" | "no_spec" | "network";

export class ContractLoadError extends Error {
  constructor(
    readonly code: ContractLoadErrorCode,
    message: string,
    readonly hint?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ContractLoadError";
  }
}

export const STELLAR_ASSET_SPEC = stellarAssetFixture.spec as ContractSpec;

export type ContractIdCheck = { ok: true; value: string } | { ok: false; reason: string };

/** Validates a contract address, with friendly messages for common mistakes. */
export function checkContractId(input: string): ContractIdCheck {
  const value = input.trim();
  if (!value) return { ok: false, reason: "Enter a contract ID." };
  if (/^[GM]/.test(value) && (StrKey.isValidEd25519PublicKey(value) || StrKey.isValidMed25519PublicKey(value))) {
    return { ok: false, reason: "That is an account address (G… / M…). Contract IDs start with C." };
  }
  if (/^[0-9a-f]{64}$/i.test(value)) {
    return { ok: false, reason: "That looks like a hex hash. Paste the strkey contract address (C…) instead." };
  }
  if (!value.startsWith("C")) return { ok: false, reason: "Contract IDs start with C." };
  if (value !== value.toUpperCase()) return { ok: false, reason: "Contract IDs are upper-case." };
  if (value.length !== 56) return { ok: false, reason: `Contract IDs are 56 characters long (this one has ${value.length}).` };
  if (!StrKey.isValidContract(value)) return { ok: false, reason: "The checksum does not match. Check for a typo." };
  return { ok: true, value };
}

const specCache = new Map<string, ContractSpec>();

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isNotFound(e: unknown): boolean {
  return /not found|could not find|no .* entry|404/i.test(errorMessage(e));
}

/**
 * Resolves a deployed contract's executable and spec from the network.
 *
 * - WASM contracts: the WASM is fetched and its `contractspecv0` section parsed.
 * - Stellar Asset Contracts: the built-in token interface is used.
 */
export async function loadContractFromNetwork(
  contractId: string,
  network: Pick<NetworkConfig, "rpcUrl" | "networkPassphrase">,
  options: { server?: rpc.Server; signal?: AbortSignal } = {},
): Promise<LoadedContract> {
  const check = checkContractId(contractId);
  if (!check.ok) throw new ContractLoadError("invalid_id", check.reason);
  const server =
    options.server ?? new rpc.Server(network.rpcUrl, { allowHttp: network.rpcUrl.startsWith("http://") });

  let instance: Awaited<ReturnType<rpc.Server["getContractInstance"]>>;
  try {
    instance = await server.getContractInstance(check.value);
  } catch (e) {
    if (isNotFound(e)) {
      throw new ContractLoadError(
        "not_found",
        `No contract ${check.value} exists on this network.`,
        "Check the network selector. Testnet is reset periodically, so older sample deployments disappear; see docs/deploying-samples.md.",
        { cause: e },
      );
    }
    throw new ContractLoadError("network", `Could not reach the RPC at ${network.rpcUrl}: ${errorMessage(e)}`, undefined, {
      cause: e,
    });
  }
  options.signal?.throwIfAborted();

  const base = { contractId: check.value, networkPassphrase: network.networkPassphrase, loadedAt: new Date().toISOString() };
  const exe = instance.executable;
  if (exe.type === "contractExecutableStellarAsset") {
    return { ...base, executable: { type: "stellar_asset" }, spec: STELLAR_ASSET_SPEC, specSource: "builtin" };
  }

  let wasmHash: string;
  let type: "wasm" | "external";
  if (exe.type === "contractExecutableWasm") {
    wasmHash = bytesToHex(exe.wasmHash.toXdr());
    type = "wasm";
  } else {
    wasmHash = bytesToHex(await server.getExternalRefWasmHash(exe.externalRef));
    type = "external";
  }

  const cacheKey = `${network.networkPassphrase}:${wasmHash}`;
  const cached = specCache.get(cacheKey);
  if (cached) return { ...base, executable: { type, wasmHash }, spec: cached, specSource: "network" };

  let wasm: Uint8Array;
  try {
    wasm = await server.getContractWasmByHash(wasmHash, "hex");
  } catch (e) {
    throw new ContractLoadError(
      isNotFound(e) ? "not_found" : "network",
      `Could not fetch the contract's WASM (${wasmHash.slice(0, 12)}…): ${errorMessage(e)}`,
      "The code entry may be archived. Restore it, or import the spec from a JSON file instead.",
      { cause: e },
    );
  }
  let spec: ContractSpec;
  try {
    spec = specFromWasm(wasm);
  } catch (e) {
    throw new ContractLoadError(
      "no_spec",
      "The contract WASM has no readable contractspecv0 section.",
      "Contracts built without soroban-sdk metadata cannot be introspected. Import a spec JSON instead.",
      { cause: e },
    );
  }
  specCache.set(cacheKey, spec);
  return { ...base, executable: { type, wasmHash }, spec, specSource: "network", wasmSize: wasm.length };
}
