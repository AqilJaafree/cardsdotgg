/** Oracle clamp, 0 to 50% APR. */
export function clampBps(bps: number): number {
  return Math.min(Math.max(bps, 0), 5000);
}

/** Quote units per one whole base token, from a V3 sqrtPriceX96. Handles either token order. */
export function priceFromSqrt(sqrtPriceX96: bigint, baseIsToken0: boolean, baseDecimals: number): bigint {
  const q192 = 1n << 192n;
  const one = 10n ** BigInt(baseDecimals);
  const s = sqrtPriceX96 * sqrtPriceX96;
  return baseIsToken0 ? (s * one) / q192 : (q192 * one) / s;
}

/** Rejects a bad read before it can reach the oracle. Bounds are USD per whole gold token, in 1e6 units. */
export function assertSaneGold(price1e6: bigint): void {
  if (price1e6 < 1_000_000_000n || price1e6 > 20_000_000_000n) throw new Error(`gold price out of range: ${price1e6}`);
}
