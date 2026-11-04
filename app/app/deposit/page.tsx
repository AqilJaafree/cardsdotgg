"use client";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { parseUnits } from "viem";
import { TxButton } from "@/components/TxButton";
import { Gate } from "@/components/NotDeployed";
import { abis, ad, ASSETS, fmtGold, fmtUsd, TIERS } from "@/lib/contracts";

const BLURB = ["Low risk, steady rate", "70/30 credit and gold mix", "High rate, high variance"];

export default function Deposit() {
  const { address } = useAccount();
  const [asset, setAsset] = useState(0);
  const [tier, setTier] = useState(0);
  const [amt, setAmt] = useState("10");
  const tokenKey = asset === 0 ? "tUSD" : "tGOLD";
  const dec = asset === 0 ? 6 : 18;
  const q = { query: { enabled: !!address, refetchInterval: 5000 } };
  const bal = useReadContract({ address: ad(tokenKey), abi: abis.token, functionName: "balanceOf", args: [address!], ...q });
  const next = useReadContract({ address: ad(tokenKey), abi: abis.token, functionName: "nextClaimAt", args: [address!], ...q });
  const allow = useReadContract({ address: ad(tokenKey), abi: abis.token, functionName: "allowance", args: [address!, ad("deckVault")], ...q });
  const price = useReadContract({ address: ad("rateOracle"), abi: abis.oracle, functionName: "goldPrice" });
  const rate = useReadContract({ address: ad("rateOracle"), abi: abis.oracle, functionName: "rateOf", args: [tier] });
  let amount = 0n; try { amount = parseUnits(amt || "0", dec); } catch {}
  const approved = ((allow.data as bigint) ?? 0n) >= amount && amount > 0n;
  const wait = Number((next.data as bigint) ?? 0n) - Math.floor(Date.now() / 1000);
  const fmt = asset === 0 ? fmtUsd : fmtGold;
  const refetch = () => { bal.refetch(); next.refetch(); allow.refetch(); };
  return (
    <Gate>
      <div className="card">
        <h2>1. Claim testnet tokens</h2>
        <p>tUSD and tGOLD are testnet tokens, claimable once per 24h. Balance: {fmt((bal.data as bigint) ?? 0n)} {tokenKey}</p>
        <select value={asset} onChange={(e) => setAsset(+e.target.value)}>{ASSETS.map((a, i) => <option key={a} value={i}>{a}</option>)}</select>{" "}
        {wait > 0 && <span> next claim in {Math.ceil(wait / 3600)}h</span>}
        <TxButton label={`Claim ${tokenKey}`} disabled={!address || wait > 0} onConfirmed={refetch}
          request={{ address: ad(tokenKey), abi: abis.token, functionName: "claim" }} />
      </div>
      <div className="card">
        <h2>2. Deposit and mint a deck</h2>
        <p>Pick a tier. Rate shown is the oracle rate: {(Number(rate.data ?? 0) / 100).toFixed(2)}% APR. Yield is paid in tUSD from a reserve. Minimum 10 tUSD{asset === 1 && ` (tGOLD valued at ${fmtUsd((price.data as bigint) ?? 0n)} tUSD per tGOLD)`}.</p>
        <div className="row">{TIERS.map((t, i) => (
          <button key={t} className={tier === i ? "" : "ghost"} onClick={() => setTier(i)}>{t}<br /><small>{BLURB[i]}</small></button>
        ))}</div>
        <p><input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" /> {tokenKey}</p>
        <TxButton label={`Approve ${tokenKey}`} disabled={!address || approved || amount === 0n} onConfirmed={refetch}
          request={{ address: ad(tokenKey), abi: abis.token, functionName: "approve", args: [ad("deckVault"), amount] }} />
        <TxButton label="Deposit" disabled={!address || !approved} onConfirmed={refetch}
          request={{ address: ad("deckVault"), abi: abis.vault, functionName: "deposit", args: [asset, amount, tier] }} />
      </div>
    </Gate>
  );
}
