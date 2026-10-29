"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { NETWORKS, type NetworkId } from "@playground/shared-types";
import { checkNetwork, type NetworkHealth } from "@playground/simulation-engine";
import { useSettings } from "@/lib/settings";
import { Button, cx, inputClass } from "./ui";

const PRESETS = Object.values(NETWORKS);

export function useNetworkHealth() {
  const { network } = useSettings();
  // Results are tagged with the network they belong to, so switching networks shows "checking…" until the new result arrives.
  const key = `${network.rpcUrl}|${network.networkPassphrase}`;
  const [result, setResult] = useState<{ key: string; health: NetworkHealth } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = () => checkNetwork(network).then((health) => !cancelled && setResult({ key, health }));
    check();
    const t = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [network, key]);
  return result?.key === key ? result.health : null;
}

export function NetworkSelector() {
  const { network, setNetwork, selectPreset } = useSettings();
  const health = useNetworkHealth();
  const [open, setOpen] = useState(false);
  const [rpcUrl, setRpcUrl] = useState(network.rpcUrl);
  const [passphrase, setPassphrase] = useState(network.networkPassphrase);
  const [error, setError] = useState<string | null>(null);
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dot = health === null ? "bg-muted animate-pulse" : health.ok ? "bg-ok" : "bg-bad";
  const status =
    health === null
      ? "checking…"
      : health.ok
        ? `protocol ${health.protocolVersion}, ledger ${health.latestLedger?.toLocaleString("en-US")}`
        : `unreachable: ${health.error ?? "unknown error"}`;

  const applyCustom = () => {
    try {
      const u = new URL(rpcUrl);
      if (u.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(u.hostname)) {
        setError("Use https:// (plain http is only allowed for localhost).");
        return;
      }
    } catch {
      setError("Enter a valid URL.");
      return;
    }
    if (!passphrase.trim()) {
      setError("Enter the network passphrase.");
      return;
    }
    setError(null);
    setNetwork({ id: "custom", label: "Custom", rpcUrl: rpcUrl.trim(), networkPassphrase: passphrase.trim() });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          // Start the custom RPC form from the current network each time the panel opens.
          if (!open) {
            setRpcUrl(network.rpcUrl);
            setPassphrase(network.networkPassphrase);
            setError(null);
          }
          setOpen(!open);
        }}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-panel px-2.5 text-sm hover:bg-panel-2"
        title={status}
      >
        <span aria-hidden className={cx("size-2 rounded-full", dot)} />
        <span className="max-w-[10rem] truncate">{network.label}</span>
        <span className="sr-only">network, {status}</span>
        <ChevronDown aria-hidden className="size-4 text-muted" />
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 z-40 mt-2 w-[22rem] rounded-lg border border-border bg-panel p-3 shadow-xl">
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Globe aria-hidden className="size-3.5" /> Network
            </legend>
            <div className="space-y-1">
              {PRESETS.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-panel-2">
                  <input
                    type="radio"
                    name="network"
                    className="mt-1"
                    checked={network.id === p.id}
                    onChange={() => {
                      selectPreset(p.id as Exclude<NetworkId, "custom">);
                      setOpen(false);
                    }}
                  />
                  <span>
                    <span className="block text-sm">{p.label}</span>
                    <span className="block font-mono text-[11px] text-muted">{p.rpcUrl}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <form
            className="mt-3 space-y-2 border-t border-border pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              applyCustom();
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Custom RPC</div>
            <label className="block text-xs">
              RPC URL
              <input className={cx(inputClass, "mt-1 font-mono text-xs")} value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} />
            </label>
            <label className="block text-xs">
              Network passphrase
              <input
                className={cx(inputClass, "mt-1 font-mono text-xs")}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-xs text-bad">
                {error}
              </p>
            )}
            <Button type="submit" size="sm" variant="primary">
              Use custom RPC
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted" aria-live="polite">
            Status: {status}
          </p>
        </div>
      )}
    </div>
  );
}
