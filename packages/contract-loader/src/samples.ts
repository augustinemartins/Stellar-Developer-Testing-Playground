import { Asset, Networks } from "@stellar/stellar-sdk";
import type { ContractSpec, JsonValue } from "@playground/shared-types";
import counterFixture from "./fixtures/counter.spec.json";
import tokenFixture from "./fixtures/sample-token.spec.json";
import deployments from "./fixtures/deployments.json";
import { STELLAR_ASSET_SPEC } from "./loader";

export interface SuggestedCall {
  title: string;
  method: string;
  args: Record<string, JsonValue>;
  /** What the learner should notice in the result. */
  description: string;
}

export interface SampleContract {
  slug: "counter" | "sample-token" | "native-xlm";
  title: string;
  summary: string;
  /** Testnet contract ID, or null if the sample has not been deployed. */
  contractId: string | null;
  spec: ContractSpec;
  wasmHash: string | null;
  /** Repository path of the contract source. */
  sourcePath?: string;
  suggestedCalls: SuggestedCall[];
}

export const SAMPLE_DEPLOYMENTS = deployments as {
  network: string;
  deployedAt: string;
  accounts: { owner: string; holder: string };
  contracts: Record<"counter" | "sample-token", { contractId: string; wasmHash: string }>;
};

/** The native XLM Stellar Asset Contract. Its ID is derived from the network passphrase, so it survives resets. */
export const NATIVE_XLM_TESTNET = Asset.native().contractId(Networks.TESTNET);

const { owner, holder } = SAMPLE_DEPLOYMENTS.accounts;

export const SAMPLE_CONTRACTS: SampleContract[] = [
  {
    slug: "counter",
    title: "Counter",
    summary: "A tiny stateful contract. Shows return values, typed errors, events, authorization and storage footprints.",
    contractId: SAMPLE_DEPLOYMENTS.contracts.counter.contractId,
    spec: counterFixture.spec as ContractSpec,
    wasmHash: counterFixture.wasmHash,
    sourcePath: "contracts/counter/src/lib.rs",
    suggestedCalls: [
      { title: "Read the count", method: "get", args: {}, description: "A read-only call: no auth, no events, a small footprint." },
      {
        title: "Increment by 5",
        method: "increment_by",
        args: { step: 5 },
        description: "Writes instance storage and emits an `Incremented` event. Nothing is submitted.",
      },
      {
        title: "Trigger InvalidStep",
        method: "increment_by",
        args: { step: 0 },
        description: "Returns contract error #2, which the playground maps to `CounterError::InvalidStep`.",
      },
      {
        title: "Reset as owner",
        method: "reset",
        args: { caller: owner },
        description: "Requires the owner's signature. The Auth tab shows the authorization entry a wallet would sign.",
      },
      { title: "Read stats", method: "stats", args: {}, description: "Returns a struct, decoded field by field." },
    ],
  },
  {
    slug: "sample-token",
    title: "Sample token",
    summary: "A SEP-41 style token with structs, vectors, options and unions in its arguments.",
    contractId: SAMPLE_DEPLOYMENTS.contracts["sample-token"].contractId,
    spec: tokenFixture.spec as ContractSpec,
    wasmHash: tokenFixture.wasmHash,
    sourcePath: "contracts/sample-token/src/lib.rs",
    suggestedCalls: [
      { title: "Holder balance", method: "balance", args: { id: holder }, description: "An i128 balance with 7 decimals." },
      { title: "Token metadata", method: "metadata", args: {}, description: "A struct return value." },
      {
        title: "Transfer with memo",
        method: "transfer_with_memo",
        args: { from: holder, to: owner, amount: "10000000", memo: { tag: "Text", values: ["thanks"] } },
        description: "An Option<Memo> union argument, two events and an auth entry for `from`.",
      },
      {
        title: "Batch transfer",
        method: "transfer_batch",
        args: {
          from: holder,
          payments: [
            { to: owner, amount: "5000000" },
            { to: owner, amount: "2500000" },
          ],
        },
        description: "A Vec<Payment> of structs; the return value is the total sent.",
      },
      {
        title: "Overdraft",
        method: "transfer",
        args: { from: owner, to: holder, amount: "1" },
        description: "The owner holds no tokens, so this fails with `TokenError::InsufficientBalance`.",
      },
    ],
  },
  {
    slug: "native-xlm",
    title: "Native XLM (Stellar Asset Contract)",
    summary: "The built-in token contract for lumens. Always available on testnet, even after resets.",
    contractId: NATIVE_XLM_TESTNET,
    spec: STELLAR_ASSET_SPEC,
    wasmHash: null,
    suggestedCalls: [
      { title: "Symbol", method: "symbol", args: {}, description: "Returns `native`." },
      { title: "Decimals", method: "decimals", args: {}, description: "Lumens use 7 decimals." },
      { title: "Holder balance", method: "balance", args: { id: holder }, description: "The friendbot-funded balance, in stroops." },
    ],
  },
];

export function findSample(slugOrId: string): SampleContract | undefined {
  return SAMPLE_CONTRACTS.find((s) => s.slug === slugOrId || s.contractId === slugOrId);
}
