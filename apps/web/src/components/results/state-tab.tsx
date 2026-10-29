"use client";
import type { SimulationRun } from "@playground/simulation-engine";
import { Badge, EmptyState } from "../ui";
import { JsonInline } from "../value-view";

const TONE = { created: "ok", updated: "info", deleted: "bad", restored: "warn" } as const;

export function StateTab({ run }: { run: SimulationRun }) {
  const changes = run.report.stateChanges;
  if (changes.length === 0) {
    return (
      <EmptyState title="No state changes">
        {run.report.status === "error" ? "Failed calls do not change state." : "This call reads state but would not modify it."}
      </EmptyState>
    );
  }
  return (
    <div className="space-y-2 p-4">
      <p className="text-sm text-muted">What submitting this transaction would change, according to the simulation. Values are shown for contract data entries.</p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {changes.map((c, i) => (
          <li key={i} className="space-y-1 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONE[c.type]}>{c.type}</Badge>
              <span className="break-all font-mono text-xs">{c.key.label}</span>
            </div>
            {(c.before || c.after) && (
              <div className="grid gap-1 pl-1 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-muted">before </span>
                  {c.before ? <JsonInline value={c.before.json} /> : <span className="text-muted">—</span>}
                </div>
                <div>
                  <span className="text-muted">after </span>
                  {c.after ? <JsonInline value={c.after.json} /> : <span className="text-muted">—</span>}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
