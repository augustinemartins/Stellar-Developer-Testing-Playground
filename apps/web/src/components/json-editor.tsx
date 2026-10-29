"use client";
import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import type { JsonSchema } from "@playground/contract-loader";
import { cx } from "./ui";

const MONACO_VERSION = process.env.NEXT_PUBLIC_MONACO_VERSION ?? "0.52.2";

let configured = false;
async function configureLoader() {
  if (configured) return;
  const { loader } = await import("@monaco-editor/react");
  // Self-hosted copy (see scripts/copy-monaco.mjs): no CDN, works offline and under CSP.
  loader.config({ paths: { vs: `/monaco/${MONACO_VERSION}/vs` } });
  configured = true;
}

const MonacoEditor = dynamic(
  async () => {
    await configureLoader();
    return (await import("@monaco-editor/react")).default;
  },
  { ssr: false, loading: () => null },
);

function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export interface JsonEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /** JSON Schema used for validation and completion. */
  schema?: JsonSchema;
  readOnly?: boolean;
  height?: number | string;
  label: string;
  onSubmit?: () => void;
  className?: string;
}

/**
 * Monaco JSON editor with schema-driven completion. Falls back to a plain
 * textarea if Monaco cannot load, so the playground stays usable.
 */
export function JsonEditor({ value, onChange, schema, readOnly, height = 220, label, onSubmit, className }: JsonEditorProps) {
  const dark = useDarkMode();
  const modelId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const modelPath = `inmemory://playground/${modelId}.json`;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    const t = setTimeout(() => !ready && setFailed(true), 15_000);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !schema) return;
    // Each editor registers its own schema keyed by model path.
    const json = monaco.languages.json.jsonDefaults;
    const others = (json.diagnosticsOptions.schemas ?? []).filter((s) => s.uri !== `${modelPath}#schema`);
    json.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      enableSchemaRequest: false,
      schemas: [...others, { uri: `${modelPath}#schema`, fileMatch: [modelPath], schema }],
    });
  }, [schema, modelPath, ready]);

  if (failed && !ready) {
    return (
      <textarea
        aria-label={label}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit?.();
        }}
        style={{ height }}
        className={cx("w-full resize-y rounded-md border border-border bg-panel p-2 font-mono text-xs", className)}
      />
    );
  }

  return (
    <div className={cx("overflow-hidden rounded-md border border-border", className)} style={{ height }} aria-label={label} role="group">
      <MonacoEditor
        height="100%"
        language="json"
        path={modelPath}
        value={value}
        theme={dark ? "vs-dark" : "light"}
        onChange={(v) => onChange?.(v ?? "")}
        onMount={(editor, monaco) => {
          monacoRef.current = monaco;
          setReady(true);
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => submitRef.current?.());
          editor.getModel()?.updateOptions({ tabSize: 2 });
        }}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 12.5,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          ariaLabel: label,
          accessibilitySupport: "auto",
          renderLineHighlight: "none",
          fixedOverflowWidgets: true,
          quickSuggestions: { strings: true, other: true, comments: false },
        }}
      />
    </div>
  );
}
