"use client";
import { useCallback } from "react";
import { SCENARIO_VERSION, type Scenario, type ScenarioCollection, type SimulationStatus } from "@playground/shared-types";
import { usePersistentState } from "./storage";

export interface LastRun {
  at: string;
  passed: boolean;
  status: SimulationStatus | "failed_to_run";
  failures: string[];
}

interface Store {
  scenarios: Scenario[];
  lastRuns: Record<string, LastRun>;
}

const EMPTY: Store = { scenarios: [], lastRuns: {} };

/** Saved scenarios live in this browser only; export or share them to move them elsewhere. */
export function useScenarioStore() {
  const [store, setStore] = usePersistentState<Store>("scenarios", EMPTY);

  const upsert = useCallback(
    (items: Scenario[]) =>
      setStore((prev) => {
        const byId = new Map(prev.scenarios.map((s) => [s.id, s]));
        for (const s of items) byId.set(s.id, s);
        return { ...prev, scenarios: [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
      }),
    [setStore],
  );

  const remove = useCallback(
    (id: string) =>
      setStore((prev) => {
        const { [id]: _drop, ...lastRuns } = prev.lastRuns;
        return { scenarios: prev.scenarios.filter((s) => s.id !== id), lastRuns };
      }),
    [setStore],
  );

  const recordRun = useCallback(
    (id: string, run: LastRun) => setStore((prev) => ({ ...prev, lastRuns: { ...prev.lastRuns, [id]: run } })),
    [setStore],
  );

  return {
    scenarios: store.scenarios,
    lastRuns: store.lastRuns,
    upsert,
    remove,
    recordRun,
    get: (id: string) => store.scenarios.find((s) => s.id === id),
  };
}

export function toCollection(scenarios: Scenario[]): ScenarioCollection {
  return {
    schema: "stellar-playground/scenario-collection",
    version: SCENARIO_VERSION,
    exportedAt: new Date().toISOString(),
    scenarios,
  };
}

/** Gives an imported scenario a fresh ID if it would overwrite a different saved scenario. */
export function dedupeId(incoming: Scenario, existing: Scenario[]): Scenario {
  const clash = existing.find((s) => s.id === incoming.id);
  if (!clash || clash.updatedAt === incoming.updatedAt) return incoming;
  return { ...incoming, id: `${incoming.id}-${Math.random().toString(16).slice(2, 6)}` };
}
