"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useBlockNumber, useReadContract, useReadContracts } from "wagmi";
import { zeroAddress } from "viem";
import { TxButton } from "@/components/TxButton";
import { abis, ad, TIERS } from "@/lib/contracts";
import { useDecks } from "@/lib/useDecks";

/** How many recent matches to scan for open challenges and the player's own match. */
const SCAN = 40;
const TTL = 3600;
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/**
 * Online quick match, fully onchain: join a random open challenge from another player,
 * or open one and wait until the next player who taps Battle joins it. Then resolve and show the result.
 */
function QuickMatch() {
  const { address } = useAccount();
  const me = address?.toLowerCase();
  const tier = Number(useSearchParams().get("tier") ?? 0);
  const { decks } = useDecks();
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

  const now = Math.floor(Date.now() / 1000);
  // The player's own match that is still in play (waiting, seeding or ready to resolve).
  const mine = rows.find((r) => [0, 1, 2].includes(Number(r.m.status)) && (r.m.playerA?.toLowerCase() === me || r.m.playerB?.toLowerCase() === me));
  // Open challenges from other players that this player may join.
  const open = rows.filter((r) => Number(r.m.status) === 0 && r.m.playerA?.toLowerCase() !== me && (!r.opp || r.opp === zeroAddress || r.opp.toLowerCase() === me) && Number(r.m.createdAt) + TTL > now);
  // Pick one open challenge at random, and keep that pick while the list refreshes.
  const [pick, setPick] = useState<bigint | null>(null);
  useEffect(() => { if (!mine && open.length && (pick === null || !open.some((o) => o.id === pick))) setPick(open[Math.floor(Math.random() * open.length)].id); }, [open.map((o) => String(o.id)).join(","), !!mine]); // eslint-disable-line
  const target = open.find((o) => o.id === pick);

  // Remember the last match this player finished, to show its result.
  const [doneId, setDoneId] = useState<bigint | null>(null);
  useEffect(() => { if (mine) setDoneId(mine.id); }, [mine?.id]); // eslint-disable-line
  const done = doneId !== null ? rows.find((r) => r.id === doneId && Number(r.m.status) === 3) : undefined;
  const rating = useReadContract({ address: ad("arena"), abi: abis.arena, functionName: "ratingOf", args: [address!], query: { enabled: !!address, refetchInterval: 5000 } });

  let body: React.ReactNode;
  if (!deck) {
    body = <>
      <h2>You need a deck first</h2>
      <p>Your deck is a vault position on Monad. Claim testnet tUSD, deposit at least 10 and you get a deck NFT to battle with.</p>
      <Link className="cm-btn cm-play qm-btn" href="/deposit">GET A DECK</Link>
    </>;
  } else if (done && !mine) {
    const won = done.m.winner?.toLowerCase() === me;
    const draw = done.m.winner === zeroAddress;
    body = <>
      <h2 className={`qm-result ${won ? "win" : draw ? "draw" : "lose"}`}>{draw ? "DRAW" : won ? "VICTORY!" : "DEFEAT"}</h2>
      <p>Match #{String(done.id)} settled onchain. Your rating is now <b>{String(rating.data ?? "…")}</b>.</p>
      <div className="qm-row">
        <Link className="cm-btn cm-collection qm-btn" href={`/match/${done.id}`}>REPLAY</Link>
        <button className="cm-btn cm-play qm-btn" onClick={() => { setDoneId(null); setPick(null); refetch(); }}>PLAY AGAIN</button>
      </div>
    </>;
  } else if (mine) {
    const st = Number(mine.m.status);
    const vs = mine.m.playerA?.toLowerCase() === me ? mine.m.playerB : mine.m.playerA;
    if (st === 0) {
      const left = Math.max(0, Number(mine.m.createdAt) + TTL - now);
      body = <>
        <div className="qm-spinner" aria-hidden />
        <h2>Searching for an opponent…</h2>
        <p>Your challenge #{String(mine.id)} is open. The next player who taps Battle joins it. Keep this screen open.</p>
        <small>It closes by itself in {Math.ceil(left / 60)} min if nobody joins.</small>
        {left === 0 && <TxButton label="CLOSE CHALLENGE" onConfirmed={refetch} request={{ address: ad("arena"), abi: abis.arena, functionName: "expire", args: [mine.id] }} />}
      </>;
    } else {
      const ready = !!block && block > mine.seedBlock;
      body = <>
        <h2>Opponent found!</h2>
        <p className="qm-vs"><b>You</b> vs <b>{short(vs)}</b></p>
        <p>{ready ? "The battle seed is set. Resolve the battle onchain." : "Rolling the battle seed on the next block…"}</p>
        <TxButton label={ready ? "FIGHT!" : "WAITING FOR SEED…"} disabled={!ready} onConfirmed={refetch} request={{ address: ad("arena"), abi: abis.arena, functionName: "resolve", args: [mine.id] }} />
        <small>If the seed expired, FIGHT re-arms it. Press it again.</small>
      </>;
    }
  } else if (target) {
    body = <>
      <h2>Opponent found!</h2>
      <p className="qm-vs"><b>You</b> vs <b>{short(target.m.playerA)}</b></p>
      <p>Join their open challenge with your {TIERS[deck.tier]} deck #{String(deck.id)}.</p>
      <TxButton label="JOIN BATTLE" onConfirmed={refetch} request={{ address: ad("arena"), abi: abis.arena, functionName: "accept", args: [target.id, deck.id] }} />
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
      <header className="qm-top">
        <Link className="cm-btn qm-back" href="/">◀ MENU</Link>
        <Link className="cm-square" href="/leaderboard" aria-label="Leaderboard">🏆</Link>
      </header>
      <section className="qm-card">{body}</section>
      <p className="qm-foot">Online · Monad testnet · rating {String(rating.data ?? "…")}</p>
    </div>
  );
}

export default function PlayPage() {
  return <Suspense><QuickMatch /></Suspense>;
}
