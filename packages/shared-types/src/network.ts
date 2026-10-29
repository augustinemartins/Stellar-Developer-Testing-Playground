import { z } from "zod";

export const NETWORK_PASSPHRASES = {
  testnet: "Test SDF Network ; September 2015",
  futurenet: "Test SDF Future Network ; October 2022",
  mainnet: "Public Global Stellar Network ; September 2015",
  local: "Standalone Network ; February 2017",
} as const;

export const NetworkIdSchema = z.enum(["testnet", "futurenet", "mainnet", "local", "custom"]);
export type NetworkId = z.infer<typeof NetworkIdSchema>;

export const NetworkConfigSchema = z.object({
  id: NetworkIdSchema,
  rpcUrl: z.url(),
  networkPassphrase: z.string().min(1),
  friendbotUrl: z.url().optional(),
});
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;

export const NETWORKS: Record<Exclude<NetworkId, "custom">, NetworkConfig & { label: string }> = {
  testnet: {
    id: "testnet",
    label: "Testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
    friendbotUrl: "https://friendbot.stellar.org",
  },
  futurenet: {
    id: "futurenet",
    label: "Futurenet",
    rpcUrl: "https://rpc-futurenet.stellar.org",
    networkPassphrase: NETWORK_PASSPHRASES.futurenet,
    friendbotUrl: "https://friendbot-futurenet.stellar.org",
  },
  mainnet: {
    id: "mainnet",
    label: "Mainnet (bring your own RPC)",
    // There is no free SDF-run mainnet RPC; users must supply a provider URL.
    rpcUrl: "https://mainnet.sorobanrpc.com",
    networkPassphrase: NETWORK_PASSPHRASES.mainnet,
  },
  local: {
    id: "local",
    label: "Local (stellar/quickstart)",
    rpcUrl: "http://localhost:8000/rpc",
    networkPassphrase: NETWORK_PASSPHRASES.local,
    friendbotUrl: "http://localhost:8000/friendbot",
  },
};

export const DEFAULT_NETWORK = NETWORKS.testnet;
