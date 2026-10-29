import { xdr } from "@stellar/stellar-sdk";
import { bytesToHex, type LedgerKeyInfo } from "@playground/shared-types";
import { decodeScVal, scAddressToString } from "./scval";

export function shortId(id: string, keep = 4): string {
  return id.length > keep * 2 + 1 ? `${id.slice(0, keep)}…${id.slice(-keep)}` : id;
}

function compactJson(value: unknown, max = 48): string {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Summarises a ledger key for footprints and state changes. */
export function describeLedgerKey(input: xdr.LedgerKey | string): LedgerKeyInfo {
  const key = typeof input === "string" ? xdr.LedgerKey.fromXdr(input, "base64") : input;
  const base = { xdr: key.toXdr("base64") };
  switch (key.type) {
    case "contractData": {
      const cd = key.contractData;
      const contractId = scAddressToString(cd.contract);
      const durability = cd.durability.name === "temporary" ? ("temporary" as const) : ("persistent" as const);
      const decoded = decodeScVal(cd.key);
      const keyLabel =
        cd.key.type === "scvLedgerKeyContractInstance"
          ? "instance"
          : cd.key.type === "scvLedgerKeyNonce"
            ? `auth nonce ${cd.key.nonceKey.nonce}`
            : compactJson(decoded.json);
      return {
        ...base,
        type: "contract_data",
        contractId,
        durability,
        key: decoded,
        label: `${keyLabel} · ${durability} · ${shortId(contractId)}`,
      };
    }
    case "contractCode":
      return { ...base, type: "contract_code", label: `WASM ${bytesToHex(key.contractCode.hash.toXdr()).slice(0, 12)}…` };
    case "account": {
      const accountId = scAddressToString(xdr.ScAddress.scAddressTypeAccount(key.account.accountId));
      return { ...base, type: "account", accountId, label: `account ${shortId(accountId)}` };
    }
    case "trustline": {
      const accountId = scAddressToString(xdr.ScAddress.scAddressTypeAccount(key.trustLine.accountId));
      return { ...base, type: "trustline", accountId, label: `trustline ${shortId(accountId)}` };
    }
    default:
      return { ...base, type: key.type, label: key.type };
  }
}
