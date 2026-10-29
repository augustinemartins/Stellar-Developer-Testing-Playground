import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContractIdInput } from "@/components/contract-id-input";

const VALID = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR";

describe("ContractIdInput", () => {
  it("submits a valid contract ID", async () => {
    const onSubmit = vi.fn();
    render(<ContractIdInput onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Contract ID"), `  ${VALID} `);
    await userEvent.click(screen.getByRole("button", { name: /open/i }));
    expect(onSubmit).toHaveBeenCalledWith(VALID);
  });

  it("disables the button while empty", () => {
    render(<ContractIdInput onSubmit={() => {}} />);
    expect(screen.getByRole("button", { name: /open/i })).toBeDisabled();
  });

  it("explains account addresses and blocks submission", async () => {
    const onSubmit = vi.fn();
    render(<ContractIdInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Contract ID");
    await userEvent.type(input, "GABC{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/C|account/);
  });

  it("does not show an error before the field is touched", async () => {
    render(<ContractIdInput onSubmit={() => {}} defaultValue="nope" />);
    expect(screen.getByLabelText("Contract ID")).toHaveAttribute("aria-invalid", "false");
  });
});
