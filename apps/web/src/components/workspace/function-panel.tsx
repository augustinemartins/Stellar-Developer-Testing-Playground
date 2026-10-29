"use client";
import Link from "next/link";
import { sameJson } from "@/lib/json";
import { useEffect, useId, useMemo, useState } from "react";
import { Braces, KeyRound, ListChecks, Play, Sparkles } from "lucide-react";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { argsJsonSchema, SAMPLE_DEPLOYMENTS } from "@playground/contract-loader";
import { formatSignature, type AuthMode, type JsonValue } from "@playground/shared-types";
import { getServer } from "@playground/simulation-engine";
import { JsonEditor } from "../json-editor";
import { Alert, Badge, Button, cx, inputClass } from "../ui";
import { ArgField } from "./arg-field";
import type { Workspace } from "./use-workspace";

const AUTH_MODES: { value: AuthMode; label: string; help: string }[] = [
  { value: "record", label: "Record", help: "Discover which signatures the call needs. Best for exploring." },
  { value: "enforce", label: "Enforce", help: "Require valid auth entries; unsigned calls that need auth fail." },
  {
    value: "record_allow_nonroot",
    label: "Record (allow non-root)",
    help: "Like record, but also allows auth that is not at the root of the call tree.",
  },
];

export function FunctionPanel({ ws }: { ws: Workspace }) {
  const { fn, load } = ws;
  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState("{}");
  const [jsonSyntax, setJsonSyntax] = useState<string | null>(null);
  const formId = useId();
  const spec = load.status === "ready" ? load.contract.spec : null;
  const sample = load.status === "ready" ? load.sample : undefined;

  // In JSON mode, follow outside changes to the arguments (another method, a suggested call),
  // but never rewrite what the user is typing when it already matches.
  const argsJson = JSON.stringify(ws.args, null, 2);
  const [seenArgs, setSeenArgs] = useState(argsJson);
  if (seenArgs !== argsJson) {
    setSeenArgs(argsJson);
    if (mode === "json" && !jsonSyntax && !sameJson(jsonText, argsJson)) setJsonText(argsJson);
  }

  const schema = useMemo(() => (fn && spec ? argsJsonSchema(fn, spec) : undefined), [fn, spec]);
  const suggestions = useMemo(() => {
    const s = new Set<string>();
    if (sample) Object.values(SAMPLE_DEPLOYMENTS.accounts).forEach((a) => s.add(a));
    if (ws.source && StrKey.isValidEd25519PublicKey(ws.source)) s.add(ws.source);
    if (load.status === "ready") s.add(load.contract.contractId);
    return [...s];
  }, [sample, ws.source, load]);

  // Ctrl/⌘+Enter simulates from anywhere in the workspace, e.g. right after picking a method.
  // The JSON editor handles the shortcut itself and marks the event as handled.
  const { simulate } = ws;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !e.defaultPrevented) {
        e.preventDefault();
        simulate();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [simulate]);

  if (!fn || !spec) return null;
  const errorsFor = (name: string) =>
    ws.argErrors.filter((e) => e.path === name || e.path.startsWith(`${name}.`) || e.path.startsWith(`${name}[`));
  const blocking = ws.argErrors.length + Object.keys(ws.draftErrors).length + (jsonSyntax ? 1 : 0);
  const suggested = sample?.suggestedCalls.filter((c) => c.method === fn.name) ?? [];

  return (
    <form
      id={formId}
      aria-labelledby={`${formId}-title`}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        ws.simulate();
      }}
    >
      <header className="space-y-1.5">
        <h2 id={`${formId}-title`} className="font-mono text-lg font-semibold">
          {fn.name}
        </h2>
        <p className="break-all font-mono text-xs text-muted">{formatSignature(fn)}</p>
        {fn.doc && <p className="text-sm text-fg/90">{fn.doc}</p>}
      </header>

      {sample && sample.suggestedCalls.length > 0 && (
        <div className="rounded-md border border-border bg-panel-2/60 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Sparkles aria-hidden className="size-3.5" /> Try a suggested call
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sample.suggestedCalls.map((c) => (
              <button
                key={c.title}
                type="button"
                title={c.description}
                onClick={() => ws.applySuggested(c.method, c.args)}
                className={cx(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  suggested.includes(c) ? "border-accent/50 bg-accent/10 text-accent" : "border-border bg-panel hover:border-accent/50",
                )}
              >
                {c.title}
              </button>
            ))}
          </div>
          {suggested[0] && (
            <p className="mt-1.5 text-xs text-muted">
              {suggested.find((c) => JSON.stringify(c.args) === JSON.stringify(ws.args))?.description ?? suggested[0].description}
            </p>
          )}
        </div>
      )}

      <fieldset className="space-y-3">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-semibold">
            Arguments {fn.inputs.length === 0 && <span className="font-normal text-muted">— none</span>}
          </legend>
          {fn.inputs.length > 0 && (
            <div role="group" aria-label="Input mode" className="inline-flex rounded-md border border-border p-0.5 text-xs">
              {(["form", "json"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => {
                    setJsonSyntax(null);
                    if (m === "json") setJsonText(argsJson);
                    setMode(m);
                  }}
                  className={cx("inline-flex items-center gap-1 rounded px-2 py-1", mode === m ? "bg-panel-2 font-medium" : "text-muted")}
                >
                  {m === "form" ? <ListChecks aria-hidden className="size-3.5" /> : <Braces aria-hidden className="size-3.5" />}
                  {m === "form" ? "Form" : "JSON"}
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === "form" ? (
          <div className="space-y-4">
            {fn.inputs.map((input) => (
              <ArgField
                key={`${fn.name}:${input.name}`}
                input={input}
                spec={spec}
                value={ws.args[input.name]}
                onChange={(v) => ws.setArg(input.name, v)}
                errors={errorsFor(input.name)}
                onDraftError={(m) => ws.setDraftError(input.name, m)}
                suggestions={input.type.kind === "address" || input.type.kind === "muxed_address" ? suggestions : []}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <JsonEditor
              label={`Arguments for ${fn.name} as JSON`}
              value={jsonText}
              schema={schema}
              height={Math.min(420, 120 + fn.inputs.length * 48)}
              onSubmit={ws.simulate}
              onChange={(text) => {
                setJsonText(text);
                try {
                  const parsed = JSON.parse(text) as unknown;
                  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
                    throw new Error("Arguments must be a JSON object keyed by parameter name.");
                  setJsonSyntax(null);
                  ws.setArgs(parsed as Record<string, JsonValue>);
                } catch (e) {
                  setJsonSyntax((e as Error).message);
                }
              }}
            />
            {jsonSyntax && <p className="text-xs text-bad">{jsonSyntax}</p>}
            {!jsonSyntax && ws.argErrors.length > 0 && (
              <ul className="space-y-0.5 text-xs text-bad">
                {ws.argErrors.map((e, i) => (
                  <li key={i}>
                    <code className="font-mono">{e.path}</code>: {e.message}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">
              Autocomplete and validation come from the contract spec. See the{" "}
              <Link className="underline" href="/docs/value-format">
                value format
              </Link>{" "}
              for how each type is written.
            </p>
          </div>
        )}
      </fieldset>

      <SourceAccount ws={ws} />

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-semibold">Authorization mode</legend>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {AUTH_MODES.map((m) => (
            <label
              key={m.value}
              className={cx(
                "cursor-pointer rounded-md border p-2 text-xs",
                ws.authMode === m.value ? "border-accent/60 bg-accent/5" : "border-border",
              )}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <input type="radio" name={`${formId}-auth`} checked={ws.authMode === m.value} onChange={() => ws.setAuthMode(m.value)} />
                {m.label}
              </span>
              <span className="mt-1 block text-muted">{m.help}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {ws.runError && (
        <Alert tone="bad" role="alert" title={ws.runError.kind === "input" ? "Cannot simulate yet" : "Simulation request failed"}>
          {ws.runError.message}
          {ws.runError.errors && ws.runError.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {ws.runError.errors.map((e, i) => (
                <li key={i}>
                  <code className="font-mono">{e.path}</code>: {e.message}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-panel px-4 py-3">
        <Button type="submit" variant="primary" loading={ws.running} disabled={blocking > 0}>
          <Play aria-hidden className="size-4" /> Simulate
        </Button>
        <span className="text-xs text-muted">
          {blocking > 0 ? (
            <span className="text-bad">
              {blocking} input {blocking === 1 ? "problem" : "problems"} to fix
            </span>
          ) : (
            <>
              <kbd className="rounded border border-border px-1 font-mono">Ctrl</kbd>+
              <kbd className="rounded border border-border px-1 font-mono">Enter</kbd> · read-only, nothing is signed or submitted
            </>
          )}
        </span>
      </div>
    </form>
  );
}

function SourceAccount({ ws }: { ws: Workspace }) {
  const id = useId();
  const [funding, setFunding] = useState(false);
  const [fundMsg, setFundMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const value = ws.source.trim();
  const invalid = value.length > 0 && !StrKey.isValidEd25519PublicKey(value) && !StrKey.isValidMed25519PublicKey(value);
  const isSecret = value.startsWith("S") && StrKey.isValidEd25519SecretSeed(value);
  const friendbot = ws.network.friendbotUrl;

  return (
    <fieldset className="space-y-1.5">
      <legend className="flex items-center gap-1.5 text-sm font-semibold">
        <KeyRound aria-hidden className="size-4" /> Source account <Badge>optional</Badge>
      </legend>
      <input
        id={id}
        value={ws.source}
        onChange={(e) => ws.setSource(e.target.value)}
        placeholder="G… (leave empty to use a placeholder account)"
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={`${id}-help`}
        className={cx(inputClass, "font-mono")}
      />
      <p id={`${id}-help`} className={cx("text-xs", invalid ? "text-bad" : "text-muted")}>
        {isSecret
          ? "That is a secret key. Clear it now — the playground only ever needs public keys."
          : invalid
            ? "Enter a valid G… or M… public key."
            : "The account that would pay fees and act as tx.source. Auth for this address is satisfied implicitly."}
      </p>
      {friendbot && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            loading={funding}
            onClick={async () => {
              setFunding(true);
              setFundMsg(null);
              // The secret is discarded immediately: simulation only needs the public key.
              const pk = Keypair.random().publicKey();
              try {
                await getServer(ws.network).fundAddress(pk, friendbot);
                ws.setSource(pk);
                setFundMsg({ tone: "ok", text: "Funded a throwaway account with friendbot. Its secret key was never stored." });
              } catch (e) {
                setFundMsg({ tone: "bad", text: `Friendbot failed: ${(e as Error).message}` });
              } finally {
                setFunding(false);
              }
            }}
          >
            Create funded test account
          </Button>
          {fundMsg && (
            <span role="status" className={cx("text-xs", fundMsg.tone === "ok" ? "text-ok" : "text-bad")}>
              {fundMsg.text}
            </span>
          )}
        </div>
      )}
    </fieldset>
  );
}
