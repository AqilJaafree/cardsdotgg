import { defineChain, http, fallback } from "viem";
// Privy's createConfig: wallets come from Privy login (Google embedded wallet or an external wallet), not wagmi connectors.
import { createConfig } from "@privy-io/wagmi";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: { default: { name: "MonadExplorer", url: "https://testnet.monadvision.com" } },
  testnet: true,
});

export const FALLBACK_RPC = "https://rpc.ankr.com/monad_testnet";

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: fallback([http("https://testnet-rpc.monad.xyz", { batch: true }), http(FALLBACK_RPC, { batch: true })]),
  },
  ssr: true,
});

export const explorerTx = (hash: string) => `${monadTestnet.blockExplorers.default.url}/tx/${hash}`;
export const explorerAddr = (a: string) => `${monadTestnet.blockExplorers.default.url}/address/${a}`;
