import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { findSample } from "@playground/contract-loader";
import type { FunctionInput, JsonValue, TypeDef } from "@playground/shared-types";
import { ArgField } from "@/components/workspace/arg-field";

const spec = findSample("sample-token")!.spec;

/** Renders an ArgField with real state so typing behaves as in the app. */
function Harness({
  type,
  initial,
  onValue,
  onDraftError = () => {},
  errors = [],
}: {
  type: TypeDef;
  initial?: JsonValue;
  onValue?: (v: JsonValue) => void;
  onDraftError?: (m: string | null) => void;
  errors?: { path: string; message: string }[];
}) {
  const [value, setValue] = useState<JsonValue | undefined>(initial);
  const input: FunctionInput = { name: "arg", type, doc: "Some help." };
  return (
    <ArgField
      input={input}
      spec={spec}
      value={value}
      errors={errors}
      onDraftError={onDraftError}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

describe("ArgField", () => {
  it("parses small integers as numbers and keeps bad input as text for validation", async () => {
    const onValue = vi.fn();
    render(<Harness type={{ kind: "u32" }} onValue={onValue} />);
    const input = screen.getByLabelText("arg");
    await userEvent.type(input, "42");
    expect(onValue).toHaveBeenLastCalledWith(42);
    await userEvent.type(input, "x");
    expect(onValue).toHaveBeenLastCalledWith("42x");
  });

  it("keeps 128-bit integers as strings so no precision is lost", async () => {
    const onValue = vi.fn();
    render(<Harness type={{ kind: "i128" }} onValue={onValue} />);
    await userEvent.type(screen.getByLabelText("arg"), "170141183460469231731687303715884105727");
    expect(onValue).toHaveBeenLastCalledWith("170141183460469231731687303715884105727");
  });

  it("uses a checkbox for bools", async () => {
    const onValue = vi.fn();
    render(<Harness type={{ kind: "bool" }} onValue={onValue} />);
    await userEvent.click(screen.getByLabelText("arg"));
    expect(onValue).toHaveBeenLastCalledWith(true);
  });

  it("toggles options between None and an example value", async () => {
    const onValue = vi.fn();
    render(<Harness type={{ kind: "option", value: { kind: "u32" } }} initial={null} onValue={onValue} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "None" }));
    expect(screen.getByRole("checkbox", { name: "Some(value)" })).toBeChecked();
    expect(onValue).toHaveBeenLastCalledWith(expect.any(Number));
    await userEvent.click(screen.getByRole("checkbox", { name: "Some(value)" }));
    expect(onValue).toHaveBeenLastCalledWith(null);
  });

  it("edits structs as JSON and reports syntax errors", async () => {
    const onValue = vi.fn();
    const onDraftError = vi.fn();
    render(<Harness type={{ kind: "udt", name: "Payment" }} onValue={onValue} onDraftError={onDraftError} />);
    const box = screen.getByLabelText("arg");
    expect(JSON.parse((box as HTMLTextAreaElement).value)).toHaveProperty("amount");

    await userEvent.clear(box);
    await userEvent.type(box, "{{");
    expect(onDraftError).toHaveBeenLastCalledWith(expect.stringMatching(/^Invalid JSON/));
    expect(box).toHaveAttribute("aria-invalid", "true");

    await userEvent.clear(box);
    await userEvent.type(box, '{{"amount":"5","to":"G"}');
    expect(onDraftError).toHaveBeenLastCalledWith(null);
    expect(onValue).toHaveBeenLastCalledWith({ amount: "5", to: "G" });
  });

  it("ties validation errors to the field for screen readers", () => {
    render(<Harness type={{ kind: "u32" }} initial={-1} errors={[{ path: "arg", message: "-1 is out of range for u32" }]} />);
    const input = screen.getByLabelText("arg");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Some help. -1 is out of range for u32");
  });
});
