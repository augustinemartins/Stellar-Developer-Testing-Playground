---
title: Errors and troubleshooting
description: What simulation errors mean and how to fix them.
order: 7
---

# Errors and troubleshooting

The playground classifies every failure:

| Kind         | Meaning                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validation` | The playground refused to build the transaction because an input is invalid. Nothing was sent.                                                            |
| `contract`   | The contract returned one of its own error codes (`Error(Contract, #n)`). When the spec declares the error enum, the case name and doc comment are shown. |
| `host`       | The Soroban host rejected the call (budget, storage, auth, value conversion…).                                                                            |
| `rpc`        | The RPC rejected the request.                                                                                                                             |
| `network`    | The RPC could not be reached.                                                                                                                             |

## Common host errors

| Error                          | Likely cause                                    | What to try                                                                    |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `Error(Auth, InvalidAction)`   | `require_auth` with no valid authorization      | Use **Record** mode to see which signatures are needed.                        |
| `Error(Storage, MissingValue)` | A storage key the contract reads does not exist | The contract may be uninitialised, or the entry archived or never written.     |
| `Error(Budget, ExceededLimit)` | The call exceeds CPU or memory limits           | Smaller inputs or batches; fewer storage reads.                                |
| `Error(WasmVm, InvalidAction)` | The contract panicked or trapped                | `unwrap()` on `None`, explicit `panic!`, overflow. Check the diagnostic trace. |
| `Error(WasmVm, MissingValue)`  | The function does not exist                     | Check the method name; the spec may not match the deployed contract.           |
| `Error(Value, UnexpectedType)` | An argument has the wrong type                  | The spec may not match the deployed contract.                                  |

## Loading problems

**Contract not found.** The ID is valid but no contract exists on the selected network. Check the network selector. Testnet is reset periodically, which removes every contract — see [Redeploying the samples](deploying-samples.md).

**No contract interface.** The WASM has no `contractspecv0` section (it was built without `soroban-sdk` metadata, or the spec was stripped). Use **Import spec** with a JSON spec, the base64 output of `stellar contract info interface --output xdr-base64-array`, or the original `.wasm` file.

**Could not reach the RPC.** The RPC may be down, rate-limiting, or blocking cross-origin requests. Public SDF endpoints allow browser requests; for other providers check their CORS policy.

## Source account messages

- _not funded on this network_ — the source account does not exist. Simulation still works with a placeholder sequence number; use **Create funded test account** if a contract checks the source's existence.
- _That is a secret key_ — the playground never needs secret keys. Clear the field and use the public `G…` key.
