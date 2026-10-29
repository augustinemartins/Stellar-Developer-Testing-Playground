import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { findSample } from "@playground/contract-loader";
import { MethodList } from "@/components/workspace/method-list";

const counter = findSample("counter")!.spec;

describe("MethodList", () => {
  it("lists methods with signatures and read-only badges", () => {
    render(<MethodList functions={counter.functions} selected="get" onSelect={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "Contract methods" });
    const get = within(nav).getByRole("button", { name: /^get/ });
    expect(get).toHaveAttribute("aria-current", "true");
    expect(get).toHaveTextContent(/read/i);
    expect(within(nav).getByRole("button", { name: /^increment_by/ })).toHaveTextContent("(u32) → Result<u32, CounterError>");
  });

  it("filters by name and reports empty results", async () => {
    render(<MethodList functions={counter.functions} selected={null} onSelect={() => {}} />);
    const search = screen.getByRole("searchbox", { name: "Filter methods" });
    await userEvent.type(search, "incr");
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^increment\(/),
      expect.stringMatching(/^increment_by/),
    ]);
    await userEvent.clear(search);
    await userEvent.type(search, "zzz");
    expect(screen.getByText(/No methods match/)).toBeInTheDocument();
  });

  it("calls onSelect with the method name", async () => {
    const onSelect = vi.fn();
    render(<MethodList functions={counter.functions} selected={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /^reset/ }));
    expect(onSelect).toHaveBeenCalledWith("reset");
  });
});
