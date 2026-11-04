// One-shot keeper: reads Monad mainnet rates, writes shared/rate-sources.json and, unless --dry, calls setRates.
// Env: KEEPER_PRIVATE_KEY, MONAD_TESTNET_RPC_URL, MONAD_MAINNET_RPC_URL (needs historical state).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi, defineChain, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { AAVE_POOL, SOURCES } from "./sources.js";
import { annualizeBps, clampBps, rayToBps } from "./computeRates.js";

const root = new URL("../../", import.meta.url);
const dry = process.argv.includes("--dry");
const SEVEN_DAYS = 604_800n;

const mainnet = createPublicClient({
  transport: http(process.env.MONAD_MAINNET_RPC_URL || "https://rpc-mainnet.monadinfra.com"),
});

const poolAbi = parseAbi([
  "function getReserveData(address) view returns (uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address)",
]);
const vaultAbi = parseAbi(["function convertToAssets(uint256) view returns (uint256)", "function decimals() view returns (uint8)"]);
const oracleAbi = parseAbi(["function setRates(uint16,uint16,uint16,uint64)"]);

async function blockSevenDaysAgo(latest: bigint, latestTime: bigint) {
  const probe = await mainnet.getBlock({ blockNumber: latest - 1_000_000n });
  const span = latestTime - probe.timestamp;
  return mainnet.getBlock({ blockNumber: latest - (SEVEN_DAYS * 1_000_000n) / span });
}

async function main() {
  const head = await mainnet.getBlock();
  if ((await mainnet.getChainId()) !== 143) throw new Error("mainnet RPC is not chain 143");
  const old = await blockSevenDaysAgo(head.number, head.timestamp);
  const readAt = new Date().toISOString();

  const entries = [];
  for (const s of SOURCES) {
    let bps: number;
    if (s.kind === "aave") {
      const d = await mainnet.readContract({ address: AAVE_POOL, abi: poolAbi, functionName: "getReserveData", args: [s.asset] });
      bps = rayToBps(d[2]);
    } else {
      const decimals = await mainnet.readContract({ address: s.vault, abi: vaultAbi, functionName: "decimals" });
      const one = 10n ** BigInt(decimals);
      const read = (blockNumber: bigint) =>
        mainnet.readContract({ address: s.vault, abi: vaultAbi, functionName: "convertToAssets", args: [one], blockNumber });
      bps = annualizeBps(await read(old.number), await read(head.number), head.timestamp - old.timestamp);
    }
    entries.push({
      tier: s.tier,
      bps: clampBps(bps),
      live: true,
      source: s.source,
      sourceContract: s.kind === "aave" ? AAVE_POOL : s.vault,
      sourceUrl: s.sourceUrl,
      note: s.note,
      readAt,
      mainnetBlock: head.number.toString(),
    });
    console.log(`tier ${s.tier}: ${bps} bps from ${s.source}`);
  }

  writeFileSync(new URL("shared/rate-sources.json", root), JSON.stringify(entries, null, 2) + "\n");
  if (dry) return console.log("dry run: no transaction sent");

  const addrFile = new URL("shared/addresses.json", root);
  if (!existsSync(addrFile)) throw new Error("shared/addresses.json is missing, deploy first");
  const addresses = JSON.parse(readFileSync(addrFile, "utf8")) as { rateOracle: Address };
  const key = process.env.KEEPER_PRIVATE_KEY;
  if (!key) throw new Error("KEEPER_PRIVATE_KEY is not set");
  const rpc = process.env.MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz";
  const chain = defineChain({
    id: 10143,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
  const account = privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`);
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  const testnet = createPublicClient({ chain, transport: http(rpc) });
  const hash = await wallet.writeContract({
    address: addresses.rateOracle,
    abi: oracleAbi,
    functionName: "setRates",
    args: [entries[0].bps, entries[1].bps, entries[2].bps, head.number],
  });
  const receipt = await testnet.waitForTransactionReceipt({ hash });
  console.log(`setRates ${receipt.status}: ${hash}`);
  if (receipt.status !== "success") process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
