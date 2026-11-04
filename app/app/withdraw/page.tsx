"use client";
import { useState } from "react";
import { useReadContract } from "wagmi";
import { TxButton } from "@/components/TxButton";
import { Gate } from "@/components/NotDeployed";
import { abis, ad, ASSETS, fmtGold, fmtUsd, TIERS } from "@/lib/contracts";
import { DeckView, useDecks } from "@/lib/useDecks";

function Row({ d, refetch }: { d: DeckView; refetch: () => void }) {
  const [exit, setExit] = useState(d.asset);
  const [slip, setSlip] = useState("1");
  const q = useReadContract({ address: ad("withdrawRouter"), abi: abis.router, functionName: "quote", args: [d.id, exit], query: { refetchInterval: 8000 } }).data as readonly [bigint, bigint] | undefined;
  const pOut = q?.[0] ?? 0n, eOut = q?.[1] ?? 0n;
  const fmtP = exit === 0 ? fmtUsd : fmtGold;
  const minOut = (pOut * BigInt(Math.round((100 - Number(slip)) * 100))) / 10000n;
  const blocked = d.locked > 0n;
  return (
    <div className="card">
      <h3>{TIERS[d.tier]} Deck #{String(d.id)}</h3>
      <select value={exit} onChange={(e) => setExit(+e.target.value)}>{ASSETS.map((a, i) => <option key={a} value={i}>Exit as {a}</option>)}</select>{" "}
      slippage <input size={3} value={slip} onChange={(e) => setSlip(e.target.value)} />%
      <p>You receive: {fmtP(pOut)} {ASSETS[exit]} principal + {fmtUsd(eOut)} tUSD escrow</p>
      {blocked && <p className="err">A stake is locked ({fmtUsd(d.locked)} tUSD). Resolve or expire the match first.</p>}
      <TxButton label="Withdraw all" disabled={blocked} onConfirmed={refetch}
        request={{ address: ad("withdrawRouter"), abi: abis.router, functionName: "withdraw", args: [d.id, exit, minOut] }} />
    </div>
  );
}
export default function Withdraw() {
  const { decks, refetch } = useDecks();
  const live = decks.filter((d) => !d.retired);
  return <Gate>{live.length === 0 ? <div className="card">No active decks.</div> : live.map((d) => <Row key={String(d.id)} d={d} refetch={refetch} />)}</Gate>;
}
