"use client";
import Link from "next/link";
import { useState } from "react";
import { useAccount, useBlockNumber, useReadContract, useReadContracts } from "wagmi";
import { isAddress, zeroAddress } from "viem";
import { TxButton } from "@/components/TxButton";
import { Gate } from "@/components/NotDeployed";
import { abis, ad, fmtUsd, STATUS, TIERS } from "@/lib/contracts";
import { useDecks } from "@/lib/useDecks";

function MatchRow({ id, m, seedBlock, myDecks, refetch }: { id: bigint; m: any; seedBlock: bigint; myDecks: bigint[]; refetch: () => void }) {
  const { address } = useAccount();
  const { data: block } = useBlockNumber({ watch: true });
  const [picked, setDeck] = useState<string>("");
  const deck = picked || (myDecks[0] ? String(myDecks[0]) : "");
  const st = Number(m.status);
  const mine = address && m.playerA?.toLowerCase() === address.toLowerCase();
  const staked = m.stakeA > 0n;
  return (
    <div className="card">
      <b>Match #{String(id)}</b> · {STATUS[st]} · deck A #{String(m.deckA)} · {staked ? `staked ${fmtUsd(m.stakeA)} tUSD` : "Rank-only"}
      {st === 3 && <> · <Link href={`/match/${id}`}>Watch replay</Link></>}
      {st === 0 && !mine && (
        <div><select value={deck} onChange={(e) => setDeck(e.target.value)}>{myDecks.map((d) => <option key={String(d)} value={String(d)}>Deck #{String(d)}</option>)}</select>
          <TxButton label="Accept" disabled={!deck} onConfirmed={refetch} request={{ address: ad("arena"), abi: abis.arena, functionName: "accept", args: [BigInt(id), BigInt(deck)] }} /></div>
      )}
      {st === 0 && <TxButton label="Expire (after 1h)" onConfirmed={refetch} request={{ address: ad("arena"), abi: abis.arena, functionName: "expire", args: [id] }} />}
      {st === 1 && (
        <TxButton label={block && block > seedBlock ? "Resolve" : "Waiting for seed block…"} disabled={!block || block <= seedBlock} onConfirmed={refetch}
          request={{ address: ad("arena"), abi: abis.arena, functionName: "resolve", args: [id] }} />
      )}
      {st === 1 && <small>prototype-only randomness. If the seed hash expired, Resolve re-arms; press it again.</small>}
    </div>
  );
}

export default function Arena() {
  const { address } = useAccount();
  const { decks } = useDecks();
  const live = decks.filter((d) => !d.retired);
  const [deck, setDeck] = useState("");
  const [opp, setOpp] = useState("");
  const count = useReadContract({ address: ad("arena"), abi: abis.arena, functionName: "matchCount", query: { refetchInterval: 6000 } });
  const n = Number(count.data ?? 0n);
  const ids = Array.from({ length: Math.min(n, 8) }, (_, i) => BigInt(n - i));
  const res = useReadContracts({
    contracts: ids.flatMap((id) => [
      { address: ad("arena"), abi: abis.arena, functionName: "getMatch", args: [id] },
      { address: ad("arena"), abi: abis.arena, functionName: "seedBlockOf", args: [id] },
    ]) as any, query: { enabled: n > 0, refetchInterval: 6000 },
  });
  const rows = ids.map((id, i) => ({ id, m: res.data?.[i * 2]?.result as any, sb: (res.data?.[i * 2 + 1]?.result as bigint) ?? 0n })).filter((r) => r.m);
  const players = [...new Set(rows.flatMap((r) => [r.m.playerA, r.m.playerB]).filter((p: string) => p && p !== zeroAddress))] as `0x${string}`[];
  const ratings = useReadContracts({ contracts: players.map((p) => ({ address: ad("arena"), abi: abis.arena, functionName: "ratingOf", args: [p] })) as any, query: { enabled: players.length > 0, refetchInterval: 10000 } });
  const sel = deck || (live[0] ? String(live[0].id) : "");
  const stake = live.find((d) => String(d.id) === sel);
  const oppOk = opp === "" || isAddress(opp);
  const refetch = () => { count.refetch(); res.refetch(); ratings.refetch(); };
  return (
    <Gate>
      <div className="card">
        <h2>Challenge</h2>
        <select value={sel} onChange={(e) => setDeck(e.target.value)}>{live.map((d) => <option key={String(d.id)} value={String(d.id)}>{TIERS[d.tier]} Deck #{String(d.id)}</option>)}</select>{" "}
        <input placeholder="opponent address (blank = open challenge)" value={opp} onChange={(e) => setOpp(e.target.value)} size={44} />
        {stake && <p><small>{stake.available > 0n ? "Escrow covers the stake: staked match if both sides can cover theirs; otherwise Rank-only." : "Escrow is empty: this will be Rank-only."} Available {fmtUsd(stake.available)} tUSD.</small></p>}
        <TxButton label="Create challenge" disabled={!address || !sel || !oppOk} onConfirmed={refetch}
          request={{ address: ad("arena"), abi: abis.arena, functionName: "createChallenge", args: [BigInt(sel || 0), (opp || zeroAddress) as `0x${string}`] }} />
      </div>
      <h2>Recent matches</h2>
      {rows.map((r) => <MatchRow key={String(r.id)} id={r.id} m={r.m} seedBlock={r.sb} myDecks={live.map((d) => d.id)} refetch={refetch} />)}
      <div className="card"><h3>Ratings (players in recent matches)</h3>
        {players.map((p, i) => <div key={p}>{p.slice(0, 8)}…{p.slice(-4)}: {String(ratings.data?.[i]?.result ?? "…")}</div>)}
      </div>
    </Gate>
  );
}
