"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatType, looksReadOnly, type FunctionSpec } from "@playground/shared-types";
import { cx, inputClass } from "../ui";

export function MethodList({
  functions,
  selected,
  onSelect,
}: {
  functions: FunctionSpec[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? functions.filter((f) => f.name.toLowerCase().includes(q) || f.doc?.toLowerCase().includes(q)) : functions;
  }, [functions, query]);

  return (
    <nav aria-label="Contract methods" className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border p-2">
        <label className="relative block">
          <span className="sr-only">Filter methods</span>
          <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${functions.length} methods`}
            className={cx(inputClass, "pl-8")}
          />
        </label>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1" aria-live="polite">
        {filtered.length === 0 && <li className="px-3 py-4 text-sm text-muted">No methods match “{query}”.</li>}
        {filtered.map((f) => {
          const current = f.name === selected;
          return (
            <li key={f.name}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => onSelect(f.name)}
                className={cx(
                  "w-full rounded-md px-2.5 py-2 text-left transition-colors",
                  current ? "bg-accent/10 ring-1 ring-accent/40" : "hover:bg-panel-2",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cx("font-mono text-sm", current && "font-semibold text-accent")}>{f.name}</span>
                  {looksReadOnly(f) && <span className="rounded bg-ok/10 px-1 text-[10px] font-medium uppercase text-ok">read</span>}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">
                  ({f.inputs.map((i) => formatType(i.type)).join(", ")}) → {f.outputs.length ? f.outputs.map(formatType).join(", ") : "()"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
