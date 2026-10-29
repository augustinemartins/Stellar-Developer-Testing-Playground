import { contractErrorCases, type ContractSpec, type SimulationError } from "@playground/shared-types";

const HOST_ERROR = /Error\((\w+), #?(\w+)\)/;

const HINTS: Record<string, string> = {
  "Auth:InvalidAction":
    "Authorization is missing or invalid. In `enforce` mode every require_auth needs a matching signed entry; switch to `record` mode to discover which entries are needed.",
  "Storage:MissingValue":
    "The contract read a storage key that does not exist. The contract may be uninitialised, the key may never have been written, or the entry may be archived.",
  "Storage:ExceededLimit": "The call touches more ledger entries or bytes than one transaction may.",
  "Budget:ExceededLimit":
    "The call exceeds the per-transaction CPU instruction or memory limit. Reduce the work done (smaller batch, fewer storage reads).",
  "WasmVm:InvalidAction":
    "The contract panicked or trapped: an `unwrap()` on None/Err, an explicit `panic!`, arithmetic overflow or an out-of-bounds access.",
  "WasmVm:MissingValue": "The function does not exist on this contract. Check the method name against the spec.",
  "Value:UnexpectedType": "An argument or stored value has an unexpected type. Check the arguments against the function's spec.",
  "Value:InvalidInput": "An argument could not be converted to the type the contract expects.",
  "Value:UnexpectedSize": "An argument has the wrong number of elements (e.g. BytesN length or tuple arity).",
  "Context:InvalidAction": "The host rejected the call in the current context, e.g. re-entrancy or calling a constructor directly.",
  "Object:UnexpectedSize": "A value has the wrong size. BytesN arguments must have exactly N bytes.",
};

function firstLine(text: string): string {
  return (
    text
      .split("\n")
      .find((l) => l.trim().length > 0)
      ?.trim() ?? text
  );
}

/** Classifies an RPC simulation error string. */
export function parseSimulationError(raw: string, spec?: ContractSpec): SimulationError {
  const m = HOST_ERROR.exec(raw);
  if (!m) {
    if (/account not found|Account not found|missing account/i.test(raw)) {
      return {
        kind: "rpc",
        summary: "The source account does not exist on this network.",
        hint: "Fund it with friendbot, or leave the source empty to simulate with a placeholder account.",
        raw,
      };
    }
    return { kind: "rpc", summary: firstLine(raw), raw };
  }
  const [, type, code] = m as unknown as [string, string, string];
  if (type === "Contract") {
    const n = Number(code);
    const known = spec ? contractErrorCases(spec).get(n) : undefined;
    return {
      kind: "contract",
      summary: known ? `Contract error #${n}: ${known.enumName}::${known.name}` : `Contract error #${n}`,
      hint: known?.doc,
      hostErrorType: type,
      hostErrorCode: code,
      contractErrorCode: n,
      contractErrorName: known ? `${known.enumName}::${known.name}` : undefined,
      contractErrorDoc: known?.doc,
      raw,
    };
  }
  return {
    kind: "host",
    summary: `Host error: ${type} / ${code}`,
    hint: HINTS[`${type}:${code}`],
    hostErrorType: type,
    hostErrorCode: code,
    raw,
  };
}
