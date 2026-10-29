"use client";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Download, Link2, Save } from "lucide-react";
import type { ContractSpec, NetworkConfig } from "@playground/shared-types";
import {
  SHARE_LINK_SOFT_LIMIT,
  createScenario,
  encodeShareToken,
  scenarioToCurl,
  scenarioToJson,
  scenarioToMarkdown,
  scenarioToStellarCli,
  scenarioToVitest,
  type SimulationRun,
} from "@playground/simulation-engine";
import { downloadText, safeFilename } from "@/lib/files";
import { useScenarioStore } from "@/lib/scenarios";
import { Alert, Button, CopyButton, cx, inputClass } from "../ui";

export function ExportTab({
  run,
  spec,
  network,
  contractLabel,
  wasmHash,
}: {
  run: SimulationRun;
  spec: ContractSpec;
  network: NetworkConfig;
  contractLabel?: string;
  wasmHash?: string;
}) {
  const id = useId();
  const store = useScenarioStore();
  const [name, setName] = useState(`${contractLabel ?? "Contract"}: ${run.method}`);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [lock, setLock] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [share, setShare] = useState<{ url: string; long: boolean } | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const scenario = useMemo(
    () =>
      createScenario(run, {
        name: name.trim() || run.method,
        description: description.trim() || undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        network,
        spec,
        contractLabel,
        wasmHash: wasmHash && /^[0-9a-f]{64}$/.test(wasmHash) ? wasmHash : undefined,
        lockExpectations: lock,
      }),
    [run, name, description, tags, network, spec, contractLabel, wasmHash, lock],
  );

  const cli = useMemo(() => scenarioToStellarCli(scenario), [scenario]);

  return (
    <div className="grid gap-6 p-4 lg:grid-cols-2">
      <section aria-labelledby={`${id}-save`} className="space-y-3">
        <h3 id={`${id}-save`} className="text-sm font-semibold">
          Save as a reproducible scenario
        </h3>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            store.upsert([scenario]);
            setSaved(scenario.id);
          }}
        >
          <label className="block text-xs">
            Name
            <input required maxLength={200} className={cx(inputClass, "mt-1")} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-xs">
            Description <span className="text-muted">(what this checks and why)</span>
            <textarea maxLength={5000} rows={2} className={cx(inputClass, "mt-1")} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block text-xs">
            Tags <span className="text-muted">(comma separated)</span>
            <input className={cx(inputClass, "mt-1")} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="regression, auth" />
          </label>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5" checked={lock} onChange={(e) => setLock(e.target.checked)} />
            <span>
              Lock this result as expectations
              <span className="block text-muted">Replays fail if the status, return value, error code, event count or signers change, or fees/instructions grow by more than 25%.</span>
            </span>
          </label>
          {lock && scenario.expect && (
            <pre className="max-h-40 overflow-auto rounded-md border border-border bg-panel-2 p-2 font-mono text-[11px]">{JSON.stringify(scenario.expect, null, 2)}</pre>
          )}
          <Button type="submit" variant="primary">
            <Save aria-hidden className="size-4" /> Save scenario
          </Button>
          {saved && (
            <p role="status" className="text-xs text-ok">
              Saved in this browser.{" "}
              <Link href="/scenarios" className="underline">
                View saved scenarios
              </Link>
            </p>
          )}
        </form>
      </section>

      <section aria-labelledby={`${id}-export`} className="space-y-4">
        <h3 id={`${id}-export`} className="text-sm font-semibold">
          Share and export
        </h3>
        <div className="space-y-2">
          <Button
            onClick={async () => {
              setShareError(null);
              try {
                const token = await encodeShareToken(scenario);
                const url = `${window.location.origin}/scenarios#scenario=${token}`;
                setShare({ url, long: url.length > SHARE_LINK_SOFT_LIMIT });
                await navigator.clipboard.writeText(url).catch(() => undefined);
              } catch (e) {
                setShareError((e as Error).message);
              }
            }}
          >
            <Link2 aria-hidden className="size-4" /> Create share link
          </Button>
          {share && (
            <div role="status" className="space-y-1">
              <p className="text-xs text-muted">Copied to your clipboard. The scenario is encoded in the link&apos;s #fragment, which browsers never send to a server.</p>
              <input readOnly value={share.url} onFocus={(e) => e.target.select()} aria-label="Share link" className={cx(inputClass, "font-mono text-xs")} />
              {share.long && <Alert tone="warn">This link is {share.url.length.toLocaleString("en-US")} characters. Some chat apps truncate long links; share the JSON file instead.</Alert>}
            </div>
          )}
          {shareError && <Alert tone="bad">{shareError}</Alert>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadText(safeFilename(scenario.name, ".scenario.json"), scenarioToJson(scenario))}>
            <Download aria-hidden className="size-4" /> Scenario JSON
          </Button>
          <Button onClick={() => downloadText(safeFilename(scenario.name, ".test.ts"), scenarioToVitest(scenario), "text/typescript")}>
            <Download aria-hidden className="size-4" /> Vitest test
          </Button>
          <Button onClick={() => downloadText(safeFilename(scenario.name, ".report.json"), JSON.stringify({ request: { args: run.args, argsXdr: run.argsXdr, transactionXdr: run.transactionXdr }, report: run.report, raw: run.raw }, null, 2))}>
            <Download aria-hidden className="size-4" /> Result report
          </Button>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Stellar CLI</h4>
            <CopyButton text={cli} />
          </div>
          <pre className="max-h-48 overflow-auto rounded-md border border-border bg-panel-2 p-2 font-mono text-[11px] leading-5">{cli}</pre>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={scenarioToCurl(scenario)} label="Copy curl request" size="md" />
          <CopyButton text={scenarioToMarkdown(scenario)} label="Copy Markdown summary" size="md" />
        </div>
      </section>
    </div>
  );
}
