import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Keypair, StrKey, type rpc, xdr } from "@stellar/stellar-sdk";
import { ContractSpecSchema } from "@playground/shared-types";
import {
  ContractLoadError,
  SAMPLE_CONTRACTS,
  STELLAR_ASSET_SPEC,
  argsJsonSchema,
  checkContractId,
  exampleArgs,
  findSample,
  loadContractFromNetwork,
  specFromWasm,
} from "../src";

const artifacts = join(__dirname, "../../../contracts/artifacts");
const tokenWasm = readFileSync(join(artifacts, "sample_token.wasm"));
const tokenSpec = specFromWasm(tokenWasm);
const VALID_ID = "CCXDNSDDFAEBDFNKTCWHVPGDSED37GMTFWDEY6Q4DMXBQ3BUHY3UMTJW";

describe("specFromWasm", () => {
  it("extracts functions, types, errors and events", () => {
    expect(tokenSpec.functions.map((f) => f.name)).toEqual(
      expect.arrayContaining(["balance", "transfer", "transfer_batch", "transfer_with_memo", "__constructor"]),
    );
    const memo = tokenSpec.types.find((t) => t.name === "Memo");
    expect(memo).toMatchObject({ kind: "union", cases: [{ name: "Text" }, { name: "Id" }, { name: "Hash" }] });
    const err = tokenSpec.types.find((t) => t.kind === "error_enum");
    expect(err).toMatchObject({
      name: "TokenError",
      cases: expect.arrayContaining([{ name: "InsufficientBalance", value: 2, doc: expect.any(String) }]),
    });
    const transfer = tokenSpec.events.find((e) => e.name === "Transfer");
    expect(transfer).toMatchObject({ prefixTopics: ["transfer"], dataFormat: "map" });
    expect(transfer?.params.map((p) => p.location)).toEqual(["topic", "topic", "data"]);
  });

  it("produces specs that match the shared schema", () => {
    expect(ContractSpecSchema.safeParse(tokenSpec).success).toBe(true);
    expect(ContractSpecSchema.safeParse(STELLAR_ASSET_SPEC).success).toBe(true);
  });

  it("matches the committed fixture (run `pnpm contracts:build` if this fails)", () => {
    const fixture = JSON.parse(readFileSync(join(__dirname, "../src/fixtures/sample-token.spec.json"), "utf8"));
    expect(fixture.spec).toEqual(JSON.parse(JSON.stringify(tokenSpec)));
  });

  it("rejects WASM without a spec", () => {
    expect(() => specFromWasm(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))).toThrow();
  });
});

describe("checkContractId", () => {
  it.each([
    ["", /Enter a contract ID/],
    [Keypair.random().publicKey(), /account address/],
    ["ab".repeat(32), /hex hash/],
    ["XYZ", /start with C/],
    [VALID_ID.toLowerCase(), /start with C|upper-case/],
    [VALID_ID.slice(0, 50), /56 characters/],
    [VALID_ID.slice(0, 55) + (VALID_ID.endsWith("A") ? "B" : "A"), /checksum/],
  ])("rejects %j", (input, reason) => {
    const r = checkContractId(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(reason);
  });

  it("accepts and trims valid IDs", () => {
    expect(checkContractId(`  ${VALID_ID}\n`)).toEqual({ ok: true, value: VALID_ID });
  });
});

describe("templates and JSON schema", () => {
  it("builds example args for every type", () => {
    const fn = tokenSpec.functions.find((f) => f.name === "transfer_with_memo")!;
    expect(exampleArgs(fn, tokenSpec)).toEqual({ from: "", to: "", amount: "0", memo: null });
    const batch = tokenSpec.functions.find((f) => f.name === "transfer_batch")!;
    expect(exampleArgs(batch, tokenSpec)).toEqual({ from: "", payments: [] });
  });

  it("generates a schema with UDT definitions", () => {
    const fn = tokenSpec.functions.find((f) => f.name === "transfer_with_memo")!;
    const schema = argsJsonSchema(fn, tokenSpec);
    expect(schema.required).toEqual(["from", "to", "amount", "memo"]);
    expect(schema.definitions?.Memo?.oneOf).toHaveLength(3);
    expect(schema.definitions?.Payment?.required).toEqual(["amount", "to"]);
    expect(schema.properties?.from?.pattern).toBe("^[GC][A-Z2-7]{55}$");
  });
});

describe("samples", () => {
  it("every sample has a valid contract ID and suggested calls that exist in its spec", () => {
    for (const s of SAMPLE_CONTRACTS) {
      expect(s.contractId && StrKey.isValidContract(s.contractId)).toBe(true);
      for (const call of s.suggestedCalls) {
        const fn = s.spec.functions.find((f) => f.name === call.method);
        expect(fn, `${s.slug}.${call.method}`).toBeDefined();
        expect(Object.keys(call.args).sort()).toEqual(fn!.inputs.map((i) => i.name).sort());
      }
    }
  });

  it("finds samples by slug or ID", () => {
    expect(findSample("counter")?.title).toBe("Counter");
    expect(findSample(SAMPLE_CONTRACTS[2]!.contractId!)?.slug).toBe("native-xlm");
  });
});

describe("loadContractFromNetwork", () => {
  const network = { rpcUrl: "https://rpc.invalid", networkPassphrase: "Test SDF Network ; September 2015" };

  function fakeServer(impl: Partial<rpc.Server>): rpc.Server {
    return impl as rpc.Server;
  }

  it("rejects invalid IDs before any network call", async () => {
    const getContractInstance = vi.fn();
    await expect(loadContractFromNetwork("nope", network, { server: fakeServer({ getContractInstance }) })).rejects.toMatchObject({
      code: "invalid_id",
    });
    expect(getContractInstance).not.toHaveBeenCalled();
  });

  it("uses the built-in spec for Stellar Asset Contracts", async () => {
    const server = fakeServer({
      getContractInstance: vi.fn().mockResolvedValue({ executable: xdr.ContractExecutable.contractExecutableStellarAsset() }),
    });
    const loaded = await loadContractFromNetwork(VALID_ID, network, { server });
    expect(loaded.executable.type).toBe("stellar_asset");
    expect(loaded.specSource).toBe("builtin");
    expect(loaded.spec.functions.some((f) => f.name === "balance")).toBe(true);
  });

  it("fetches and parses WASM, caching by hash", async () => {
    const hash = new Uint8Array(32).fill(7);
    const getContractWasmByHash = vi.fn().mockResolvedValue(tokenWasm);
    const server = fakeServer({
      getContractInstance: vi.fn().mockResolvedValue({ executable: xdr.ContractExecutable.contractExecutableWasm(hash) }),
      getContractWasmByHash,
    });
    const a = await loadContractFromNetwork(VALID_ID, network, { server });
    const b = await loadContractFromNetwork(VALID_ID, network, { server });
    expect(a.executable).toEqual({ type: "wasm", wasmHash: "07".repeat(32) });
    expect(a.wasmSize).toBe(tokenWasm.length);
    expect(b.spec).toBe(a.spec);
    expect(getContractWasmByHash).toHaveBeenCalledTimes(1);
  });

  it("maps missing contracts to not_found with a hint", async () => {
    const server = fakeServer({ getContractInstance: vi.fn().mockRejectedValue(new Error("Contract instance not found")) });
    const err = await loadContractFromNetwork(VALID_ID, network, { server }).catch((e) => e);
    expect(err).toBeInstanceOf(ContractLoadError);
    expect(err.code).toBe("not_found");
    expect(err.hint).toMatch(/reset/);
  });

  it("treats the SDK's plain { code: 404 } rejection as not_found", async () => {
    const rejection = { code: 404, message: "Could not obtain contract instance from server" };
    const server = fakeServer({ getContractInstance: vi.fn().mockRejectedValue(rejection) });
    await expect(loadContractFromNetwork(VALID_ID, network, { server })).rejects.toMatchObject({ code: "not_found" });
  });

  it("maps transport failures to network errors", async () => {
    const server = fakeServer({ getContractInstance: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) });
    await expect(loadContractFromNetwork(VALID_ID, network, { server })).rejects.toMatchObject({ code: "network" });
  });
});
