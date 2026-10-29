"use client";
import { useEffect, useId, useState } from "react";
import { exampleValue } from "@playground/contract-loader";
import { findUdt, formatType, type ContractSpec, type FunctionInput, type JsonValue, type TypeDef } from "@playground/shared-types";
import { Badge, cx, inputClass } from "../ui";

const INT_KINDS = new Set(["u32", "i32"]);
const BIG_KINDS = new Set(["u64", "i64", "u128", "i128", "u256", "i256", "timepoint", "duration"]);

type Control =
  | { kind: "bool" }
  | { kind: "int" }
  | { kind: "bigint" }
  | { kind: "text"; mono: boolean; placeholder: string }
  | { kind: "select"; options: { label: string; value: JsonValue }[] }
  | { kind: "option"; inner: TypeDef }
  | { kind: "json" };

function controlFor(type: TypeDef, spec: ContractSpec): Control {
  if (type.kind === "bool") return { kind: "bool" };
  if (INT_KINDS.has(type.kind)) return { kind: "int" };
  if (BIG_KINDS.has(type.kind)) return { kind: "bigint" };
  switch (type.kind) {
    case "address":
      return { kind: "text", mono: true, placeholder: "G… or C…" };
    case "muxed_address":
      return { kind: "text", mono: true, placeholder: "G…, M… or C…" };
    case "string":
      return { kind: "text", mono: false, placeholder: "text" };
    case "symbol":
      return { kind: "text", mono: true, placeholder: "symbol (a-z, 0-9, _)" };
    case "bytes":
      return { kind: "text", mono: true, placeholder: "hex, e.g. 0xdeadbeef" };
    case "bytes_n":
      return { kind: "text", mono: true, placeholder: `${type.n * 2} hex characters` };
    case "option":
      return { kind: "option", inner: type.value };
    case "udt": {
      const udt = findUdt(spec, type.name);
      if (udt?.kind === "enum") return { kind: "select", options: udt.cases.map((c) => ({ label: `${c.name} (${c.value})`, value: c.name })) };
      if (udt?.kind === "union" && udt.cases.every((c) => c.kind === "void")) {
        return { kind: "select", options: udt.cases.map((c) => ({ label: c.name, value: c.name })) };
      }
      return { kind: "json" };
    }
    default:
      return { kind: "json" };
  }
}

export interface ArgFieldProps {
  input: FunctionInput;
  spec: ContractSpec;
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
  /** Validation errors for this argument (paths below it included). */
  errors: { path: string; message: string }[];
  /** Reports JSON syntax errors in free-form fields so the run button can be disabled. */
  onDraftError: (message: string | null) => void;
  suggestions?: string[];
}

export function ArgField({ input, spec, value, onChange, errors, onDraftError, suggestions = [] }: ArgFieldProps) {
  const id = useId();
  const control = controlFor(input.type, spec);
  const describedBy = [input.doc && `${id}-doc`, errors.length && `${id}-err`].filter(Boolean).join(" ") || undefined;
  const invalid = errors.length > 0;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="font-mono text-sm font-medium">
          {input.name}
        </label>
        <Badge>{formatType(input.type)}</Badge>
      </div>
      {input.doc && (
        <p id={`${id}-doc`} className="text-xs text-muted">
          {input.doc}
        </p>
      )}
      <Control
        id={id}
        control={control}
        type={input.type}
        spec={spec}
        value={value}
        onChange={onChange}
        invalid={invalid}
        describedBy={describedBy}
        onDraftError={onDraftError}
        suggestions={suggestions}
      />
      {invalid && (
        <ul id={`${id}-err`} className="space-y-0.5 text-xs text-bad">
          {errors.map((e, i) => (
            <li key={i}>
              {e.path !== input.name && <code className="mr-1 font-mono">{e.path}:</code>}
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Control({
  id,
  control,
  type,
  spec,
  value,
  onChange,
  invalid,
  describedBy,
  onDraftError,
  suggestions,
}: {
  id: string;
  control: Control;
  type: TypeDef;
  spec: ContractSpec;
  value: JsonValue | undefined;
  onChange: (v: JsonValue) => void;
  invalid: boolean;
  describedBy?: string;
  onDraftError: (message: string | null) => void;
  suggestions: string[];
}) {
  const common = { id, "aria-invalid": invalid, "aria-describedby": describedBy };
  switch (control.kind) {
    case "bool":
      return (
        <label className="inline-flex items-center gap-2 text-sm">
          <input {...common} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="size-4" />
          <span className="font-mono">{value === true ? "true" : "false"}</span>
        </label>
      );
    case "int":
      return (
        <input
          {...common}
          inputMode="numeric"
          className={cx(inputClass, "font-mono")}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => {
            const t = e.target.value.trim();
            onChange(/^-?\d+$/.test(t) && Number.isSafeInteger(Number(t)) ? Number(t) : e.target.value);
          }}
          placeholder="0"
        />
      );
    case "bigint":
      return (
        <input
          {...common}
          inputMode="numeric"
          className={cx(inputClass, "font-mono")}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="0"
        />
      );
    case "text": {
      const listId = suggestions.length ? `${id}-list` : undefined;
      return (
        <>
          <input
            {...common}
            list={listId}
            spellCheck={false}
            autoComplete="off"
            className={cx(inputClass, control.mono && "font-mono")}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={control.placeholder}
          />
          {listId && (
            <datalist id={listId}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      );
    }
    case "select":
      return (
        <select
          {...common}
          className={inputClass}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Choose…
          </option>
          {control.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "option": {
      const some = value !== null && value !== undefined;
      const inner = controlFor(control.inner, spec);
      return (
        <div className="space-y-2 rounded-md border border-dashed border-border p-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={some}
              onChange={(e) => {
                onDraftError(null);
                onChange(e.target.checked ? exampleValue(control.inner, spec) : null);
              }}
            />
            {some ? "Some(value)" : "None"}
          </label>
          {some && (
            <Control
              id={id}
              control={inner}
              type={control.inner}
              spec={spec}
              value={value}
              onChange={onChange}
              invalid={invalid}
              describedBy={describedBy}
              onDraftError={onDraftError}
              suggestions={suggestions}
            />
          )}
        </div>
      );
    }
    case "json":
      return <JsonField {...common} type={type} spec={spec} value={value} onChange={onChange} onDraftError={onDraftError} />;
  }
}

function JsonField({
  id,
  type,
  spec,
  value,
  onChange,
  onDraftError,
  ...aria
}: {
  id: string;
  type: TypeDef;
  spec: ContractSpec;
  value: JsonValue | undefined;
  onChange: (v: JsonValue) => void;
  onDraftError: (message: string | null) => void;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}) {
  const external = JSON.stringify(value === undefined ? exampleValue(type, spec) : value, null, 2);
  const [draft, setDraft] = useState(external);
  const [syntax, setSyntax] = useState<string | null>(null);

  // Follow external changes (e.g. loading a suggested call) unless the user is mid-edit with invalid JSON.
  useEffect(() => {
    if (syntax) return;
    try {
      if (JSON.stringify(JSON.parse(draft)) === JSON.stringify(JSON.parse(external))) return;
    } catch {
      /* fall through */
    }
    setDraft(external);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external]);

  const lines = Math.min(12, Math.max(3, draft.split("\n").length));
  return (
    <div>
      <textarea
        id={id}
        {...aria}
        aria-invalid={aria["aria-invalid"] || !!syntax}
        spellCheck={false}
        rows={lines}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value) as JsonValue;
            setSyntax(null);
            onDraftError(null);
            onChange(parsed);
          } catch (err) {
            const msg = `Invalid JSON: ${(err as Error).message}`;
            setSyntax(msg);
            onDraftError(msg);
          }
        }}
        className={cx(inputClass, "resize-y font-mono text-xs leading-5")}
      />
      {syntax && <p className="text-xs text-bad">{syntax}</p>}
    </div>
  );
}
