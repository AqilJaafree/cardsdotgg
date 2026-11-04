// Reads real Uniswap positions on Monad mainnet and estimates what each position's price range earned.
//
// Method: sample the pool's global fee growth (fees per unit of liquidity) over the trailing window, and count an
// interval only when the pool's tick was inside the position's range at both ends. Dividing by the value of one unit of
// liquidity at the current price gives a rate that does not depend on position size. It is an estimate of range
// fees: it ignores impermanent loss, and new positions have not necessarily earned this themselves.
import { encodeAbiParameters, keccak256, parseAbi, type Address, type PublicClient } from "viem";

const V3_NPM: Address = "0x7197e214c0b767cfb76fb734ab638e2c192f4e53";
const V3_FACTORY: Address = "0x204faca1764b154221e35c0d20abb3c525710498";
const V4_POSM: Address = "0x5b7ec4a94ff9bedb700fb82ab09d5846972f4016";
const V4_STATE_VIEW: Address = "0x77395f3b2e73ae90843717371294fa97cc419d64";
const USDC: Address = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const Q128 = 2 ** 128;
const WINDOW = 604_800n;
const SAMPLES = 168n; // hourly, because tight ranges can sit in range between coarser samples

export const POSITIONS = [
  { tier: 0, version: 3, id: 49582n, url: "https://app.uniswap.org/positions/v3/monad/49582" },
  { tier: 1, version: 4, id: 645141n, url: "https://app.uniswap.org/positions/v4/monad/645141" },
  { tier: 2, version: 3, id: 49584n, url: "https://app.uniswap.org/positions/v3/monad/49584" },
] as const;

const npm = parseAbi([
  "function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)",
  "function ownerOf(uint256) view returns (address)",
]);
const factory = parseAbi(["function getPool(address,address,uint24) view returns (address)"]);
const pool = parseAbi([
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)",
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
]);
const posm = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "function getPoolAndPositionInfo(uint256) view returns (PoolKey, uint256)",
  "function getPositionLiquidity(uint256) view returns (uint128)",
  "function ownerOf(uint256) view returns (address)",
]);
const stateView = parseAbi([
  "function getSlot0(bytes32) view returns (uint160,int24,uint24,uint24)",
  "function getFeeGrowthGlobals(bytes32) view returns (uint256,uint256)",
]);
const erc20 = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);

type Snapshot = { tick: number; g0: bigint; g1: bigint };
type Loaded = {
  owner: Address; token0: Address; token1: Address; fee: number; tickLower: number; tickUpper: number;
  liquidity: bigint; poolRef: string; hooks?: Address;
  read: (blockNumber: bigint) => Promise<Snapshot>;
};

function int24(x: bigint): number {
  const v = Number(x & 0xffffffn);
  return v >= 0x800000 ? v - 0x1000000 : v;
}

async function loadV3(c: PublicClient, id: bigint): Promise<Loaded> {
  const p = await c.readContract({ address: V3_NPM, abi: npm, functionName: "positions", args: [id] });
  const owner = await c.readContract({ address: V3_NPM, abi: npm, functionName: "ownerOf", args: [id] });
  const [, , token0, token1, fee, tickLower, tickUpper, liquidity] = p;
  const address = await c.readContract({ address: V3_FACTORY, abi: factory, functionName: "getPool", args: [token0, token1, fee] });
  return {
    owner, token0, token1, fee, tickLower, tickUpper, liquidity, poolRef: address,
    read: async (blockNumber) => {
      const [s, g0, g1] = await Promise.all([
        c.readContract({ address, abi: pool, functionName: "slot0", blockNumber }),
        c.readContract({ address, abi: pool, functionName: "feeGrowthGlobal0X128", blockNumber }),
        c.readContract({ address, abi: pool, functionName: "feeGrowthGlobal1X128", blockNumber }),
      ]);
      return { tick: s[1], g0, g1 };
    },
  };
}

async function loadV4(c: PublicClient, id: bigint): Promise<Loaded> {
  const [key, info] = await c.readContract({ address: V4_POSM, abi: posm, functionName: "getPoolAndPositionInfo", args: [id] });
  const liquidity = await c.readContract({ address: V4_POSM, abi: posm, functionName: "getPositionLiquidity", args: [id] });
  const owner = await c.readContract({ address: V4_POSM, abi: posm, functionName: "ownerOf", args: [id] });
  const poolId = keccak256(encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
  ));
  return {
    owner, token0: key.currency0, token1: key.currency1, fee: key.fee,
    tickLower: int24(info >> 8n), tickUpper: int24(info >> 32n), liquidity, poolRef: poolId, hooks: key.hooks,
    read: async (blockNumber) => {
      const [s, g] = await Promise.all([
        c.readContract({ address: V4_STATE_VIEW, abi: stateView, functionName: "getSlot0", args: [poolId], blockNumber }),
        c.readContract({ address: V4_STATE_VIEW, abi: stateView, functionName: "getFeeGrowthGlobals", args: [poolId], blockNumber }),
      ]);
      return { tick: s[1], g0: g[0], g1: g[1] };
    },
  };
}

const sqrtAt = (tick: number) => 1.0001 ** (tick / 2);

/** Raw token amounts held by one unit of liquidity at a tick. */
export function amountsPerLiquidity(tick: number, lower: number, upper: number): [number, number] {
  const s = sqrtAt(Math.min(Math.max(tick, lower), upper));
  return [1 / s - 1 / sqrtAt(upper), s - sqrtAt(lower)];
}

export async function readPosition(c: PublicClient, pos: (typeof POSITIONS)[number], head: { number: bigint; timestamp: bigint }) {
  const p = pos.version === 3 ? await loadV3(c, pos.id) : await loadV4(c, pos.id);
  if (p.liquidity === 0n) throw new Error(`position ${pos.id} has no liquidity`);
  const usdcIs0 = p.token0.toLowerCase() === USDC.toLowerCase();
  if (!usdcIs0 && p.token1.toLowerCase() !== USDC.toLowerCase()) throw new Error(`position ${pos.id} is not paired with USDC`);
  const [sym0, sym1, dec0, dec1] = await Promise.all([
    c.readContract({ address: p.token0, abi: erc20, functionName: "symbol" }),
    c.readContract({ address: p.token1, abi: erc20, functionName: "symbol" }),
    c.readContract({ address: p.token0, abi: erc20, functionName: "decimals" }),
    c.readContract({ address: p.token1, abi: erc20, functionName: "decimals" }),
  ]);

  const probe = await c.getBlock({ blockNumber: head.number - 1_000_000n });
  const blocksPerSecond = Number(1_000_000n) / Number(head.timestamp - probe.timestamp);
  const step = BigInt(Math.floor((Number(WINDOW / SAMPLES) * blocksPerSecond)));
  const snaps: Snapshot[] = [];
  for (let i = SAMPLES; i >= 0n; i--) {
    const s = await p.read(head.number - i * step).catch(() => null);
    if (s) snaps.push(s);
  }
  if (snaps.length < 2) throw new Error(`position ${pos.id}: no fee history`);
  const now = snaps[snaps.length - 1];
  const inRange = (t: number) => t >= p.tickLower && t < p.tickUpper;

  let fee0 = 0; let fee1 = 0; let counted = 0;
  for (let i = 1; i < snaps.length; i++) {
    const [a, b] = [snaps[i - 1], snaps[i]];
    if (b.g0 < a.g0 || b.g1 < a.g1 || !inRange(a.tick) || !inRange(b.tick)) continue;
    fee0 += Number(b.g0 - a.g0) / Q128;
    fee1 += Number(b.g1 - a.g1) / Q128;
    counted++;
  }
  const price = 1.0001 ** now.tick; // raw token1 per raw token0
  const inUsdcRaw = (a0: number, a1: number) => (usdcIs0 ? a0 + a1 / price : a0 * price + a1);
  const [a0, a1] = amountsPerLiquidity(now.tick, p.tickLower, p.tickUpper);
  const unitValue = inUsdcRaw(a0, a1);
  const days = ((snaps.length - 1) * Number(step)) / blocksPerSecond / 86_400;
  const bps = Math.floor((inUsdcRaw(fee0, fee1) / unitValue) * (365 / days) * 10_000);

  return {
    bps,
    label: `${sym0}/${sym1}`,
    version: pos.version,
    positionId: pos.id.toString(),
    positionUrl: pos.url,
    owner: p.owner,
    pool: p.poolRef,
    hooks: p.hooks ?? null,
    feePips: p.fee,
    tickLower: p.tickLower,
    tickUpper: p.tickUpper,
    currentTick: now.tick,
    inRange: inRange(now.tick),
    positionValueUsd: Number(((unitValue * Number(p.liquidity)) / 1e6).toFixed(2)),
    windowDays: Number(days.toFixed(2)),
    samples: snaps.length - 1,
    tickMin: Math.min(...snaps.map((x) => x.tick)),
    tickMax: Math.max(...snaps.map((x) => x.tick)),
    samplesInRange: snaps.filter((x) => inRange(x.tick)).length,
    intervalsInRange: counted,
    decimals: [dec0, dec1],
  };
}
