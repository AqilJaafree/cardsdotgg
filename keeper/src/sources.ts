import type { Address } from "viem";

// Addresses checked on Monad mainnet (chain 143) on 2026-11-04. The Aave address book and Morpho's API
// are the official listings; symbol, asset() and supply were read on chain.
export const AAVE_POOL: Address = "0x69a5F9AD4f96ebf0a0C792dD42a01cC5C0102fef";
export const USDC: Address = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";

export type Source =
  | { tier: number; kind: "aave"; asset: Address; source: string; sourceUrl: string; note: string }
  | { tier: number; kind: "erc4626"; vault: Address; source: string; sourceUrl: string; note: string };

const MORPHO_API = "https://api.morpho.org/graphql";

export const SOURCES: Source[] = [
  {
    tier: 0,
    kind: "aave",
    asset: USDC,
    source: `Aave V3 USDC supply rate, Pool ${AAVE_POOL}`,
    sourceUrl: "https://github.com/bgd-labs/aave-address-book/blob/main/src/AaveV3Monad.sol",
    note: "Current supply rate, in ray. About 132M aUSDC supplied at selection.",
  },
  {
    tier: 1,
    kind: "erc4626",
    vault: "0x802c91d807A8DaCA257c4708ab264B6520964e44",
    source: "Morpho bbqUSDC vault, 7-day share price",
    sourceUrl: MORPHO_API,
    note: "Credit leg only: no gold strategy was found on Monad mainnet. Small vault, about 12k USD at selection. Trailing 7-day rate, which can differ from the current APY.",
  },
  {
    tier: 2,
    kind: "erc4626",
    vault: "0x32841A8511D5c2c5b253f45668780B99139e476D",
    source: "Morpho grove-bbqAUSD vault, 7-day share price",
    sourceUrl: MORPHO_API,
    note: "Small vault, about 91k USD at selection. Trailing 7-day rate, which was well above the 3.22% current APY shown by Morpho's API at selection.",
  },
];
