"use client";
import { estimatedTotalFee, formatStroops } from "@playground/result-parser";
import type { LedgerKeyInfo, NetworkLimits } from "@playground/shared-types";
import type { SimulationRun } from "@playground/simulation-engine";
import { Badge, CopyButton, EmptyState, cx } from "../ui";

function Meter({ label, value, max, unit }: { label: string; value: number; max: number; unit?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tone = pct >= 90 ? "bg-bad" : pct >= 60 ? "bg-warn" : "bg-accent";
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs text-muted">
          {fmt(value)} / {fmt(max)} {unit} · {pct < 0.1 && value > 0 ? "<0.1" : pct.toFixed(1)}%
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${fmt(value)} of ${fmt(max)} ${unit ?? ""} (${pct.toFixed(1)}% of the per-transaction limit)`}
        className="h-2 overflow-hidden rounded-full bg-panel-2"
      >
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${Math.max(pct, value > 0 ? 1 : 0)}%` }} />
      </div>
    </div>
  );
}

function KeyList({ title, keys }: { title: string; keys: LedgerKeyInfo[] }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {title} ({keys.length})
      </h4>
      {keys.length === 0 ? (
        <p className="text-sm text-muted">None</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {keys.map((k) => (
            <li key={k.xdr} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <span className="min-w-0">
                <Badge className="mr-2">{k.type}</Badge>
                <span className="break-all font-mono text-xs" title={k.contractId ?? k.accountId}>
                  {k.label}
                </span>
              </span>
              <CopyButton text={k.xdr} label="XDR" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ResourcesTab({ run, limits }: { run: SimulationRun; limits: NetworkLimits | null }) {
  const r = run.report;
  if (!r.resources || !r.fees) {
    return (
      <EmptyState title="No resource data">
        Failed simulations do not report resources or fees. Fix the error and simulate again.
      </EmptyState>
    );
  }
  const res = r.resources;
  const total = estimatedTotalFee(r)!;
  const resourceFee = BigInt(r.fees.minResourceFee);
  const inclusion = BigInt(r.fees.inclusionFee);
  const resourceShare = total > 0n ? Number((resourceFee * 1000n) / total) / 10 : 0;

  return (
    <div className="space-y-6 p-4">
      <section aria-labelledby="fees-h" className="space-y-2">
        <h3 id="fees-h" className="text-sm font-semibold">
          Fees
        </h3>
        <div className="flex h-3 overflow-hidden rounded-full bg-panel-2" aria-hidden>
          <div className="bg-accent" style={{ width: `${resourceShare}%` }} />
          <div className="bg-info/60" style={{ width: `${100 - resourceShare}%` }} />
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden className="size-2 rounded-full bg-accent" /> Minimum resource fee
            </dt>
            <dd className="font-mono">{resourceFee.toLocaleString("en-US")} stroops</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden className="size-2 rounded-full bg-info/60" /> Inclusion fee (bid)
            </dt>
            <dd className="font-mono">{inclusion.toLocaleString("en-US")} stroops</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Estimated total</dt>
            <dd className="font-mono font-semibold">{formatStroops(total)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted">
          The resource fee covers CPU, ledger reads/writes, transaction size, events and rent. Real submissions typically add a safety margin;
          the inclusion fee rises under network congestion.
        </p>
      </section>

      <section aria-labelledby="res-h" className="space-y-3">
        <h3 id="res-h" className="flex items-center gap-2 text-sm font-semibold">
          Resource usage vs. per-transaction limits
          {limits && <Badge tone={limits.source === "live" ? "ok" : "warn"}>{limits.source === "live" ? "live network limits" : "documented defaults"}</Badge>}
        </h3>
        {limits ? (
          <div className="space-y-3">
            <Meter label="CPU instructions" value={res.instructions} max={limits.txMaxInstructions} />
            <Meter label="Disk read bytes" value={res.diskReadBytes} max={limits.txMaxDiskReadBytes} unit="bytes" />
            <Meter label="Write bytes" value={res.writeBytes} max={limits.txMaxWriteBytes} unit="bytes" />
            <Meter label="Ledger entries read" value={res.readOnlyEntries + res.readWriteEntries} max={limits.txMaxDiskReadEntries} unit="entries" />
            <Meter label="Ledger entries written" value={res.readWriteEntries} max={limits.txMaxWriteLedgerEntries} unit="entries" />
            {res.txSizeBytes !== undefined && <Meter label="Transaction size" value={res.txSizeBytes} max={limits.txMaxSizeBytes} unit="bytes" />}
          </div>
        ) : (
          <p className="text-sm text-muted">Loading network limits…</p>
        )}
        <p className="text-xs text-muted">
          Entry counts are upper bounds: entries already in memory (such as the contract instance and code) may not count against disk-read limits.
        </p>
      </section>

      <section aria-labelledby="fp-h" className="space-y-3">
        <h3 id="fp-h" className="text-sm font-semibold">
          Storage footprint
        </h3>
        <KeyList title="Read-only" keys={res.footprint.readOnly} />
        <KeyList title="Read-write" keys={res.footprint.readWrite} />
      </section>

      {r.restore && (
        <section aria-labelledby="restore-h" className="space-y-2">
          <h3 id="restore-h" className="text-sm font-semibold">
            Entries to restore
          </h3>
          <KeyList title="Archived" keys={r.restore.entries} />
        </section>
      )}
    </div>
  );
}
