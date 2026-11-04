"use client";
import Link from "next/link";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { zeroAddress } from "viem";
import { abis, ad } from "@/lib/contracts";

/** Most matches the leaderboard reads in one go; the newest ones win if there are more. */
const MAX = 300;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Every player who has played a match onchain, ranked by their onchain Elo rating, with wins and losses from settled matches. */
export default function Leaderboard() {
  const { address } = useAccount();
  const me = address?.toLowerCase();
  const count = useReadContract({ address: ad("arena"), abi: abis.arena, functionName: "matchCount", query: { refetchInterval: 10000 } });
  const n = Number(count.data ?? 0n);
  const ids = Array.from({ length: Math.min(n, MAX) }, (_, i) => BigInt(n - i));
  const matches = useReadContracts({ contracts: ids.map((id) => ({ address: ad("arena"), abi: abis.arena, functionName: "getMatch", args: [id] })) as any, query: { enabled: n > 0, refetchInterval: 10000 } });
  const list = (matches.data ?? []).map((r) => r.result as any).filter(Boolean);

  const stats = new Map<string, { w: number; l: number; d: number }>();
  for (const m of list) {
    for (const p of [m.playerA, m.playerB]) if (p && p !== zeroAddress && !stats.has(p.toLowerCase())) stats.set(p.toLowerCase(), { w: 0, l: 0, d: 0 });
    if (Number(m.status) !== 3) continue;
    const a = m.playerA.toLowerCase(), b = m.playerB.toLowerCase(), win = m.winner.toLowerCase();
    if (win === zeroAddress) { stats.get(a)!.d++; stats.get(b)!.d++; }
    else { stats.get(win)!.w++; stats.get(win === a ? b : a)!.l++; }
  }
  const players = [...stats.keys()] as `0x${string}`[];
  const ratings = useReadContracts({ contracts: players.map((p) => ({ address: ad("arena"), abi: abis.arena, functionName: "ratingOf", args: [p] })) as any, query: { enabled: players.length > 0, refetchInterval: 10000 } });
  const rows = players
    .map((p, i) => ({ p, r: Number(ratings.data?.[i]?.result ?? 0), ...stats.get(p)! }))
    .sort((x, y) => y.r - x.r || y.w - x.w);

  return (
    <div className="qm-screen lb-screen">
      <header className="qm-top">
        <Link className="cm-btn qm-back" href="/">◀ MENU</Link>
        <Link className="cm-btn cm-play qm-back" href="/play">BATTLE</Link>
      </header>
      <h1 className="lb-title">LEADERBOARD</h1>
      <section className="qm-card lb-card">
        {!n && <p>No matches yet. Be the first: tap Battle.</p>}
        {n > 0 && !rows.length && <p>Loading ratings from Monad…</p>}
        <ol className="lb-list">
          {rows.map((row, i) => (
            <li key={row.p} className={`${row.p === me ? "me" : ""} ${i < 3 ? `top top-${i + 1}` : ""}`}>
              <span className="lb-rank">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
              <span className="lb-who">{row.p === me ? "You" : row.p === (process.env.NEXT_PUBLIC_PRACTICE_BOT ?? "").toLowerCase() ? "🤖 Practice bot" : short(row.p)}<small>{row.w}W · {row.l}L{row.d ? ` · ${row.d}D` : ""}</small></span>
              <b className="lb-rating">{row.r || "…"}</b>
            </li>
          ))}
        </ol>
      </section>
      <p className="qm-foot">Elo ratings stored onchain in the Arena contract · {n} matches</p>
    </div>
  );
}
