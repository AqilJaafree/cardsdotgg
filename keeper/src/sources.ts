import type { Address } from "viem";

// Real gold liquidity on Monad mainnet: PancakeSwap V3 XAUt0/USDT0, 0.05% fee. The token addresses match the
// Monad token list and the Aave address book. Liquidity is thin, so its price is less robust than a price feed.
export const GOLD_POOL: Address = "0xa5C3a55Af4029724f519AC8d340bE9916AC83E45";
export const GOLD_POOL_SOURCE = "PancakeSwap V3 XAUt0/USDT0 0.05% pool, Monad mainnet";
export const VOLUME_API = `https://api.geckoterminal.com/api/v2/networks/monad/pools/${GOLD_POOL.toLowerCase()}`;
