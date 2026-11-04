"use client";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { abis, ad } from "./contracts";

export type DeckView = { id: bigint; tier: number; asset: number; principal: bigint; valueUsd: bigint; retired: boolean; available: bigint; locked: bigint; seeded: bigint; uri?: string };

/** Last fully loaded decks per wallet, so a refresh or a brief wallet reconnect never blanks the list. */
const lastGood = new Map<string, DeckView[]>();
let lastAddress: string | undefined;

export function useDecks() {
  const { address: live } = useAccount();
  if (live) lastAddress = live;
  // Privy can drop the address for a moment while a signature window is open; keep using the last one.
  const address = (live ?? lastAddress) as `0x${string}` | undefined;
  const ids = useReadContract({ address: ad("deckVault"), abi: abis.vault, functionName: "decksOf", args: [address!], query: { enabled: !!address, refetchInterval: 8000 } });
  const list = (ids.data as bigint[] | undefined) ?? [];
  const calls = list.flatMap((id) => [
    { address: ad("deckVault"), abi: abis.vault, functionName: "getDeck", args: [id] },
    { address: ad("yieldEscrow"), abi: abis.escrow, functionName: "available", args: [id] },
    { address: ad("yieldEscrow"), abi: abis.escrow, functionName: "locked", args: [id] },
    { address: ad("yieldEscrow"), abi: abis.escrow, functionName: "seededTotal", args: [id] },
    { address: ad("deckNFT"), abi: abis.nft, functionName: "tokenURI", args: [id] },
  ] as const);
  const res = useReadContracts({ contracts: calls as any, query: { enabled: list.length > 0, refetchInterval: 8000 } });
  const decks: DeckView[] = list.map((id, i) => {
    const r = res.data?.slice(i * 5, i * 5 + 5).map((x) => x.result as any) ?? [];
    const d = r[0];
    return { id, tier: Number(d?.tier ?? 0), asset: Number(d?.asset ?? 0), principal: d?.principal ?? 0n, valueUsd: d?.depositValueUsd ?? 0n, retired: !!d?.retired, available: r[1] ?? 0n, locked: r[2] ?? 0n, seeded: r[3] ?? 0n, uri: r[4] };
  });
  // Hide decks until their data loads, so a retired deck never flashes as active.
  const loaded = decks.filter((_, i) => res.data?.[i * 5]?.result);
  // ready: the deck list for this wallet has been read from the chain, so an empty list really means "no decks".
  const fresh = !!address && ids.isFetched && (list.length === 0 || (res.isFetched && loaded.length === list.length));
  const key = address?.toLowerCase() ?? "";
  if (fresh) lastGood.set(key, loaded);
  const cached = lastGood.get(key);
  const ready = fresh || !!cached;
  return { decks: fresh ? loaded : cached ?? loaded, ready, refetch: () => { ids.refetch(); res.refetch(); } };
}

export function svgFromUri(uri?: string): string | undefined {
  try {
    if (!uri) return;
    const json = JSON.parse(atob(uri.split(",")[1]));
    return json.image as string;
  } catch { return; }
}
