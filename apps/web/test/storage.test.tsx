import { act, render, screen } from "@testing-library/react";
import type { Scenario } from "@playground/shared-types";
import { readStored, usePersistentState, writeStored } from "@/lib/storage";
import { dedupeId } from "@/lib/scenarios";

function Counter() {
  const [n, setN] = usePersistentState("count", 0);
  return <button onClick={() => setN((p) => p + 1)}>{n}</button>;
}

describe("persistent storage", () => {
  it("round-trips values and survives corrupt data", () => {
    writeStored("k", { a: 1 });
    expect(readStored("k", null)).toEqual({ a: 1 });
    window.localStorage.setItem("sdp:v1:k", "{not json");
    expect(readStored("k", "fallback")).toBe("fallback");
  });

  it("keeps working when localStorage throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => writeStored("x", 1)).not.toThrow();
    spy.mockRestore();
  });

  it("re-renders every hook that shares a key", () => {
    render(
      <>
        <Counter />
        <Counter />
      </>,
    );
    act(() => screen.getAllByRole("button")[0]!.click());
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["1", "1"]);
  });
});

describe("dedupeId", () => {
  const base = { id: "s1", updatedAt: "2026-01-01T00:00:00Z" } as Scenario;

  it("keeps the ID for the same scenario or a new one", () => {
    expect(dedupeId(base, [base]).id).toBe("s1");
    expect(dedupeId(base, []).id).toBe("s1");
  });

  it("renames a different scenario that would overwrite a saved one", () => {
    const incoming = { ...base, updatedAt: "2026-02-01T00:00:00Z" };
    expect(dedupeId(incoming, [base]).id).toMatch(/^s1-[0-9a-f]+$/);
  });
});
