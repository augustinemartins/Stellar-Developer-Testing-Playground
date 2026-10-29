"use client";
import { useId, useState } from "react";
import { ArrowRight } from "lucide-react";
import { checkContractId } from "@playground/contract-loader";
import { Button, cx, inputClass } from "./ui";

/** Contract ID entry with inline validation. Calls `onSubmit` only with a valid C… address. */
export function ContractIdInput({ onSubmit, defaultValue = "" }: { onSubmit: (contractId: string) => void; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [touched, setTouched] = useState(false);
  const id = useId();
  const check = checkContractId(value);
  const showError = touched && !check.ok && value.trim().length > 0;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (check.ok) onSubmit(check.value);
      }}
      className="space-y-1.5"
    >
      <label htmlFor={id} className="block text-sm font-medium">
        Contract ID
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name="contractId"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          onPaste={() => setTouched(true)}
          placeholder="C… (56 characters)"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={showError}
          aria-describedby={`${id}-hint`}
          className={cx(inputClass, "h-10 font-mono")}
        />
        <Button type="submit" variant="primary" className="h-10 shrink-0" disabled={!value.trim()}>
          Open <ArrowRight aria-hidden className="size-4" />
        </Button>
      </div>
      <p id={`${id}-hint`} className={cx("text-xs", showError ? "text-bad" : "text-muted")} aria-live="polite">
        {showError && !check.ok ? check.reason : "Paste any deployed contract address. Its interface is read from the on-chain WASM."}
      </p>
    </form>
  );
}
