"use client";
import { useState } from "react";
import { AlertOctagon, CheckCircle2, RotateCcw } from "lucide-react";
import { contractEvents, estimatedTotalFee, formatStroops } from "@playground/result-parser";
import type { SimulationRun } from "@playground/simulation-engine";
import { Alert, Badge, CopyButton, Mono, shorten } from "../ui";
import { JsonBlock, ValueTree } from "../value-view";

export function OverviewTab({ run }: { run: SimulationRun }) {
  const r = run.report;
  const [view, setView] = useState<"json" | "tree">("json");
  const total = estimatedTotalFee(r);

  return (
    <div className="space-y-4 p-4">
      <StatusBanner run={run} />

      {r.error && (
        <section aria-labelledby="err-h" className="space-y-2">
          <h3 id="err-h" className="text-sm font-semibold">
            What went wrong
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Kind</dt>
            <dd>
              <Badge tone="bad">{r.error.kind}</Badge>
            </dd>
            {r.error.contractErrorName && (
              <>
                <dt className="text-muted">Contract error</dt>
                <dd className="font-mono">
                  {r.error.contractErrorName} (#{r.error.contractErrorCode})
                </dd>
              </>
            )}
            {r.error.hostErrorType && !r.error.contractErrorName && (
              <>
                <dt className="text-muted">Host error</dt>
                <dd className="font-mono">
                  Error({r.error.hostErrorType}, {r.error.hostErrorCode})
                </dd>
              </>
            )}
          </dl>
          {r.error.hint && <Alert tone="info" title="Hint">{r.error.hint}</Alert>}
          <details className="rounded-md border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm">Full error from the RPC</summary>
            <pre className="max-h-80 overflow-auto border-t border-border bg-panel-2 p-3 font-mono text-[11.5px] leading-5 whitespace-pre-wrap">{r.error.raw}</pre>
          </details>
          <p className="text-xs text-muted">The Events tab shows the diagnostic trace leading up to the failure.</p>
        </section>
      )}

      {r.returnValue && (
        <section aria-labelledby="ret-h" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="ret-h" className="flex items-center gap-2 text-sm font-semibold">
              Return value <Badge>{r.returnValue.type}</Badge>
            </h3>
            <div className="flex items-center gap-1">
              <div role="group" aria-label="Return value view" className="inline-flex rounded-md border border-border p-0.5 text-xs">
                {(["json", "tree"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={view === v ? "rounded bg-panel-2 px-2 py-0.5 font-medium" : "px-2 py-0.5 text-muted"}>
                    {v === "json" ? "JSON" : "Typed tree"}
                  </button>
                ))}
              </div>
              <CopyButton text={JSON.stringify(r.returnValueTyped ?? r.returnValue.json, null, 2)} label="Copy JSON" />
              <CopyButton text={r.returnValue.xdr} label="Copy XDR" />
            </div>
          </div>
          {view === "json" ? (
            <JsonBlock value={r.returnValueTyped !== undefined ? r.returnValueTyped : r.returnValue.json} />
          ) : (
            <div className="rounded-md border border-border bg-panel-2 p-3">
              <ValueTree xdr={r.returnValue.xdr} />
            </div>
          )}
          {r.returnValueTyped !== undefined && JSON.stringify(r.returnValueTyped) !== JSON.stringify(r.returnValue.json) && (
            <p className="text-xs text-muted">Decoded with the function&apos;s declared return type. The typed tree shows the raw ScVal.</p>
          )}
        </section>
      )}

      <section aria-labelledby="sum-h">
        <h3 id="sum-h" className="sr-only">
          Summary
        </h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Estimated fee" value={total !== undefined ? formatStroops(total) : "—"} detail={total !== undefined ? `${total.toLocaleString("en-US")} stroops` : "not available on error"} />
          <Stat label="CPU instructions" value={r.resources ? r.resources.instructions.toLocaleString("en-US") : "—"} />
          <Stat label="Contract events" value={String(contractEvents(r).length)} detail={`${r.events.length} incl. diagnostics`} />
          <Stat label="Signatures needed" value={String(r.auth.length)} />
        </dl>
      </section>

      <section aria-labelledby="ctx-h" className="text-xs text-muted">
        <h3 id="ctx-h" className="sr-only">
          Context
        </h3>
        <p>
          Simulated at ledger <Mono>{r.latestLedger.toLocaleString("en-US")}</Mono> in {run.durationMs} ms · source{" "}
          <Mono title={run.source.address}>{shorten(run.source.address)}</Mono>{" "}
          {run.source.kind === "placeholder" ? "(placeholder)" : run.source.exists === false ? "(not funded on this network)" : ""} · auth mode{" "}
          <Mono>{run.authMode}</Mono>
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-base font-semibold">{value}</dd>
      {detail && <dd className="text-[11px] text-muted">{detail}</dd>}
    </div>
  );
}

function StatusBanner({ run }: { run: SimulationRun }) {
  const r = run.report;
  if (r.status === "success") {
    return (
      <div role="status" className="flex items-center gap-2 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-sm">
        <CheckCircle2 aria-hidden className="size-4 text-ok" />
        <span>
          <strong>Simulation succeeded.</strong> <span className="font-mono">{run.method}</span> would execute with these arguments.
        </span>
      </div>
    );
  }
  if (r.status === "restore_required") {
    return (
      <Alert tone="warn" role="status" title="Succeeds after restoring archived state">
        {r.restore?.entries.length ?? 0} ledger entries are archived and must be restored (min fee {r.restore?.minResourceFee} stroops) before this call can be submitted.
        <RotateCcw aria-hidden className="hidden" />
      </Alert>
    );
  }
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-bad/30 bg-bad/10 px-3 py-2 text-sm">
      <AlertOctagon aria-hidden className="mt-0.5 size-4 shrink-0 text-bad" />
      <span>
        <strong>Simulation failed.</strong> {r.error?.summary}
      </span>
    </div>
  );
}
