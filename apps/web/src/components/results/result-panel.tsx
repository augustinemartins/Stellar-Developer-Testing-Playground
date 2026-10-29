"use client";
import { useState } from "react";
import { FlaskConical, History } from "lucide-react";
import { contractEvents } from "@playground/result-parser";
import { Badge, EmptyState, Spinner, Tabs, cx } from "../ui";
import type { Workspace } from "../workspace/use-workspace";
import { AuthTab } from "./auth-tab";
import { EventsTab } from "./events-tab";
import { ExportTab } from "./export-tab";
import { OverviewTab } from "./overview-tab";
import { RawTab } from "./raw-tab";
import { ResourcesTab } from "./resources-tab";
import { StateTab } from "./state-tab";

export function ResultPanel({ ws }: { ws: Workspace }) {
  const [tab, setTab] = useState("overview");
  const run = ws.run;
  const load = ws.load;

  if (!run) {
    return (
      <div className="flex h-full items-center justify-center">
        {ws.running ? (
          <Spinner label="Simulating…" />
        ) : (
          <EmptyState icon={<FlaskConical className="size-8" />} title="No simulation yet">
            Fill in the arguments and press <strong>Simulate</strong>. Results show the return value, fees, resources, required signatures
            and events.
          </EmptyState>
        )}
      </div>
    );
  }

  const r = run.report;
  const tone = r.status === "success" ? "ok" : r.status === "error" ? "bad" : "warn";

  return (
    <section aria-label="Simulation results" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold">Result</h2>
        <Badge tone={tone}>{r.status.replace("_", " ")}</Badge>
        <span className="font-mono text-xs text-muted">{run.method}</span>
        {ws.running && <Spinner label="Simulating…" />}
        {ws.history.length > 1 && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
            <History aria-hidden className="size-3.5" />
            <span className="sr-only">Run history</span>
            <select
              value={ws.selectedRun}
              onChange={(e) => ws.setSelectedRun(Number(e.target.value))}
              className="rounded border border-border bg-panel px-1 py-0.5 text-xs text-fg"
            >
              {ws.history.map((h, i) => (
                <option key={h.startedAt + i} value={i}>
                  {i === 0 ? "Latest" : `#${ws.history.length - i}`} · {h.method} · {h.report.status} ·{" "}
                  {new Date(h.startedAt).toLocaleTimeString()}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {/* Announce new results to screen readers without moving focus. */}
      <p className="sr-only" aria-live="polite">
        {ws.running
          ? ""
          : `Simulation of ${run.method} ${r.status === "success" ? "succeeded" : r.status === "error" ? `failed: ${r.error?.summary}` : "needs a state restore"}.`}
      </p>
      <div className={cx("min-h-0 flex-1 overflow-y-auto", ws.running && "opacity-60")}>
        <Tabs
          label="Result details"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "resources", label: "Fees & resources" },
            { id: "auth", label: "Auth", count: r.auth.length },
            { id: "events", label: "Events", count: contractEvents(r).length },
            { id: "state", label: "State", count: r.stateChanges.length },
            { id: "raw", label: "Raw" },
            { id: "export", label: "Save & export" },
          ]}
        >
          {tab === "overview" && <OverviewTab run={run} />}
          {tab === "resources" && <ResourcesTab run={run} limits={ws.limits} />}
          {tab === "auth" && <AuthTab run={run} />}
          {tab === "events" && <EventsTab run={run} />}
          {tab === "state" && <StateTab run={run} />}
          {tab === "raw" && <RawTab run={run} />}
          {tab === "export" && load.status === "ready" && (
            <ExportTab
              run={run}
              spec={load.contract.spec}
              network={ws.network}
              contractLabel={load.label}
              wasmHash={"wasmHash" in load.contract.executable ? load.contract.executable.wasmHash : undefined}
            />
          )}
        </Tabs>
      </div>
    </section>
  );
}
