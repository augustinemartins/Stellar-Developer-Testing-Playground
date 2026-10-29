"use client";
import type { SimulationRun } from "@playground/simulation-engine";
import { CopyButton } from "../ui";

function Block({ title, text }: { title: string; text: string }) {
  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <CopyButton text={text} />
      </div>
      <pre
        tabIndex={0}
        role="region"
        aria-label={title}
        className="max-h-80 overflow-auto rounded-md border border-border bg-panel-2 p-3 font-mono text-[11.5px] leading-5 break-all whitespace-pre-wrap"
      >
        {text}
      </pre>
    </section>
  );
}

export function RawTab({ run }: { run: SimulationRun }) {
  return (
    <div className="space-y-4 p-4">
      <Block title="Arguments (JSON)" text={JSON.stringify(run.args, null, 2)} />
      <Block title="Arguments (ScVal XDR, base64)" text={run.argsXdr.join("\n") || "(no arguments)"} />
      <Block title="Simulated transaction envelope (XDR)" text={run.transactionXdr} />
      <Block title="simulateTransaction response (JSON-RPC result)" text={JSON.stringify(run.raw, null, 2)} />
    </div>
  );
}
