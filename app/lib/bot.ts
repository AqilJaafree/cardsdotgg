import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import addresses from "@/lib/shared/addresses.json";

// Server-side only: the bot wallet that joins practice matches and settles matches for players.
export const chain = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
});
export const arena = addresses.arena as `0x${string}`;
export const arenaAbi = parseAbi([
  "function getMatch(uint256) view returns ((uint256 deckA, uint256 deckB, address playerA, address playerB, uint256 stakeA, uint256 stakeB, bytes32 seed, uint8 status, uint64 createdAt, address winner))",
  "function opponentOf(uint256) view returns (address)",
  "function seedBlockOf(uint256) view returns (uint64)",
  "function accept(uint256 matchId, uint256 deckId)",
  "function resolve(uint256 matchId)",
]);
export const pub = createPublicClient({ chain, transport: http() });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function botWallet() {
  const key = process.env.BOT_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) return null;
  const account = privateKeyToAccount(key);
  return { account, wallet: createWalletClient({ account, chain, transport: http() }) };
}

// One bot wallet sends every transaction, so they run one at a time and their nonces never collide.
let queue: Promise<unknown> = Promise.resolve();
export function withBot<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

/** Settles a match that has both players: waits for the seed block, then resolves (again if the seed re-armed). */
export async function settle(id: bigint, wallet: NonNullable<ReturnType<typeof botWallet>>["wallet"]) {
  for (let tries = 0; tries < 6; tries++) {
    const m = await pub.readContract({ address: arena, abi: arenaAbi, functionName: "getMatch", args: [id] });
    if (m.status !== 1 && m.status !== 2) return m.status;
    const seedBlock = await pub.readContract({ address: arena, abi: arenaAbi, functionName: "seedBlockOf", args: [id] });
    while ((await pub.getBlockNumber()) <= seedBlock) await sleep(300);
    const hash = await wallet.writeContract({ address: arena, abi: arenaAbi, functionName: "resolve", args: [id] });
    await pub.waitForTransactionReceipt({ hash });
  }
  return (await pub.readContract({ address: arena, abi: arenaAbi, functionName: "getMatch", args: [id] })).status;
}
