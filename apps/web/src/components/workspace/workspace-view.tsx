"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileUp, RefreshCw } from "lucide-react";
import { checkContractId } from "@playground/contract-loader";
import { useScenarioStore } from "@/lib/scenarios";
import { useSettings } from "@/lib/settings";
import { ResultPanel } from "../results/result-panel";
import { Alert, Badge, Button, CopyButton, EmptyState, Spinner } from "../ui";
import { FunctionPanel } from "./function-panel";
import { MethodList } from "./method-list";
import { useWorkspace } from "./use-workspace";

export function WorkspaceRoute() {
  const params = useSearchParams();
  const store = useScenarioStore();
  const scenarioId = params.get("scenario");
  const scenario = scenarioId ? store.get(scenarioId) : null;
  const contractId = params.get("contract") ?? scenario?.contract.id ?? "";

  if (scenarioId && !scenario) {
    return (
      <EmptyState title="Scenario not found">
        It may have been deleted, or saved in another browser.{" "}
        <Link className="underline" href="/scenarios">
          Back to scenarios
        </Link>
      </EmptyState>
    );
  }
  const check = checkContractId(contractId);
  if (!check.ok) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Alert tone="bad" title="Invalid contract ID" role="alert">
          {check.reason}{" "}
          <Link className="underline" href="/">
            Go back
          </Link>
        </Alert>
      </div>
    );
  }
  // Key by contract + scenario so switching resets all workspace state.
  return (
    <WorkspaceView
      key={`${check.value}:${scenario?.id ?? ""}`}
      contractId={check.value}
      sampleSlug={params.get("sample")}
      initialMethod={params.get("fn")}
      scenario={scenario ?? null}
    />
  );
}

function WorkspaceView(props: Parameters<typeof useWorkspace>[0]) {
  const ws = useWorkspace(props);
  const { network, selectPreset } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const { load } = ws;

  const importInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".json,.wasm,.txt,application/json,application/wasm"
      className="sr-only"
      aria-label="Import contract spec"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setImportError(null);
        try {
          await ws.importSpec(file);
        } catch (err) {
          setImportError((err as Error).message);
        }
      }}
    />
  );

  if (load.status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label={`Loading contract interface from ${network.label}…`} />
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-8">
        <Alert
          tone="bad"
          role="alert"
          title={
            load.code === "not_found"
              ? "Contract not found"
              : load.code === "no_spec"
                ? "No contract interface"
                : "Could not load the contract"
          }
        >
          <p>{load.message}</p>
          {load.hint && <p className="mt-1 text-muted">{load.hint}</p>}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button onClick={ws.reload}>
            <RefreshCw aria-hidden className="size-4" /> Retry
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <FileUp aria-hidden className="size-4" /> Import spec (JSON, XDR or .wasm)
          </Button>
          {network.id !== "testnet" && <Button onClick={() => selectPreset("testnet")}>Switch to testnet</Button>}
          <Link href="/" className="inline-flex h-9 items-center px-3 text-sm underline">
            Choose another contract
          </Link>
          {importInput}
        </div>
        {importError && <Alert tone="bad">{importError}</Alert>}
      </div>
    );
  }

  const c = load.contract;
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      <div className="border-b border-border bg-panel">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
          <h1 className="text-base font-semibold">{load.label ?? "Contract"}</h1>
          <code className="hidden font-mono text-xs text-muted sm:inline">{c.contractId}</code>
          <CopyButton text={c.contractId} label="Copy ID" />
          <Badge>{network.label}</Badge>
          <Badge tone={c.specSource === "network" ? "ok" : "neutral"} title="Where the contract interface came from">
            spec:{" "}
            {c.specSource === "network"
              ? "on-chain WASM"
              : c.specSource === "builtin"
                ? "built-in SAC"
                : c.specSource === "fixture"
                  ? "repo fixture"
                  : "imported"}
          </Badge>
          {c.executable.type === "stellar_asset" && <Badge tone="info">Stellar Asset Contract</Badge>}
          {"wasmHash" in c.executable && c.executable.wasmHash && (
            <Badge title={c.executable.wasmHash}>wasm {c.executable.wasmHash.slice(0, 10)}…</Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              <FileUp aria-hidden className="size-3.5" /> Import spec
            </Button>
            <Button size="sm" variant="ghost" onClick={ws.reload}>
              <RefreshCw aria-hidden className="size-3.5" /> Reload
            </Button>
            {importInput}
          </div>
        </div>
        {(load.warning || importError) && (
          <div className="mx-auto max-w-[1600px] px-4 pb-2.5">
            {load.warning && <Alert tone="warn">{load.warning}</Alert>}
            {importError && <Alert tone="bad">{importError}</Alert>}
          </div>
        )}
      </div>

      {ws.functions.length === 0 ? (
        <EmptyState title="This contract exposes no callable functions" />
      ) : (
        <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(360px,1fr)_minmax(420px,1.25fr)]">
          <aside className="border-b border-border bg-panel lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:border-b-0 lg:border-r">
            <div className="max-h-72 lg:h-full lg:max-h-none">
              <MethodList functions={ws.functions} selected={ws.method} onSelect={ws.setMethod} />
            </div>
          </aside>
          <section aria-label="Function inputs" className="border-b border-border bg-panel px-4 pt-4 lg:border-b-0 lg:border-r">
            <FunctionPanel ws={ws} />
          </section>
          <div className="min-h-[24rem] bg-panel lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]">
            <ResultPanel ws={ws} />
          </div>
        </div>
      )}
    </div>
  );
}
