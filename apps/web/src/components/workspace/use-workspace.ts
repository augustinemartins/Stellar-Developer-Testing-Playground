"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ContractLoadError,
  exampleArgs,
  findSample,
  loadContractFromNetwork,
  specFromWasm,
  specFromXdr,
  type LoadedContract,
  type SampleContract,
} from "@playground/contract-loader";
import {
  ContractSpecSchema,
  NETWORKS,
  type AuthMode,
  type ContractSpec,
  type JsonValue,
  type Scenario,
} from "@playground/shared-types";
import {
  InvocationInputError,
  fetchNetworkLimits,
  getServer,
  simulateInvocation,
  validateArgs,
  type ArgError,
  type SimulationRun,
} from "@playground/simulation-engine";
import type { NetworkLimits } from "@playground/shared-types";
import { useSettings } from "@/lib/settings";

export type LoadState =
  | { status: "loading" }
  | { status: "ready"; contract: LoadedContract; label?: string; sample?: SampleContract; warning?: string }
  | { status: "error"; code: ContractLoadError["code"] | "unknown"; message: string; hint?: string };

export interface RunError {
  kind: "input" | "network";
  message: string;
  errors?: ArgError[];
}

export interface WorkspaceOptions {
  contractId: string;
  sampleSlug?: string | null;
  initialMethod?: string | null;
  scenario?: Scenario | null;
}

const MAX_HISTORY = 20;

/** Parses a user-supplied spec file: playground JSON, a fixture, base64 XDR entries, or a WASM binary. */
export async function parseSpecFile(file: File): Promise<ContractSpec> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) return specFromWasm(bytes);
  const text = new TextDecoder().decode(bytes);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // A bare base64 XDR stream, e.g. from `stellar contract info interface --output xdr-base64`.
    return specFromXdr(text.trim());
  }
  if (Array.isArray(data) && data.every((d) => typeof d === "string")) return specFromXdr(data as string[]);
  const candidate = data && typeof data === "object" && "spec" in data ? (data as { spec: unknown }).spec : data;
  const parsed = ContractSpecSchema.safeParse(candidate);
  if (!parsed.success) throw new Error("This file is not a contract spec (expected playground spec JSON, base64 XDR entries or a .wasm file).");
  return parsed.data;
}

export function useWorkspace({ contractId, sampleSlug, initialMethod, scenario }: WorkspaceOptions) {
  const { network, setNetwork, addRecent } = useSettings();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [method, setMethod] = useState<string | null>(initialMethod ?? scenario?.invocation.method ?? null);
  const [argsByMethod, setArgsByMethod] = useState<Record<string, Record<string, JsonValue>>>(
    scenario ? { [scenario.invocation.method]: scenario.invocation.args } : {},
  );
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [source, setSource] = useState(scenario?.invocation.source ?? "");
  const [authMode, setAuthMode] = useState<AuthMode>(scenario?.invocation.authMode ?? "record");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<RunError | null>(null);
  const [history, setHistory] = useState<SimulationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState(0);
  const [limits, setLimits] = useState<NetworkLimits | null>(null);
  const abortRef = useRef(0);

  // A scenario carries its own network; adopt it so replays are faithful.
  useEffect(() => {
    if (scenario && scenario.network.networkPassphrase !== network.networkPassphrase) {
      const preset = Object.values(NETWORKS).find((n) => n.networkPassphrase === scenario.network.networkPassphrase);
      setNetwork(preset ?? { ...scenario.network, label: "Custom" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario?.id]);

  // Samples only exist on testnet.
  const sample = useMemo(() => (sampleSlug ? findSample(sampleSlug) : findSample(contractId)), [sampleSlug, contractId]);
  useEffect(() => {
    if (sample && !scenario && network.id !== "testnet" && sample.contractId === contractId) setNetwork(NETWORKS.testnet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample?.slug]);

  useEffect(() => {
    let cancelled = false;
    const ticket = ++abortRef.current;
    setLoad({ status: "loading" });
    setHistory([]);
    setRunError(null);

    const ready = (contract: LoadedContract, label?: string, warning?: string) => {
      if (cancelled || ticket !== abortRef.current) return;
      setLoad({ status: "ready", contract, label, sample: sample?.contractId === contractId ? sample : undefined, warning });
      addRecent({ contractId: contract.contractId, networkPassphrase: contract.networkPassphrase, label });
    };

    const base = { contractId, networkPassphrase: network.networkPassphrase, loadedAt: new Date().toISOString() };
    const isSampleOnTestnet = sample?.contractId === contractId && network.id === "testnet";

    if (scenario?.contract.spec && scenario.contract.id === contractId) {
      ready(
        {
          ...base,
          executable: scenario.contract.wasmHash ? { type: "wasm", wasmHash: scenario.contract.wasmHash } : { type: "unknown" },
          spec: scenario.contract.spec,
          specSource: "inline",
        },
        scenario.contract.label ?? scenario.name,
      );
      return () => {
        cancelled = true;
      };
    }

    if (isSampleOnTestnet && sample) {
      // Fixture first for an instant UI; then confirm the deployment still exists.
      ready(
        { ...base, executable: sample.wasmHash ? { type: "wasm", wasmHash: sample.wasmHash } : { type: "stellar_asset" }, spec: sample.spec, specSource: "fixture" },
        sample.title,
      );
      loadContractFromNetwork(contractId, network).catch((e) => {
        if (e instanceof ContractLoadError && e.code === "not_found") {
          ready(
            { ...base, executable: sample.wasmHash ? { type: "wasm", wasmHash: sample.wasmHash } : { type: "stellar_asset" }, spec: sample.spec, specSource: "fixture" },
            sample.title,
            "This sample is not deployed on testnet right now (testnet is reset periodically). Simulations will fail until it is redeployed with `pnpm contracts:deploy`.",
          );
        }
      });
      return () => {
        cancelled = true;
      };
    }

    loadContractFromNetwork(contractId, network)
      .then((c) => ready(c))
      .catch((e: unknown) => {
        if (cancelled || ticket !== abortRef.current) return;
        if (e instanceof ContractLoadError) setLoad({ status: "error", code: e.code, message: e.message, hint: e.hint });
        else setLoad({ status: "error", code: "unknown", message: (e as Error).message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, network.rpcUrl, network.networkPassphrase, reloadKey, scenario?.id]);

  useEffect(() => {
    let cancelled = false;
    fetchNetworkLimits(getServer(network)).then((l) => !cancelled && setLimits(l));
    return () => {
      cancelled = true;
    };
  }, [network]);

  const spec = load.status === "ready" ? load.contract.spec : null;
  const functions = useMemo(() => spec?.functions.filter((f) => !f.name.startsWith("__")) ?? [], [spec]);

  // Pick a default method once the spec is known.
  useEffect(() => {
    if (!spec) return;
    if (!method || !functions.some((f) => f.name === method)) setMethod(functions[0]?.name ?? null);
  }, [spec, functions, method]);

  const fn = functions.find((f) => f.name === method) ?? null;
  const args = useMemo<Record<string, JsonValue>>(
    () => (fn && spec ? (argsByMethod[fn.name] ?? exampleArgs(fn, spec)) : {}),
    [fn, spec, argsByMethod],
  );
  const argErrors = useMemo(() => (fn && spec ? validateArgs(fn, args, spec) : []), [fn, spec, args]);

  const setArgs = useCallback(
    (next: Record<string, JsonValue>) => {
      if (!fn) return;
      setArgsByMethod((prev) => ({ ...prev, [fn.name]: next }));
    },
    [fn],
  );
  const setArg = useCallback((name: string, value: JsonValue) => fn && setArgs({ ...args, [name]: value }), [fn, args, setArgs]);
  const setDraftError = useCallback(
    (name: string, message: string | null) =>
      setDraftErrors((prev) => {
        if (!message) {
          const { [name]: _drop, ...rest } = prev;
          return rest;
        }
        return { ...prev, [name]: message };
      }),
    [],
  );

  const simulate = useCallback(async () => {
    if (!fn || !spec || load.status !== "ready" || running) return;
    if (Object.keys(draftErrors).length) {
      setRunError({ kind: "input", message: "Fix the JSON syntax errors before simulating." });
      return;
    }
    setRunning(true);
    setRunError(null);
    try {
      const run = await simulateInvocation({
        network,
        contractId: load.contract.contractId,
        method: fn.name,
        args,
        spec,
        source: source.trim() || undefined,
        authMode,
      });
      setHistory((h) => [run, ...h].slice(0, MAX_HISTORY));
      setSelectedRun(0);
    } catch (e) {
      if (e instanceof InvocationInputError) setRunError({ kind: "input", message: e.message, errors: e.errors });
      else setRunError({ kind: "network", message: `The RPC request failed: ${(e as Error).message}` });
    } finally {
      setRunning(false);
    }
  }, [fn, spec, load, running, draftErrors, network, args, source, authMode]);

  const importSpec = useCallback(
    async (file: File) => {
      const spec = await parseSpecFile(file);
      setLoad({
        status: "ready",
        contract: { contractId, networkPassphrase: network.networkPassphrase, executable: { type: "unknown" }, spec, specSource: "inline", loadedAt: new Date().toISOString() },
        label: file.name,
        warning: "Using an imported spec. Simulations still run against the deployed contract, so the spec must match it.",
      });
    },
    [contractId, network.networkPassphrase],
  );

  const applySuggested = useCallback((m: string, a: Record<string, JsonValue>) => {
    setMethod(m);
    setArgsByMethod((prev) => ({ ...prev, [m]: a }));
    setDraftErrors({});
  }, []);

  return {
    network,
    load,
    reload: () => setReloadKey((k) => k + 1),
    importSpec,
    functions,
    fn,
    method,
    setMethod: (m: string) => {
      setMethod(m);
      setDraftErrors({});
      setRunError(null);
    },
    args,
    setArgs,
    setArg,
    argErrors,
    draftErrors,
    setDraftError,
    source,
    setSource,
    authMode,
    setAuthMode,
    running,
    runError,
    simulate,
    history,
    run: history[selectedRun] ?? null,
    selectedRun,
    setSelectedRun,
    limits,
    applySuggested,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
