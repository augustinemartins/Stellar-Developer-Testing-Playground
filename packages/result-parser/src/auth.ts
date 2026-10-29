import { xdr } from "@stellar/stellar-sdk";
import type { AuthEntryInfo, InvocationNode } from "@playground/shared-types";
import { scAddressToString, scValToJson, scValTypeTag } from "./scval";

function invocationNode(inv: xdr.SorobanAuthorizedInvocation): InvocationNode {
  const fn = inv.function;
  const subInvocations = inv.subInvocations.map(invocationNode);
  if (fn.type === "sorobanAuthorizedFunctionTypeContractFn") {
    return {
      kind: "contract_fn",
      contractId: scAddressToString(fn.contractFn.contractAddress),
      functionName: fn.contractFn.functionName.toString(),
      args: fn.contractFn.args.map((a) => ({ type: scValTypeTag(a), json: scValToJson(a) })),
      subInvocations,
    };
  }
  if (
    fn.type === "sorobanAuthorizedFunctionTypeCreateContractHostFn" ||
    fn.type === "sorobanAuthorizedFunctionTypeCreateContractV2HostFn"
  ) {
    return { kind: "create_contract", args: [], subInvocations };
  }
  return { kind: "unknown", args: [], subInvocations };
}

/** Decodes a `SorobanAuthorizationEntry` (base64 or XDR object). */
export function parseAuthEntry(input: xdr.SorobanAuthorizationEntry | string): AuthEntryInfo {
  const entry = typeof input === "string" ? xdr.SorobanAuthorizationEntry.fromXdr(input, "base64") : input;
  const creds = entry.credentials;
  const invocation = invocationNode(entry.rootInvocation);
  const xdrB64 = entry.toXdr("base64");
  if (creds.type === "sorobanCredentialsSourceAccount") {
    return { credentials: "source_account", invocation, xdr: xdrB64 };
  }
  const address =
    creds.type === "sorobanCredentialsAddress"
      ? creds.address
      : creds.type === "sorobanCredentialsAddressV2"
        ? creds.addressV2
        : creds.addressWithDelegates.addressCredentials;
  return {
    credentials: "address",
    address: scAddressToString(address.address),
    nonce: address.nonce.toString(),
    signatureExpirationLedger: address.signatureExpirationLedger,
    invocation,
    xdr: xdrB64,
  };
}

/** Addresses that must sign for the invocation (the source account is reported as `source`). */
export function requiredSigners(auth: AuthEntryInfo[]): string[] {
  return [...new Set(auth.map((a) => (a.credentials === "source_account" ? "source" : a.address!)))];
}
