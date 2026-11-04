// One-shot keeper: reads Monad mainnet rates, writes shared/rate-sources.json and, unless --dry, calls setRates.
// Env: KEEPER_PRIVATE_KEY, MONAD_TESTNET_RPC_URL, MONAD_MAINNET_RPC_URL (needs historical state).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi, defineChain, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { AAVE_POOL, GOLD_POOL, GOLD_POOL_SOURCE, SOURCES, VOLUME_API } from "./sources.js";
import { annualizeBps, assertSaneGold, clampBps, priceFromSqrt, rayToBps } from "./computeRates.js";

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
const oracleAbi = parseAbi(["function setRates(uint16,uint16,uint16,uint64)", "function setGoldPrice(uint256)"]);
const v3Abi = parseAbi([
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function liquidity() view returns (uint128)",
  "function fee() view returns (uint24)",
  "function factory() view returns (address)",
]);
const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);

async function readGoldPool(blockNumber: bigint, readAt: string) {
  const v3 = <T extends "slot0" | "token0" | "token1" | "liquidity" | "fee" | "factory">(functionName: T) =>
    mainnet.readContract({ address: GOLD_POOL, abi: v3Abi, functionName, blockNumber } as never) as Promise<any>;
  const [slot0, token0, token1, liquidity, fee, factory] = await Promise.all([
    v3("slot0"), v3("token0"), v3("token1"), v3("liquidity"), v3("fee"), v3("factory"),
  ]);
  const info = async (address: Address) => {
    const read = (functionName: "symbol" | "decimals") =>
      mainnet.readContract({ address, abi: erc20Abi, functionName, blockNumber } as never) as Promise<any>;
    const balance = await mainnet.readContract({ address, abi: erc20Abi, functionName: "balanceOf", args: [GOLD_POOL], blockNumber });
    return { address, symbol: (await read("symbol")) as string, decimals: Number(await read("decimals")), balance };
  };
  const [t0, t1] = await Promise.all([info(token0), info(token1)]);
  const baseIsToken0 = t0.symbol === "XAUt0";
  if (!baseIsToken0 && t1.symbol !== "XAUt0") throw new Error("gold pool does not hold XAUt0");
  const [gold, quote] = baseIsToken0 ? [t0, t1] : [t1, t0];
  if (quote.symbol !== "USDT0" || quote.decimals !== 6) throw new Error(`unexpected quote token ${quote.symbol}`);
  const price = priceFromSqrt(slot0[0], baseIsToken0, gold.decimals);
  assertSaneGold(price);
  const goldValue = (gold.balance * price) / 10n ** BigInt(gold.decimals);
  let volume24hUsd: string | null = null;
  try {
    const r = await fetch(VOLUME_API);
    volume24hUsd = (await r.json()).data.attributes.volume_usd.h24 ?? null;
  } catch {
    console.warn("24h volume unavailable");
  }
  return {
    live: true,
    source: GOLD_POOL_SOURCE,
    sourceContract: GOLD_POOL,
    factory,
    goldToken: gold.address,
    quoteToken: quote.address,
    usdPerGold1e6: price.toString(),
    goldReserve: gold.balance.toString(),
    goldDecimals: gold.decimals,
    quoteReserve: quote.balance.toString(),
    quoteDecimals: quote.decimals,
    reserveValueUsd1e6: (goldValue + quote.balance).toString(),
    activeLiquidity: liquidity.toString(),
    feePips: Number(fee),
    volume24hUsd,
    volumeSource: volume24hUsd === null ? null : VOLUME_API,
    note: "Read on chain from a thin pool. USDT0 is treated as 1 USD. The testnet pool opens from this data with test tokens; it does not hold or track real assets.",
    readAt,
    mainnetBlock: blockNumber.toString(),
  };
}

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
  const goldPool = await readGoldPool(head.number, readAt);
  writeFileSync(new URL("shared/liquidity-source.json", root), JSON.stringify(goldPool, null, 2) + "\n");
  console.log(`gold: ${Number(goldPool.usdPerGold1e6) / 1e6} USD, pool value ${Number(goldPool.reserveValueUsd1e6) / 1e6} USD, 24h volume ${goldPool.volume24hUsd}`);
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
  const goldHash = await wallet.writeContract({
    address: addresses.rateOracle,
    abi: oracleAbi,
    functionName: "setGoldPrice",
    args: [BigInt(goldPool.usdPerGold1e6)],
  });
  const goldReceipt = await testnet.waitForTransactionReceipt({ hash: goldHash });
  console.log(`setGoldPrice ${goldReceipt.status}: ${goldHash}`);
  if (goldReceipt.status !== "success") process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
