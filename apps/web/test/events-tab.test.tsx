import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DecodedEvent, DecodedValue } from "@playground/shared-types";
import type { SimulationRun } from "@playground/simulation-engine";
import { EventsTab } from "@/components/results/events-tab";

const ME = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR";
const sym = (s: string): DecodedValue => ({ xdr: "", type: "symbol", json: s });
const VOID: DecodedValue = { xdr: "AAAAAQ==", type: "void", json: null };

function ev(index: number, over: Partial<DecodedEvent>): DecodedEvent {
  return { index, type: "diagnostic", contractId: ME, inSuccessfulContractCall: true, topics: [], data: VOID, xdr: "", ...over };
}

const events: DecodedEvent[] = [
  ev(0, { name: "fn_call", topics: [sym("fn_call"), sym(ME), sym("increment_by")] }),
  ev(1, { type: "contract", name: "Incremented", params: { by: 5, count: 6 } }),
  ev(2, { name: "fn_return", topics: [sym("fn_return"), sym("increment_by")] }),
];

const run = (evs: DecodedEvent[]) => ({ contractId: ME, report: { status: "success", events: evs } }) as unknown as SimulationRun;

describe("EventsTab", () => {
  it("shows contract events by default and the full trace on request, nested by call depth", async () => {
    render(<EventsTab run={run(events)} />);
    const list = screen.getByRole("list", { name: "Events in emission order" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByRole("button", { name: /Incremented/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Full trace/ }));
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("→ increment_by");
    expect(items[1]!.style.paddingLeft).toBe("1.1rem");
    expect(items[2]).toHaveTextContent("← increment_by returned");
    expect(items[2]!.style.paddingLeft).toBe("0rem");
  });

  it("searches names and decoded params", async () => {
    render(<EventsTab run={run(events)} />);
    await userEvent.click(screen.getByRole("button", { name: /Full trace/ }));
    const search = screen.getByRole("searchbox", { name: "Search events" });
    await userEvent.type(search, "count");
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
    await userEvent.clear(search);
    await userEvent.type(search, "nothing-like-this");
    expect(screen.getByText(/No events match/)).toBeInTheDocument();
  });

  it("marks events from failed calls as rolled back and explains the empty view", () => {
    const failed = [ev(0, { type: "contract", name: "Incremented", inSuccessfulContractCall: false })];
    render(<EventsTab run={run(failed)} />);
    expect(screen.getByText("rolled back")).toBeInTheDocument();
    render(
      <EventsTab
        run={
          {
            ...run([ev(0, { name: "error" })]),
            report: { status: "error", events: [ev(0, { name: "error" })] },
          } as unknown as SimulationRun
        }
      />,
    );
    expect(screen.getByText(/Failed calls roll back their events/)).toBeInTheDocument();
  });

  it("shows an empty state when nothing was emitted", () => {
    render(<EventsTab run={run([])} />);
    expect(screen.getByText("No events")).toBeInTheDocument();
  });
});
