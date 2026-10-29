"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { DecodedEvent } from "@playground/shared-types";
import type { SimulationRun } from "@playground/simulation-engine";
import { Badge, CopyButton, EmptyState, cx, inputClass, shorten } from "../ui";
import { JsonInline, ValueTree } from "../value-view";

type Filter = "contract" | "all";

/** Nesting depth of each event, derived from fn_call / fn_return diagnostic markers. */
function depths(events: DecodedEvent[]): number[] {
  let d = 0;
  return events.map((e) => {
    if (e.name === "fn_return") d = Math.max(0, d - 1);
    const current = d;
    if (e.name === "fn_call") d++;
    return current;
  });
}

function EventRow({ ev, depth, contractId }: { ev: DecodedEvent; depth: number; contractId: string }) {
  const [open, setOpen] = useState(false);
  const tone = ev.type === "contract" ? "accent" : ev.type === "system" ? "info" : "neutral";
  const foreign = ev.contractId && ev.contractId !== contractId;
  const isMarker = ev.name === "fn_call" || ev.name === "fn_return";
  const summary = isMarker
    ? ev.name === "fn_call"
      ? `→ ${String(ev.params?.function ?? ev.topics[2]?.json ?? "")}(${ev.data.type === "vec" ? (Array.isArray(ev.data.json) ? ev.data.json.length : 0) : ev.data.type === "void" ? 0 : 1} args)`
      : `← ${String(ev.topics[1]?.json ?? "")} returned`
    : null;

  return (
    <li style={{ paddingLeft: `${depth * 1.1}rem` }}>
      <div className={cx("rounded-md border", ev.type === "contract" ? "border-accent/30 bg-accent/[0.03]" : "border-border")}>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-2 px-2.5 py-1.5 text-left text-sm">
          <span className="w-6 font-mono text-[11px] text-muted">#{ev.index}</span>
          <Badge tone={tone}>{ev.type}</Badge>
          <span className="font-mono font-medium">{ev.name ?? "(unnamed)"}</span>
          {summary && <span className="font-mono text-xs text-muted">{summary}</span>}
          {!isMarker && ev.params && <JsonInline value={ev.params} className="truncate text-xs text-muted" />}
          {foreign && (
            <Badge tone="info" title={ev.contractId}>
              {shorten(ev.contractId!, 4)}
            </Badge>
          )}
          {!ev.inSuccessfulContractCall && ev.type !== "diagnostic" && <Badge tone="bad">rolled back</Badge>}
        </button>
        {open && (
          <div className="space-y-2 border-t border-border px-3 py-2 text-xs">
            {ev.contractId && (
              <p>
                <span className="text-muted">Contract </span>
                <code className="font-mono">{ev.contractId}</code>
              </p>
            )}
            <div>
              <div className="mb-0.5 font-semibold text-muted">Topics</div>
              <ol className="space-y-0.5">
                {ev.topics.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted">{i}</span>
                    <Badge>{t.type}</Badge>
                    <JsonInline value={t.json} />
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="mb-0.5 font-semibold text-muted">Data</div>
              <ValueTree xdr={ev.data.xdr} />
            </div>
            {ev.params && (
              <div>
                <div className="mb-0.5 font-semibold text-muted">Decoded with the contract spec</div>
                <JsonInline value={ev.params} />
              </div>
            )}
            <CopyButton text={ev.xdr} label="Copy event XDR" />
          </div>
        )}
      </div>
    </li>
  );
}

export function EventsTab({ run }: { run: SimulationRun }) {
  const [filter, setFilter] = useState<Filter>("contract");
  const [query, setQuery] = useState("");
  const all = run.report.events;
  const d = useMemo(() => depths(all), [all]);
  const contractCount = all.filter((e) => e.type === "contract").length;

  const shown = all
    .map((ev, i) => ({ ev, depth: d[i]! }))
    .filter(({ ev }) => filter === "all" || ev.type === "contract")
    .filter(({ ev }) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [ev.name, ev.contractId, JSON.stringify(ev.topics.map((t) => t.json)), JSON.stringify(ev.data.json), JSON.stringify(ev.params)]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q));
    });

  if (all.length === 0) {
    return <EmptyState title="No events">This call emitted no contract or diagnostic events.</EmptyState>;
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Event types" className="inline-flex rounded-md border border-border p-0.5 text-xs">
          <button type="button" aria-pressed={filter === "contract"} onClick={() => setFilter("contract")} className={filter === "contract" ? "rounded bg-panel-2 px-2 py-1 font-medium" : "px-2 py-1 text-muted"}>
            Contract events ({contractCount})
          </button>
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={filter === "all" ? "rounded bg-panel-2 px-2 py-1 font-medium" : "px-2 py-1 text-muted"}>
            Full trace incl. diagnostics ({all.length})
          </button>
        </div>
        <label className="relative min-w-[12rem] flex-1">
          <span className="sr-only">Search events</span>
          <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names, topics, data, addresses" className={cx(inputClass, "pl-8")} />
        </label>
      </div>
      {filter === "contract" && contractCount === 0 && (
        <p className="text-sm text-muted">
          No contract events. {run.report.status === "error" ? "Failed calls roll back their events; " : ""}Switch to the full trace to see diagnostic events.
        </p>
      )}
      <ul className="space-y-1.5" aria-label="Events in emission order">
        {shown.map(({ ev, depth }) => (
          <EventRow key={ev.index} ev={ev} depth={filter === "all" ? depth : 0} contractId={run.contractId} />
        ))}
      </ul>
      {shown.length === 0 && query && <p className="text-sm text-muted">No events match “{query}”.</p>}
    </div>
  );
}
