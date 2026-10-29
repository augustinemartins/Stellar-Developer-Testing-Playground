"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardPaste,
  Download,
  ExternalLink,
  FileUp,
  Library,
  Link2,
  Play,
  PlayCircle,
  Trash2,
  XCircle,
} from "lucide-react";
import { parseScenarioJson, parseScenarios, type Scenario } from "@playground/shared-types";
import {
  decodeShareToken,
  encodeShareToken,
  runScenario,
  scenarioToJson,
  scenarioToVitest,
  type ScenarioRunResult,
} from "@playground/simulation-engine";
import { downloadText, safeFilename } from "@/lib/files";
import { workspaceHref } from "@/lib/routes";
import { dedupeId, toCollection, useScenarioStore, type LastRun } from "@/lib/scenarios";
import { Alert, Badge, Button, Card, EmptyState, cx, inputClass, shorten } from "./ui";

type RunState = { status: "running" } | { status: "done"; result: ScenarioRunResult } | { status: "error"; message: string };

function toLastRun(r: RunState): LastRun | null {
  if (r.status === "running") return null;
  if (r.status === "error") return { at: new Date().toISOString(), passed: false, status: "failed_to_run", failures: [r.message] };
  return {
    at: new Date().toISOString(),
    passed: r.result.passed,
    status: r.result.run.report.status,
    failures: r.result.assertions.filter((a) => !a.passed).map((a) => `${a.label}: expected ${a.expected}, got ${a.actual}`),
  };
}

export function ScenariosView() {
  const store = useScenarioStore();
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [messages, setMessages] = useState<{ tone: "ok" | "bad" | "warn"; text: string; details?: string[] }[]>([]);
  const [shared, setShared] = useState<Scenario | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [runningAll, setRunningAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Share links carry the scenario in the URL fragment: #scenario=s1.…
  useEffect(() => {
    const hash = window.location.hash;
    const m = /^#scenario=(.+)$/.exec(hash);
    if (!m) return;
    decodeShareToken(decodeURIComponent(m[1]!))
      .then((data) => {
        const parsed = parseScenarios(data);
        if (parsed.ok && parsed.value[0]) setShared(parsed.value[0]);
        else setMessages([{ tone: "bad", text: "The shared scenario is invalid.", details: parsed.ok ? [] : parsed.errors }]);
      })
      .catch((e: Error) => setMessages([{ tone: "bad", text: e.message }]));
  }, []);

  const importScenarios = useCallback(
    (items: Scenario[], source: string) => {
      const ready = items.map((s) => dedupeId(s, store.scenarios));
      store.upsert(ready);
      setMessages([{ tone: "ok", text: `Imported ${ready.length} scenario${ready.length === 1 ? "" : "s"} from ${source}.` }]);
      return ready;
    },
    [store],
  );

  const replay = useCallback(
    async (s: Scenario) => {
      setRuns((r) => ({ ...r, [s.id]: { status: "running" } }));
      let state: RunState;
      try {
        state = { status: "done", result: await runScenario(s) };
      } catch (e) {
        state = { status: "error", message: (e as Error).message };
      }
      setRuns((r) => ({ ...r, [s.id]: state }));
      const last = toLastRun(state);
      if (last) store.recordRun(s.id, last);
      return state;
    },
    [store],
  );

  const runAll = async () => {
    setRunningAll(true);
    let passed = 0;
    for (const s of store.scenarios) {
      const r = await replay(s);
      if (r.status === "done" && r.result.passed) passed++;
    }
    setRunningAll(false);
    const failed = store.scenarios.length - passed;
    setMessages([{ tone: failed ? "bad" : "ok", text: `${passed} passed, ${failed} failed.` }]);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Library aria-hidden className="size-6" /> Saved scenarios
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Scenarios capture a contract call and its expected outcome. Replay them to catch regressions, share them as links, or export
            them as tests. They are stored in this browser only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => fileRef.current?.click()}>
            <FileUp aria-hidden className="size-4" /> Import files
          </Button>
          <Button onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen}>
            <ClipboardPaste aria-hidden className="size-4" /> Paste JSON
          </Button>
          <Button disabled={!store.scenarios.length} loading={runningAll} onClick={runAll}>
            <PlayCircle aria-hidden className="size-4" /> Run all
          </Button>
          <Button
            disabled={!store.scenarios.length}
            onClick={() => downloadText("scenarios.collection.json", JSON.stringify(toCollection(store.scenarios), null, 2) + "\n")}
          >
            <Download aria-hidden className="size-4" /> Export all
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".json,application/json"
            className="sr-only"
            aria-label="Import scenario files"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              const all: Scenario[] = [];
              const errors: string[] = [];
              for (const f of files) {
                if (f.size > 5_000_000) {
                  errors.push(`${f.name}: larger than 5 MB`);
                  continue;
                }
                const r = parseScenarioJson(await f.text());
                if (r.ok) all.push(...r.value);
                else errors.push(...r.errors.slice(0, 8).map((x) => `${f.name}: ${x}`));
              }
              if (all.length) importScenarios(all, files.length === 1 ? files[0]!.name : `${files.length} files`);
              if (errors.length) setMessages((m) => [...m, { tone: "bad", text: "Some files could not be imported.", details: errors }]);
            }}
          />
        </div>
      </header>

      <div aria-live="polite" className="space-y-2">
        {messages.map((m, i) => (
          <Alert key={i} tone={m.tone} title={m.text}>
            {m.details && m.details.length > 0 && (
              <ul className="list-disc pl-4 font-mono text-xs">
                {m.details.map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
              </ul>
            )}
          </Alert>
        ))}
      </div>

      {pasteOpen && (
        <Card className="space-y-2 p-4">
          <label className="block text-sm font-medium">
            Scenario JSON (a scenario, an array, or a collection)
            <textarea
              rows={8}
              spellCheck={false}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              className={cx(inputClass, "mt-1 font-mono text-xs")}
            />
          </label>
          <div className="flex gap-2">
            <Button
              variant="primary"
              disabled={!paste.trim()}
              onClick={() => {
                const r = parseScenarioJson(paste);
                if (!r.ok) {
                  setMessages([{ tone: "bad", text: "That JSON is not a valid scenario.", details: r.errors.slice(0, 12) }]);
                  return;
                }
                importScenarios(r.value, "pasted JSON");
                setPaste("");
                setPasteOpen(false);
              }}
            >
              Import
            </Button>
            <Button variant="ghost" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {shared && (
        <Card className="space-y-3 border-accent/40 p-4" aria-labelledby="shared-h">
          <h2 id="shared-h" className="flex items-center gap-2 font-semibold">
            <Link2 aria-hidden className="size-4" /> Shared scenario: {shared.name}
          </h2>
          {shared.description && <p className="text-sm text-muted">{shared.description}</p>}
          <ScenarioFacts s={shared} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const [saved] = importScenarios([shared], "share link");
                history.replaceState(null, "", window.location.pathname);
                setShared(null);
                if (saved) replay(saved);
              }}
            >
              Import and replay
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                history.replaceState(null, "", window.location.pathname);
                setShared(null);
              }}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {store.scenarios.length === 0 ? (
        <Card>
          <EmptyState icon={<Library className="size-8" />} title="No saved scenarios yet">
            Simulate a call in the{" "}
            <Link className="underline" href="/">
              playground
            </Link>
            , then use <strong>Save &amp; export</strong> on the result. You can also import the examples from{" "}
            <code className="font-mono">examples/scenarios/</code> in the repository.
          </EmptyState>
        </Card>
      ) : (
        <ul className="space-y-3">
          {store.scenarios.map((s) => (
            <li key={s.id}>
              <ScenarioCard
                s={s}
                run={runs[s.id]}
                last={store.lastRuns[s.id]}
                onReplay={() => replay(s)}
                onDelete={() => store.remove(s.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScenarioFacts({ s }: { s: Scenario }) {
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      <div>
        <dt className="inline">Network </dt>
        <dd className="inline font-mono text-fg">{s.network.id}</dd>
      </div>
      <div>
        <dt className="inline">Contract </dt>
        <dd className="inline font-mono text-fg" title={s.contract.id}>
          {s.contract.label ? `${s.contract.label} · ` : ""}
          {shorten(s.contract.id)}
        </dd>
      </div>
      <div>
        <dt className="inline">Call </dt>
        <dd className="inline font-mono text-fg">{s.invocation.method}</dd>
      </div>
      <div>
        <dt className="inline">Expectations </dt>
        <dd className="inline text-fg">{Object.keys(s.expect ?? {}).length}</dd>
      </div>
    </dl>
  );
}

function ScenarioCard({
  s,
  run,
  last,
  onReplay,
  onDelete,
}: {
  s: Scenario;
  run?: RunState;
  last?: LastRun;
  onReplay: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [linkState, setLinkState] = useState<string | null>(null);
  const status =
    run?.status === "done"
      ? run.result.passed
        ? "pass"
        : "fail"
      : run?.status === "error"
        ? "fail"
        : last
          ? last.passed
            ? "pass"
            : "fail"
          : null;

  return (
    <Card as="article" className="p-4" aria-labelledby={`sc-${s.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id={`sc-${s.id}`} className="flex flex-wrap items-center gap-2 font-semibold">
            {s.name}
            {status === "pass" && (
              <Badge tone="ok">
                <CheckCircle2 aria-hidden className="size-3" /> passing
              </Badge>
            )}
            {status === "fail" && (
              <Badge tone="bad">
                <XCircle aria-hidden className="size-3" /> failing
              </Badge>
            )}
            {s.tags?.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </h2>
          {s.description && <p className="text-sm text-muted">{s.description}</p>}
          <ScenarioFacts s={s} />
          {last && !run && <p className="text-xs text-muted">Last replayed {new Date(last.at).toLocaleString()}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="primary" loading={run?.status === "running"} onClick={onReplay}>
            <Play aria-hidden className="size-3.5" /> Replay
          </Button>
          <Link
            href={workspaceHref({ scenario: s.id })}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-panel-2"
          >
            <ExternalLink aria-hidden className="size-3.5" /> Open
          </Link>
          <Button
            size="sm"
            onClick={async () => {
              const url = `${window.location.origin}/scenarios#scenario=${await encodeShareToken(s)}`;
              const ok = await navigator.clipboard.writeText(url).then(
                () => true,
                () => false,
              );
              setLinkState(ok ? "Link copied" : url);
              setTimeout(() => setLinkState(null), 4000);
            }}
          >
            <Link2 aria-hidden className="size-3.5" /> Share
          </Button>
          <Button
            size="sm"
            onClick={() => downloadText(safeFilename(s.name, ".scenario.json"), scenarioToJson(s))}
            aria-label={`Download ${s.name} as JSON`}
          >
            <Download aria-hidden className="size-3.5" /> JSON
          </Button>
          <Button
            size="sm"
            onClick={() => downloadText(safeFilename(s.name, ".test.ts"), scenarioToVitest(s), "text/typescript")}
            aria-label={`Download ${s.name} as a Vitest test`}
          >
            <Download aria-hidden className="size-3.5" /> Test
          </Button>
          {confirm ? (
            <>
              <Button size="sm" variant="danger" onClick={onDelete}>
                Confirm delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} aria-label={`Delete ${s.name}`}>
              <Trash2 aria-hidden className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {linkState && (
        <p role="status" className="mt-2 break-all text-xs text-muted">
          {linkState}
        </p>
      )}
      {run?.status === "error" && (
        <Alert tone="bad" className="mt-3" title="Could not replay">
          {run.message}
        </Alert>
      )}
      {run?.status === "done" && <RunDetails result={run.result} />}
    </Card>
  );
}

function RunDetails({ result }: { result: ScenarioRunResult }) {
  const r = result.run.report;
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <p className="text-xs text-muted">
        Replayed at ledger {r.latestLedger.toLocaleString("en-US")} in {result.run.durationMs} ms — status{" "}
        <strong className="text-fg">{r.status}</strong>
        {r.error ? `: ${r.error.summary}` : ""}.
      </p>
      {result.assertions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Expectation results</caption>
            <thead className="text-muted">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">
                  Check
                </th>
                <th scope="col" className="py-1 pr-3 font-medium">
                  Expected
                </th>
                <th scope="col" className="py-1 pr-3 font-medium">
                  Actual
                </th>
                <th scope="col" className="py-1 font-medium">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.assertions.map((a) => (
                <tr key={a.key}>
                  <th scope="row" className="py-1 pr-3 font-medium">
                    {a.label}
                  </th>
                  <td className="max-w-xs break-all py-1 pr-3 font-mono">{a.expected}</td>
                  <td className="max-w-xs break-all py-1 pr-3 font-mono">{a.actual}</td>
                  <td className="py-1">
                    {a.passed ? <span className="text-ok">✓ pass</span> : <span className="font-semibold text-bad">✗ fail</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted">
          This scenario has no expectations, so it always passes. Save it again with “Lock this result” to add checks.
        </p>
      )}
      {result.drift.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted">Changed since recording ({result.drift.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {result.drift.map((d) => (
              <li key={d.label}>
                <strong>{d.label}:</strong> <span className="font-mono">{d.recorded}</span> → <span className="font-mono">{d.current}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
