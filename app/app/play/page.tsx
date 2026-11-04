"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useBlockNumber, useReadContract, useReadContracts } from "wagmi";
import { zeroAddress } from "viem";
import { TxButton } from "@/components/TxButton";
import { abis, ad, TIERS } from "@/lib/contracts";
import { useDecks } from "@/lib/useDecks";
import { OnchainBattle, SearchingAnim, StarterPack, VsSlam } from "@/components/game/OnlineBattle";

/** How many recent matches to scan for open challenges and the player's own matches. */
const SCAN = 40;
const TTL = 3600;
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/**
 * Online quick match, fully onchain: join a random open challenge from another player,
 * or open one and wait until the next player who taps Battle joins it. Then resolve, replay the battle and show the result.
 */
function QuickMatch() {
  const { address } = useAccount();
  const me = address?.toLowerCase() ?? "";
  const tier = Number(useSearchParams().get("tier") ?? 0);
  const { decks, ready, refetch: refetchDecks } = useDecks();
  const live = decks.filter((d) => !d.retired);
  const deck = live.find((d) => d.tier === tier) ?? live[0];
  const { data: block } = useBlockNumber({ watch: true });

  const count = useReadContract({ address: ad("arena"), abi: abis.arena, functionName: "matchCount", query: { refetchInterval: 3000 } });
  const n = Number(count.data ?? 0n);
  const ids = Array.from({ length: Math.min(n, SCAN) }, (_, i) => BigInt(n - i));
  const reads = useReadContracts({
    contracts: ids.flatMap((id) => [
      { address: ad("arena"), abi: abis.arena, functionName: "getMatch", args: [id] },
      { address: ad("arena"), abi: abis.arena, functionName: "opponentOf", args: [id] },
      { address: ad("arena"), abi: abis.arena, functionName: "seedBlockOf", args: [id] },
    ]) as any,
    query: { enabled: n > 0, refetchInterval: 3000 },
  });
  const rows = ids
    .map((id, i) => ({ id, m: reads.data?.[i * 3]?.result as any, opp: reads.data?.[i * 3 + 1]?.result as string | undefined, seedBlock: (reads.data?.[i * 3 + 2]?.result as bigint) ?? 0n }))
    .filter((r) => r.m);
  const refetch = () => { count.refetch(); reads.refetch(); };
  const rating = useReadContract({ address: ad("arena"), abi: abis.arena, functionName: "ratingOf", args: [address!], query: { enabled: !!address, refetchInterval: 5000 } });

  const now = Math.floor(Date.now() / 1000);
  const isMine = (r: (typeof rows)[number]) => r.m.playerA?.toLowerCase() === me || r.m.playerB?.toLowerCase() === me;
  // A match this player is in that has an opponent and still needs to be fought.
  const inPlay = rows.find((r) => [1, 2].includes(Number(r.m.status)) && isMine(r));
  // This player's own open challenge (the newest one), still waiting for someone.
  const myOpen = rows.find((r) => Number(r.m.status) === 0 && r.m.playerA?.toLowerCase() === me && Number(r.m.createdAt) + TTL > now);
  // Other players' open challenges this player may join.
  const open = rows.filter((r) => Number(r.m.status) === 0 && r.m.playerA?.toLowerCase() !== me && (!r.opp || r.opp === zeroAddress || r.opp.toLowerCase() === me) && Number(r.m.createdAt) + TTL > now);

  // Two players can both be waiting on their own challenge, each for the other. To break the tie, the newer
  // challenge joins the older one; a deck whose stake is locked cannot join, so then the older one joins the newer.
  const myDeckId: bigint | undefined = myOpen ? myOpen.m.deckA : deck?.id;
  const myLocked = (live.find((d) => d.id === myDeckId)?.locked ?? 0n) > 0n;
  const joinable = myOpen
    ? open.filter((o) => !myLocked && (o.id < myOpen.id || o.m.stakeA > 0n))
    : open;
  const [pick, setPick] = useState<bigint | null>(null);
  useEffect(() => {
    if (!inPlay && joinable.length && (pick === null || !joinable.some((o) => o.id === pick)))
      setPick((myOpen ? [...joinable].sort((a, b) => Number(a.id - b.id))[0] : joinable[Math.floor(Math.random() * joinable.length)]).id);
  }, [joinable.map((o) => String(o.id)).join(","), !!inPlay]); // eslint-disable-line
  const target = joinable.find((o) => o.id === pick);
  const theirTier = useReadContract({ address: ad("deckVault"), abi: abis.vault, functionName: "getDeck", args: [target?.m.deckA ?? 0n], query: { enabled: !!target } });

  // Follow the match this player is fighting until it settles, then replay it and show the result.
  const [watchId, setWatchId] = useState<bigint | null>(null);
  const [stage, setStage] = useState<"none" | "replay" | "result">("none");
  useEffect(() => { if (inPlay) setWatchId(inPlay.id); }, [inPlay?.id]); // eslint-disable-line
  const settled = watchId !== null ? rows.find((r) => r.id === watchId && Number(r.m.status) === 3) : undefined;
  useEffect(() => { if (settled && stage === "none") setStage("replay"); }, [!!settled]); // eslint-disable-line

  const top = (
    <header className="qm-top">
      <Link className="cm-btn qm-back" href="/">◀ MENU</Link>
      <Link className="cm-square" href="/leaderboard" aria-label="Leaderboard">🏆</Link>
    </header>
  );

  if (settled && stage === "replay") return <OnchainBattle id={settled.id} m={settled.m} me={me} onDone={() => setStage("result")} />;

  let body: React.ReactNode;
  if (!address || !ready) {
    body = <><SearchingAnim tier={tier} /><h2>Loading your decks…</h2><p>Reading your wallet from Monad.</p></>;
  } else if (!deck) {
    body = <StarterPack onDone={() => refetchDecks()} />;
  } else if (settled && stage === "result") {
    const won = settled.m.winner?.toLowerCase() === me;
    const draw = settled.m.winner === zeroAddress;
    body = <>
      <h2 className={`qm-result ${won ? "win" : draw ? "draw" : "lose"}`}>{draw ? "DRAW" : won ? "VICTORY!" : "DEFEAT"}</h2>
      <p>Match #{String(settled.id)} settled onchain. Your rating is now <b>{String(rating.data ?? "…")}</b>.</p>
      <div className="qm-row">
        <Link className="cm-btn cm-collection qm-btn" href={`/match/${settled.id}`}>DETAILS</Link>
        <button className="cm-btn cm-play qm-btn" onClick={() => { setWatchId(null); setStage("none"); setPick(null); refetch(); }}>PLAY AGAIN</button>
      </div>
    </>;
  } else if (inPlay) {
    const vs = inPlay.m.playerA?.toLowerCase() === me ? inPlay.m.playerB : inPlay.m.playerA;
    const seedReady = !!block && block > inPlay.seedBlock;
    body = <>
      <VsSlam myTier={deck.tier} them={short(vs)} />
      <h2>Opponent found!</h2>
      <p>{seedReady ? "Both players are in. Tap FIGHT to settle the battle onchain; either player can do it." : "Rolling the battle seed on the next block…"}</p>
      <TxButton label={seedReady ? "FIGHT!" : "WAITING FOR SEED…"} disabled={!seedReady} onConfirmed={refetch} request={{ address: ad("arena"), abi: abis.arena, functionName: "resolve", args: [inPlay.id] }} />
      <small>If the seed expired, FIGHT re-arms it. Press it again.</small>
    </>;
  } else if (target) {
    body = <>
      <VsSlam myTier={deck.tier} theirTier={theirTier.data ? Number((theirTier.data as any).tier) : undefined} them={short(target.m.playerA)} />
      <h2>Opponent found!</h2>
      <p>Join their battle with your {TIERS[deck.tier]} deck #{String(myDeckId)}.</p>
      <TxButton label="JOIN BATTLE" onConfirmed={refetch} request={{ address: ad("arena"), abi: abis.arena, functionName: "accept", args: [target.id, myDeckId!] }} />
    </>;
  } else if (myOpen) {
    const left = Math.max(0, Number(myOpen.m.createdAt) + TTL - now);
    body = <>
      <SearchingAnim tier={deck.tier} />
      <h2>Searching for an opponent…</h2>
      <p>Your challenge #{String(myOpen.id)} is open. The next player who taps Battle joins it. Keep this screen open.</p>
      <small>It closes by itself in {Math.ceil(left / 60)} min if nobody joins.</small>
    </>;
  } else {
    body = <>
      <h2>Ready to battle</h2>
      <p>Nobody is waiting right now. Open a challenge and the next player who taps Battle is matched with you.</p>
      <p><small>{TIERS[deck.tier]} deck #{String(deck.id)} · stake comes from your yield escrow, or the match is Rank-only.</small></p>
      <TxButton label="FIND OPPONENT" onConfirmed={refetch} request={{ address: ad("arena"), abi: abis.arena, functionName: "createChallenge", args: [deck.id, zeroAddress] }} />
    </>;
  }

  return (
    <div className="qm-screen">
      {top}
      <section className="qm-card">{body}</section>
      <p className="qm-foot">Online · Monad testnet · rating {String(rating.data ?? "…")}</p>
    </div>
  );
}

export default function PlayPage() {
  return <Suspense><QuickMatch /></Suspense>;
}
