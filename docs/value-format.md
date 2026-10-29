---
title: Argument and value format
description: How each Soroban type is written as JSON.
order: 5
---

# Argument and value format

Arguments are entered as JSON values. The same conventions are used to display return values and event data, so a value copied from a result can be pasted back as an argument of the same type.

| Soroban type                                 | JSON                                             | Example                                     |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| `bool`                                       | boolean                                          | `true`                                      |
| `u32`, `i32`                                 | number                                           | `42`                                        |
| `u64`, `i64`, `u128`, `i128`, `u256`, `i256` | decimal string (numbers accepted up to 2^53)     | `"170141183460469231731687303715884105727"` |
| `Timepoint`, `Duration`                      | decimal string or number (seconds)               | `"1735689600"`                              |
| `Bytes`                                      | hex string, optional `0x`                        | `"0xdeadbeef"`                              |
| `BytesN<N>`                                  | exactly `2N` hex characters                      | `"00…00"`                                   |
| `String`                                     | string                                           | `"hello"`                                   |
| `Symbol`                                     | string of up to 32 `a-z A-Z 0-9 _`               | `"transfer"`                                |
| `Address`                                    | `G…` account or `C…` contract                    | `"GDMG…NJFP"`                               |
| `MuxedAddress`                               | `G…`, `M…` or `C…`                               | `"MA…"`                                     |
| `Option<T>`                                  | `null` for `None`, otherwise the value           | `null`                                      |
| `Vec<T>`                                     | array                                            | `[1, 2, 3]`                                 |
| `(A, B)` tuple                               | array of fixed length                            | `[1, "x"]`                                  |
| `Map<String/Symbol, V>`                      | object                                           | `{ "a": 1 }`                                |
| `Map<K, V>` (other keys)                     | array of `[key, value]` pairs                    | `[[1, true], [2, false]]`                   |
| struct                                       | object with every field                          | `{ "to": "G…", "amount": "10" }`            |
| tuple struct                                 | array                                            | `[1, true]`                                 |
| union (enum with data)                       | `"Case"` or `{ "tag": "Case", "values": [...] }` | `{ "tag": "Text", "values": ["hi"] }`       |
| integer enum                                 | case name or value                               | `"Red"` or `0`                              |
| `Val` (untyped)                              | `{ "type": "<primitive>", "value": … }`          | `{ "type": "u32", "value": 1 }`             |

## Escape hatch: raw XDR

Anywhere a value is expected you can pass `{ "$xdr": "<base64 ScVal>" }` to supply an exact encoded value. This is useful for types the playground cannot express, or to reproduce a value copied from another tool.

## Validation

Values are validated against the function's spec as you type. Errors point at the exact location, for example `payments[1].amount: 12abc is not an integer`. The playground refuses to send a simulation while any argument is invalid, and it warns if you paste a secret key (`S…`) anywhere.

## Differences from the Stellar CLI

The CLI writes unions as `{ "Text": "hi" }` instead of `{ "tag": "Text", "values": ["hi"] }`. The **Stellar CLI** export converts automatically.
