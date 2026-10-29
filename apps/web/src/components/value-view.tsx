"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { scValToTree, type ValueNode } from "@playground/result-parser";
import type { JsonValue } from "@playground/shared-types";
import { cx } from "./ui";

function Scalar({ value }: { value: JsonValue }) {
  if (value === null) return <span className="text-muted">null</span>;
  if (typeof value === "string") return <span className="break-all text-ok">&quot;{value}&quot;</span>;
  if (typeof value === "number" || typeof value === "boolean") return <span className="text-info">{String(value)}</span>;
  return <span className="break-all">{JSON.stringify(value)}</span>;
}

function TypeTag({ type }: { type: string }) {
  return <span className="mr-1.5 rounded bg-panel-2 px-1 font-mono text-[10.5px] text-muted">{type}</span>;
}

function Node({ node, label, depth }: { node: ValueNode; label?: string; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const prefix = label !== undefined && <span className="mr-1 text-fg/80">{label}:</span>;
  if (node.kind === "scalar") {
    return (
      <li className="py-0.5 pl-5">
        {prefix}
        <TypeTag type={node.type} />
        <Scalar value={node.value} />
      </li>
    );
  }
  const count = node.kind === "vec" ? node.items.length : node.entries.length;
  return (
    <li className="py-0.5">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex items-center text-left">
        {open ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
        {prefix}
        <TypeTag type={node.type} />
        <span className="text-muted">{count} {node.kind === "vec" ? "items" : "entries"}</span>
      </button>
      {open && (
        <ul className="ml-2 border-l border-border pl-2">
          {node.kind === "vec"
            ? node.items.map((n, i) => <Node key={i} node={n} label={String(i)} depth={depth + 1} />)
            : node.entries.map((e, i) =>
                e.key.kind === "scalar" ? (
                  <Node key={i} node={e.value} label={typeof e.key.value === "string" ? e.key.value : JSON.stringify(e.key.value)} depth={depth + 1} />
                ) : (
                  <li key={i} className="py-0.5">
                    <ul>
                      <Node node={e.key} label="key" depth={depth + 1} />
                      <Node node={e.value} label="value" depth={depth + 1} />
                    </ul>
                  </li>
                ),
              )}
        </ul>
      )}
    </li>
  );
}

/** Collapsible tree of an ScVal with a type tag on every node. */
export function ValueTree({ xdr, className }: { xdr: string; className?: string }) {
  let tree: ValueNode;
  try {
    tree = scValToTree(xdr);
  } catch {
    return <p className="text-sm text-bad">Could not decode value.</p>;
  }
  return (
    <ul className={cx("font-mono text-[12.5px] leading-5", className)}>
      <Node node={tree} depth={0} />
    </ul>
  );
}

/** Compact JSON rendering for inline display. */
export function JsonInline({ value, className }: { value: JsonValue | undefined; className?: string }) {
  return <code className={cx("font-mono text-[12.5px] break-all", className)}>{value === undefined ? "—" : JSON.stringify(value)}</code>;
}

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre className={cx("max-h-96 overflow-auto rounded-md border border-border bg-panel-2 p-3 font-mono text-[12px] leading-5", className)}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
