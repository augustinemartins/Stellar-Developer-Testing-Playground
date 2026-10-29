import { rpc, xdr } from "@stellar/stellar-sdk";
import type { NetworkConfig, NetworkLimits } from "@playground/shared-types";

const servers = new Map<string, rpc.Server>();

/** Returns a cached RPC client for a network. */
export function getServer(network: Pick<NetworkConfig, "rpcUrl">): rpc.Server {
  let s = servers.get(network.rpcUrl);
  if (!s) {
    s = new rpc.Server(network.rpcUrl, { allowHttp: network.rpcUrl.startsWith("http://") });
    servers.set(network.rpcUrl, s);
  }
  return s;
}

/** Per-transaction limits documented for protocol 23+, used when the network cannot be queried. */
export const DEFAULT_LIMITS: NetworkLimits = {
  txMaxInstructions: 100_000_000,
  txMaxDiskReadBytes: 200_000,
  txMaxWriteBytes: 132_096,
  txMaxDiskReadEntries: 100,
  txMaxWriteLedgerEntries: 50,
  txMaxSizeBytes: 132_096,
  source: "default",
};

function configKey(id: xdr.ConfigSettingId): xdr.LedgerKey {
  return xdr.LedgerKey.configSetting(new xdr.LedgerKeyConfigSetting({ configSettingId: id }));
}

/** Reads the network's current per-transaction resource limits from its config settings. */
export async function fetchNetworkLimits(server: rpc.Server): Promise<NetworkLimits> {
  try {
    const res = await server.getLedgerEntries(
      configKey(xdr.ConfigSettingId.configSettingContractComputeV0),
      configKey(xdr.ConfigSettingId.configSettingContractLedgerCostV0),
      configKey(xdr.ConfigSettingId.configSettingContractBandwidthV0),
    );
    const limits: NetworkLimits = { ...DEFAULT_LIMITS, source: "live" };
    let found = 0;
    for (const e of res.entries) {
      if (e.val.type !== "configSetting") continue;
      const cs = e.val.configSetting;
      if (cs.type === "configSettingContractComputeV0") {
        limits.txMaxInstructions = Number(cs.contractCompute.txMaxInstructions);
        found++;
      } else if (cs.type === "configSettingContractLedgerCostV0") {
        const c = cs.contractLedgerCost;
        limits.txMaxDiskReadBytes = c.txMaxDiskReadBytes;
        limits.txMaxWriteBytes = c.txMaxWriteBytes;
        limits.txMaxDiskReadEntries = c.txMaxDiskReadEntries;
        limits.txMaxWriteLedgerEntries = c.txMaxWriteLedgerEntries;
        found++;
      } else if (cs.type === "configSettingContractBandwidthV0") {
        limits.txMaxSizeBytes = cs.contractBandwidth.txMaxSizeBytes;
        found++;
      }
    }
    return found === 3 ? limits : DEFAULT_LIMITS;
  } catch {
    return DEFAULT_LIMITS;
  }
}

export interface NetworkHealth {
  ok: boolean;
  passphraseMatches?: boolean;
  protocolVersion?: number;
  latestLedger?: number;
  error?: string;
}

/** Checks that an RPC is reachable and serves the expected network. */
export async function checkNetwork(network: Pick<NetworkConfig, "rpcUrl" | "networkPassphrase">): Promise<NetworkHealth> {
  try {
    const server = getServer(network);
    const [info, latest] = await Promise.all([server.getNetwork(), server.getLatestLedger()]);
    return {
      ok: info.passphrase === network.networkPassphrase,
      passphraseMatches: info.passphrase === network.networkPassphrase,
      protocolVersion: Number(info.protocolVersion),
      latestLedger: Number(latest.sequence),
      error: info.passphrase === network.networkPassphrase ? undefined : `RPC serves "${info.passphrase}"`,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
