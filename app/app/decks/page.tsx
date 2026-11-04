"use client";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { TxButton } from "@/components/TxButton";
import { Gate } from "@/components/NotDeployed";
import { abis, ad, ASSETS, cards, fmtGold, fmtUsd, rateSources, TIERS } from "@/lib/contracts";
import { svgFromUri, useDecks } from "@/lib/useDecks";

function Rates() {
  const stale = useReadContract({ address: ad("rateOracle"), abi: abis.oracle, functionName: "isStale", query: { refetchInterval: 15000 } });
  const last = useReadContract({ address: ad("rateOracle"), abi: abis.oracle, functionName: "lastUpdate" });
  return (
    <div className="card">
      <h3>Rates</h3>
      <p><small>Rates are set by the oracle; payouts are reserve-funded testnet tUSD.</small></p>
      {TIERS.map((t, i) => <RateRow key={t} tier={i} name={t} />)}
      <small>Last update: {last.data ? new Date(Number(last.data) * 1000).toLocaleString() : "never"} {stale.data ? <b className="err">· stale</b> : null}</small>
    </div>
  );
}
function RateRow({ tier, name }: { tier: number; name: string }) {
  const r = useReadContract({ address: ad("rateOracle"), abi: abis.oracle, functionName: "rateOf", args: [tier] });
  const src = rateSources.find((s) => String(s.tier) === String(tier) || String(s.tier).toLowerCase() === name.toLowerCase());
  return <div>{name}: {(Number(r.data ?? 0) / 100).toFixed(2)}% APR · {src?.live ? <>source: Monad mainnet (<a href={src.sourceUrl} target="_blank" rel="noreferrer">{src.source}</a>, read {src.readAt})</> : "demo rate, not live"}{(src as any)?.inRange === false && <b className="err"> · out of range, not earning fees right now</b>}{(src as any)?.note && <div><small>{String((src as any).note)}</small></div>}</div>;
}

export default function Decks() {
  const { address } = useAccount();
  const { decks, refetch } = useDecks();
  const [seed, setSeed] = useState("1");
  return (
    <Gate>
      <Rates />
      {decks.length === 0 && <div className="card">No decks yet. Deposit first.</div>}
      {decks.map((d) => {
        const svg = svgFromUri(d.uri);
        const lineup = cards.filter((c) => c.tier === d.tier);
        return (
          <div className="card" key={String(d.id)}>
            <div className="row">
              {svg && <img src={svg} alt={`Deck ${d.id}`} width={180} />}
              <div>
                <h3>{TIERS[d.tier]} Deck #{String(d.id)} {d.retired && "(retired)"}</h3>
                <div>Principal: {d.asset === 0 ? fmtUsd(d.principal) : fmtGold(d.principal)} {ASSETS[d.asset]}</div>
                <div>Escrow available: {fmtUsd(d.available)} tUSD{d.seeded > 0n && " (includes demo seed)"}</div>
                <div>Locked in stake: {fmtUsd(d.locked)} tUSD</div>
                <TxButton label="Checkpoint yield" onConfirmed={refetch} request={{ address: ad("deckVault"), abi: abis.vault, functionName: "checkpoint", args: [d.id] }} />
              </div>
            </div>
            <details><summary>Cards</summary>
              {lineup.map((c) => <div key={c.id}>{c.name} · HP {c.hp} ATK {c.atk} DEF {c.def} SPD {c.spd} · {c.ability}: {c.rule}{!c.implemented && <b className="err"> · ability inactive</b>}</div>)}
            </details>
            <details><summary>Seed escrow (contract owner only)</summary>
              <input value={seed} onChange={(e) => setSeed(e.target.value)} /> tUSD
              <TxButton label="Seed escrow from reserve" disabled={!address} onConfirmed={refetch}
                request={{ address: ad("yieldEscrow"), abi: abis.escrow, functionName: "seedEscrow", args: [d.id, BigInt(Math.round(Number(seed) * 1e6))] }} />
            </details>
          </div>
        );
      })}
    </Gate>
  );
}
