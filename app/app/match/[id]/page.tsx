"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useReadContract } from "wagmi";
import { Gate } from "@/components/NotDeployed";
import { abis, ad, cards, fmtUsd, STATUS, TIERS } from "@/lib/contracts";

const KIND = ["attacks", "heals", "swaps", "enters"];

export default function Match() {
  const id = BigInt(useParams<{ id: string }>().id);
  const m = useReadContract({ address: ad("arena"), abi: abis.arena, functionName: "getMatch", args: [id] }).data as any;
  const resolved = m && Number(m.status) === 3;
  const decks = [m?.deckA, m?.deckB];
  const dA = useReadContract({ address: ad("deckVault"), abi: abis.vault, functionName: "getDeck", args: [m?.deckA ?? 0n], query: { enabled: !!m } }).data as any;
  const dB = useReadContract({ address: ad("deckVault"), abi: abis.vault, functionName: "getDeck", args: [m?.deckB ?? 0n], query: { enabled: !!m } }).data as any;
  const ready = resolved && dA && dB;
  const args = ready ? [m.seed, Number(dA.tier), Number(dB.tier)] : undefined;
  const log = useReadContract({ address: ad("battleEngine"), abi: abis.engine, functionName: "simulateWithLog", args, query: { enabled: !!ready } });
  const sim = useReadContract({ address: ad("battleEngine"), abi: abis.engine, functionName: "simulate", args, query: { enabled: !!ready } });
  const actions = (log.data as any[] | undefined) ?? [];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!actions.length) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(actions.length); return; }
    setShown(0);
    const t = setInterval(() => setShown((s) => (s >= actions.length ? s : s + 1)), 350);
    return () => clearInterval(t);
  }, [actions.length]);

  let verdict: React.ReactNode = null;
  if (sim.data && m) {
    const side = Number((sim.data as any)[0]);
    const replayWinner = side === 0 ? m.playerA : side === 1 ? m.playerB : "0x0000000000000000000000000000000000000000";
    const ok = replayWinner.toLowerCase() === m.winner.toLowerCase();
    verdict = ok ? <p>✓ Replay winner matches the onchain MatchResolved winner.</p> : <p className="err">✗ MISMATCH: replay winner {replayWinner} vs onchain {m.winner}</p>;
  }
  const name = (c: number) => cards[c]?.name ?? `#${c}`;
  return (
    <Gate>
      <div className="card">
        <h2>Match #{String(id)} · {m ? STATUS[Number(m.status)] : "…"}</h2>
        <small>prototype-only randomness (blockhash seed). Replay is the contract's own simulateWithLog output.</small>
        {m && <p>{dA && TIERS[Number(dA.tier)]} (deck #{String(decks[0])}) vs {dB && TIERS[Number(dB.tier)]} (deck #{String(decks[1])}) · stakes {fmtUsd(m.stakeA)} / {fmtUsd(m.stakeB)} tUSD · winner {m.winner === "0x0000000000000000000000000000000000000000" ? "draw" : m.winner}</p>}
        {!resolved && m && <p>Not resolved yet.</p>}
        {verdict}
        {log.error && <p className="err">Replay call failed: {log.error.message.slice(0, 200)}</p>}
        <p><small>Rating changes and stake settlement appear in Arena ratings and your deck escrow.</small></p>
      </div>
      <div className="card">
        {actions.slice(0, shown).map((a, i) => (
          <div key={i}>R{a.round} · side {a.side ? "B" : "A"}: {name(a.cardId)} {KIND[a.kind] ?? "acts"}
            {a.kind === 0 && <> {name(a.targetCardId)} for {a.damage}{a.crit ? " (crit)" : ""}{a.dodged ? " (dodged)" : ""} → HP {a.targetHpAfter}</>}
            {a.kind === 1 && <> {name(a.targetCardId)} → HP {a.targetHpAfter}</>}
          </div>
        ))}
      </div>
    </Gate>
  );
}
