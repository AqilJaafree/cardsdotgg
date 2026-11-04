// Addresses and ABIs come only from ../shared via scripts/sync-shared.mjs.
import arenaAbi from "./shared/abi/Arena.json";
import engineAbi from "./shared/abi/BattleEngine.json";
import nftAbi from "./shared/abi/DeckNFT.json";
import vaultAbi from "./shared/abi/DeckVault.json";
import oracleAbi from "./shared/abi/RateOracle.json";
import tokenAbi from "./shared/abi/TestToken.json";
import routerAbi from "./shared/abi/WithdrawRouter.json";
import escrowAbi from "./shared/abi/YieldEscrow.json";
import addressesJson from "./shared/addresses.json";
import cardsJson from "./shared/cards.json";
import rateSourcesJson from "./shared/rate-sources.json";
import type { Abi } from "viem";

export const A = addressesJson as Record<string, string>;
export const deployed = !!A.arena;
export const ad = (k: string) => A[k] as `0x${string}`;
export const abis = {
  arena: arenaAbi as Abi, engine: engineAbi as Abi, nft: nftAbi as Abi, vault: vaultAbi as Abi,
  oracle: oracleAbi as Abi, token: tokenAbi as Abi, router: routerAbi as Abi, escrow: escrowAbi as Abi,
};
export type Card = { id: number; tier: number; name: string; assetClass: string; hp: number; atk: number; def: number; spd: number; ability: string; rule: string; implemented: boolean };
export const cards = (cardsJson as { cards: Card[] }).cards;
export const rateSources = rateSourcesJson as { tier: number | string; bps: number; live: boolean; source: string; sourceUrl: string; readAt: string }[];
export const TIERS = ["Guardian", "Balanced", "Degen"];
export const ASSETS = ["tUSD", "tGOLD"];
export const STATUS = ["Open", "Awaiting seed", "Seed ready", "Resolved", "Expired"];
export const fmtUsd = (v: bigint) => (Number(v) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 4 });
export const fmtGold = (v: bigint) => (Number(v) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 4 });
