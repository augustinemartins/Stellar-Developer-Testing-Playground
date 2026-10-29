"use client";
import {
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Info, Loader2, XCircle } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-90 border-transparent",
  secondary: "bg-panel text-fg border-border hover:bg-panel-2",
  ghost: "bg-transparent text-fg border-transparent hover:bg-panel-2",
  danger: "bg-transparent text-bad border-bad/40 hover:bg-bad/10",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "accent";
const TONES: Record<Tone, string> = {
  neutral: "bg-panel-2 text-muted border-border",
  ok: "bg-ok/10 text-ok border-ok/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  bad: "bg-bad/10 text-bad border-bad/30",
  info: "bg-info/10 text-info border-info/30",
  accent: "bg-accent/10 text-accent border-accent/30",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded border px-1.5 py-px font-mono text-[11px] leading-4", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ children, className, as: As = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article"; "aria-labelledby"?: string }) {
  return (
    <As {...rest} className={cx("rounded-lg border border-border bg-panel", className)}>
      {children}
    </As>
  );
}

const ALERT_ICONS = { info: Info, ok: CheckCircle2, warn: AlertTriangle, bad: XCircle } as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: keyof typeof ALERT_ICONS;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div role={role} className={cx("flex gap-3 rounded-lg border p-3 text-sm", TONES[tone], className)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1 text-fg">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className="text-fg/90">{children}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <Loader2 aria-hidden className="size-4 animate-spin" />
      {label}
    </span>
  );
}

export function CopyButton({ text, label = "Copy", className, size = "sm" }: { text: string; label?: string; className?: string; size?: "sm" | "md" }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <Button
      size={size}
      variant="ghost"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 1600);
      }}
    >
      {state === "copied" ? <Check aria-hidden className="size-3.5 text-ok" /> : <Copy aria-hidden className="size-3.5" />}
      <span>{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}</span>
      <span className="sr-only" role="status">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Could not copy to clipboard" : ""}
      </span>
    </Button>
  );
}

export interface TabDef {
  id: string;
  label: ReactNode;
  count?: number;
}

/** WAI-ARIA tabs with roving focus (arrow keys, Home, End). */
export function Tabs({
  tabs,
  active,
  onChange,
  label,
  children,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  label: string;
  children: ReactNode;
}) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = tabs.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next]!.id);
    refs.current[next]?.focus();
  };
  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border px-2">
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cx(
                "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                selected ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="rounded bg-panel-2 px-1.5 font-mono text-[11px] text-muted">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${active}`} tabIndex={0} className="focus-visible:outline-offset-[-2px]">
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div className="font-medium">{title}</div>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Mono({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <code title={title} className={cx("font-mono text-[12.5px] break-all", className)}>
      {children}
    </code>
  );
}

export function shorten(value: string, keep = 6): string {
  return value.length > keep * 2 + 1 ? `${value.slice(0, keep)}…${value.slice(-keep)}` : value;
}

export const inputClass =
  "w-full rounded-md border border-border bg-panel px-2.5 py-1.5 text-sm text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none aria-[invalid=true]:border-bad";
