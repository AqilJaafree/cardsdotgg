const YEAR = 31_536_000n;
const RAY = 10n ** 27n;

/** Aave liquidity rate (ray, already annual) to bps, floored. */
export function rayToBps(ray: bigint): number {
  return Number((ray * 10_000n) / RAY);
}

/** Simple annualization of an ERC-4626 share price change, to bps, floored. Never negative. */
export function annualizeBps(oldPrice: bigint, newPrice: bigint, elapsedSeconds: bigint): number {
  if (newPrice <= oldPrice || elapsedSeconds <= 0n) return 0;
  return Number(((newPrice - oldPrice) * 10_000n * YEAR) / (oldPrice * elapsedSeconds));
}

/** Oracle clamp, 0 to 50% APR. */
export function clampBps(bps: number): number {
  return Math.min(Math.max(bps, 0), 5000);
}
