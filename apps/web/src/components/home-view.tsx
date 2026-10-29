"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, Clock, FileJson, Share2, ShieldCheck, TestTube2 } from "lucide-react";
import { SAMPLE_CONTRACTS } from "@playground/contract-loader";
import { useSettings } from "@/lib/settings";
import { ContractIdInput } from "./contract-id-input";
import { Badge, Card, shorten } from "./ui";
import { workspaceHref } from "@/lib/routes";

export function HomeView() {
  const router = useRouter();
  const { network, recents, clearRecents, selectPreset } = useSettings();
  const onTestnet = network.id === "testnet";

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <section aria-labelledby="hero" className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div className="space-y-4">
          <h1 id="hero" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simulate Soroban contract calls. <span className="text-accent">Keep them as tests.</span>
          </h1>
          <p className="max-w-2xl text-muted">
            Load a contract, call any method with typed arguments and inspect exactly what the network would do — return value, fees,
            resources, required signatures and events — without signing or submitting anything. Save the call as a reproducible scenario,
            share it as a link, or export it as a Vitest test for CI.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <li className="flex items-center gap-1.5">
              <ShieldCheck aria-hidden className="size-4 text-ok" /> Read-only: nothing is ever signed
            </li>
            <li className="flex items-center gap-1.5">
              <TestTube2 aria-hidden className="size-4 text-accent" /> Scenarios with assertions
            </li>
            <li className="flex items-center gap-1.5">
              <Share2 aria-hidden className="size-4 text-info" /> Shareable links
            </li>
          </ul>
        </div>
        <Card className="p-4">
          <ContractIdInput onSubmit={(id) => router.push(workspaceHref({ contractId: id }))} />
          <p className="mt-3 text-xs text-muted">
            Using <strong className="text-fg">{network.label}</strong>. Change networks from the header.
          </p>
        </Card>
      </section>

      <section aria-labelledby="samples-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="samples-heading" className="flex items-center gap-2 text-lg font-semibold">
              <Boxes aria-hidden className="size-5" /> Sample contracts
            </h2>
            <p className="text-sm text-muted">
              Deployed on testnet from <code className="font-mono text-xs">contracts/</code> in this repository.
            </p>
          </div>
        </div>
        {!onTestnet && (
          <p className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-sm">
            Samples live on testnet. Opening one switches the network to testnet.{" "}
            <button type="button" className="underline" onClick={() => selectPreset("testnet")}>
              Switch now
            </button>
          </p>
        )}
        <ul className="grid gap-4 md:grid-cols-3">
          {SAMPLE_CONTRACTS.map((s) => (
            <li key={s.slug}>
              <Card as="article" className="flex h-full flex-col p-4">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{s.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge>{s.spec.functions.filter((f) => !f.name.startsWith("__")).length} methods</Badge>
                  {s.spec.events.length > 0 && <Badge>{s.spec.events.length} events</Badge>}
                  {s.spec.types.some((t) => t.kind === "error_enum") && <Badge tone="warn">typed errors</Badge>}
                </div>
                <p className="mt-3 truncate font-mono text-[11px] text-muted" title={s.contractId ?? undefined}>
                  {s.contractId}
                </p>
                <Link
                  href={workspaceHref({ contractId: s.contractId!, sample: s.slug })}
                  onClick={() => !onTestnet && selectPreset("testnet")}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                >
                  Open {s.title} <ArrowRight aria-hidden className="size-4" />
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="recent-heading">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="recent-heading" className="flex items-center gap-2 font-semibold">
              <Clock aria-hidden className="size-4" /> Recent contracts
            </h2>
            {recents.length > 0 && (
              <button type="button" onClick={clearRecents} className="text-xs text-muted hover:text-fg">
                Clear
              </button>
            )}
          </div>
          {recents.length === 0 ? (
            <p className="text-sm text-muted">Contracts you open appear here.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-panel">
              {recents.map((r) => (
                <li key={`${r.networkPassphrase}:${r.contractId}`}>
                  <Link
                    href={workspaceHref({ contractId: r.contractId })}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-panel-2"
                  >
                    <span className="truncate">{r.label ?? "Contract"}</span>
                    <span className="font-mono text-xs text-muted">{shorten(r.contractId)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="scenario-heading">
          <h2 id="scenario-heading" className="mb-2 flex items-center gap-2 font-semibold">
            <FileJson aria-hidden className="size-4" /> Have a scenario?
          </h2>
          <p className="text-sm text-muted">
            Import a scenario file or open a share link to replay someone else&apos;s simulation and check it still behaves the same.
          </p>
          <Link href="/scenarios" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            Go to saved scenarios <ArrowRight aria-hidden className="size-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
