"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { NETWORKS, type NetworkConfig, type NetworkId } from "@playground/shared-types";
import { usePersistentState } from "./storage";

export type ActiveNetwork = NetworkConfig & { label: string };

export interface RecentContract {
  contractId: string;
  networkPassphrase: string;
  label?: string;
  openedAt: string;
}

interface Settings {
  network: ActiveNetwork;
  setNetwork: (n: ActiveNetwork) => void;
  selectPreset: (id: Exclude<NetworkId, "custom">) => void;
  recents: RecentContract[];
  addRecent: (r: Omit<RecentContract, "openedAt">) => void;
  clearRecents: () => void;
  theme: "system" | "light" | "dark";
  setTheme: (t: "system" | "light" | "dark") => void;
}

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = usePersistentState<ActiveNetwork>("network", NETWORKS.testnet);
  const [recents, setRecents] = usePersistentState<RecentContract[]>("recents", []);
  const [theme, setThemeState] = usePersistentState<"system" | "light" | "dark">("theme", "system");

  const value = useMemo<Settings>(
    () => ({
      network,
      setNetwork,
      selectPreset: (id) => setNetwork(NETWORKS[id]),
      recents,
      addRecent: (r) =>
        setRecents((prev) =>
          [
            { ...r, openedAt: new Date().toISOString() },
            ...prev.filter((p) => !(p.contractId === r.contractId && p.networkPassphrase === r.networkPassphrase)),
          ].slice(0, 8),
        ),
      clearRecents: () => setRecents([]),
      theme,
      setTheme: (t) => {
        setThemeState(t);
        applyTheme(t);
      },
    }),
    [network, setNetwork, recents, setRecents, theme, setThemeState],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function applyTheme(t: "system" | "light" | "dark") {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}

/** Inline script that applies the saved theme before first paint (prevents a flash). */
export const THEME_BOOTSTRAP = `(function(){try{var t=JSON.parse(localStorage.getItem("sdp:v1:theme")||'"system"');var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})();`;
