"use client";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { TxButton } from "@/components/TxButton";
import { Gate } from "@/components/NotDeployed";
import { abis, ad, fmtGold, fmtUsd, liq } from "@/lib/contracts";
import { explorerAddr } from "@/lib/chain";

const MAINNET_EXPLORER = "https://monadscan.com/address/";
const u = (v: bigint | undefined, d: number) => (Number(v ?? 0n) / 10 ** d).toLocaleString(undefined, { maximumFractionDigits: 4 });
const slipMin = (v: bigint, slip: string) => (v * BigInt(Math.round((100 - Number(slip || 0)) * 100))) / 10000n;
const parse = (s: string, d: number) => { try { return parseUnits(s || "0", d); } catch { return 0n; } };

function Allowance({ token, spender, need, onDone }: { token: "tUSD" | "tGOLD"; spender: `0x${string}`; need: bigint; onDone: () => void }) {
  const { address } = useAccount();
  const a = useReadContract({ address: ad(token), abi: abis.token, functionName: "allowance", args: [address!, spender], query: { enabled: !!address, refetchInterval: 5000 } });
  const ok = ((a.data as bigint) ?? 0n) >= need;
  return <TxButton label={ok ? `${token} approved` : `Approve ${token}`} disabled={!address || ok || need === 0n} onConfirmed={() => { a.refetch(); onDone(); }}
    request={{ address: ad(token), abi: abis.token, functionName: "approve", args: [spender, need] }} />;
}

export default function Pool() {
  const { address } = useAccount();
  const pool = ad("liquidityPool");
  const [slip, setSlip] = useState("1");
  const [tusd, setTusd] = useState("100");
  const [gold, setGold] = useState("0.025");
  const [swapAsset, setSwapAsset] = useState(0);
  const [swapIn, setSwapIn] = useState("10");
  const [shares, setShares] = useState("");
  const rv = useReadContract({ address: pool, abi: abis.pool, functionName: "reserves", query: { refetchInterval: 6000 } });
  const pos = useReadContract({ address: pool, abi: abis.pool, functionName: "positionOf", args: [address!], query: { enabled: !!address, refetchInterval: 6000 } });
  const [rT, rG] = (rv.data as readonly [bigint, bigint] | undefined) ?? [0n, 0n];
  const [pS, pT, pG] = (pos.data as readonly [bigint, bigint, bigint] | undefined) ?? [0n, 0n, 0n];
  const tIn = parse(tusd, 6), gIn = parse(gold, 18);
  const sDec = swapAsset === 0 ? 6 : 18;
  const sAmt = parse(swapIn, sDec);
  const quote = useReadContract({ address: pool, abi: abis.pool, functionName: "quoteSwap", args: [swapAsset, sAmt], query: { enabled: sAmt > 0n && rT > 0n } });
  const out = (quote.data as bigint | undefined) ?? 0n;
  const allowOf = (token: "tUSD" | "tGOLD") => ({ address: ad(token), abi: abis.token, functionName: "allowance", args: [address!, pool], query: { enabled: !!address, refetchInterval: 4000 } }) as const;
  const allowT = useReadContract(allowOf("tUSD"));
  const allowG = useReadContract(allowOf("tGOLD"));
  const okT = (need: bigint) => ((allowT.data as bigint) ?? 0n) >= need;
  const okG = (need: bigint) => ((allowG.data as bigint) ?? 0n) >= need;
  const swapApproved = swapAsset === 0 ? okT(sAmt) : okG(sAmt);
  const refetch = () => { rv.refetch(); pos.refetch(); allowT.refetch(); allowG.refetch(); };
  const shAmt = parse(shares, 12);
  // expected withdrawal for the share amount, from reserves and total shares via position ratio
  const rmT = pS > 0n ? (pT * shAmt) / pS : 0n, rmG = pS > 0n ? (pG * shAmt) / pS : 0n;
  const mr = liq;
  return (
    <Gate>
      <div className="card warn">
        Testnet tokens only. Pool fees come only from swaps on this pool and stay in the reserves, so there is nothing to claim and no APR is shown. The pool price moves with its own swaps and does not follow mainnet.
      </div>
      <div className="card">
        <h2>Testnet pool (tUSD / tGOLD)</h2>
        <p><a href={explorerAddr(pool)} target="_blank" rel="noreferrer">Pool contract</a> · reserves: {u(rT, 6)} tUSD / {u(rG, 18)} tGOLD</p>
        <p>Your position: {u(pS, 12)} LP shares ≈ {u(pT, 6)} tUSD + {u(pG, 18)} tGOLD (value moves with the pool price)</p>
        <label>Slippage <input size={3} value={slip} onChange={(e) => setSlip(e.target.value)} />%</label>
      </div>
      <div className="card">
        <h3>1. Add liquidity</h3>
        <input value={tusd} onChange={(e) => setTusd(e.target.value)} /> tUSD <input value={gold} onChange={(e) => setGold(e.target.value)} /> tGOLD
        <Allowance token="tUSD" spender={pool} need={tIn} onDone={() => {}} />
        <Allowance token="tGOLD" spender={pool} need={gIn} onDone={() => {}} />
        <TxButton label="Add liquidity" disabled={!address || tIn === 0n || gIn === 0n || !okT(tIn) || !okG(gIn)} onConfirmed={refetch}
          request={{ address: pool, abi: abis.pool, functionName: "addLiquidity", args: [tIn, gIn, slipMin(tIn, slip), slipMin(gIn, slip)] }} />
      </div>
      <div className="card">
        <h3>2. Swap</h3>
        <select value={swapAsset} onChange={(e) => setSwapAsset(+e.target.value)}><option value={0}>tUSD → tGOLD</option><option value={1}>tGOLD → tUSD</option></select>{" "}
        <input value={swapIn} onChange={(e) => setSwapIn(e.target.value)} />
        <p>Expected out: {swapAsset === 0 ? fmtGold(out) + " tGOLD" : fmtUsd(out) + " tUSD"} · min after slippage {swapAsset === 0 ? fmtGold(slipMin(out, slip)) : fmtUsd(slipMin(out, slip))}</p>
        <Allowance token={swapAsset === 0 ? "tUSD" : "tGOLD"} spender={pool} need={sAmt} onDone={() => {}} />
        <TxButton label="Swap" disabled={!address || sAmt === 0n || out === 0n || !swapApproved} onConfirmed={() => { refetch(); quote.refetch(); }}
          request={{ address: pool, abi: abis.pool, functionName: "swap", args: [swapAsset, sAmt, slipMin(out, slip)] }} />
      </div>
      <div className="card">
        <h3>3. Remove liquidity</h3>
        <input placeholder="LP shares" value={shares} onChange={(e) => setShares(e.target.value)} /> <button className="ghost" onClick={() => setShares(formatUnits(pS, 12))}>max</button>
        <p>≈ {u(rmT, 6)} tUSD + {u(rmG, 18)} tGOLD</p>
        <TxButton label="Remove liquidity" disabled={!address || shAmt === 0n || shAmt > pS} onConfirmed={refetch}
          request={{ address: pool, abi: abis.pool, functionName: "removeLiquidity", args: [shAmt, slipMin(rmT, slip), slipMin(rmG, slip)] }} />
      </div>
      {mr.live && (
        <div className="card">
          <h3>Mainnet reference (not this pool)</h3>
          <p>source: Monad mainnet · {String(mr.source)} · <a href={MAINNET_EXPLORER + mr.sourceContract} target="_blank" rel="noreferrer">pool {String(mr.sourceContract).slice(0, 8)}…</a></p>
          <p>Gold price: {(Number(mr.usdPerGold1e6) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD · reserves {u(BigInt(mr.goldReserve as string), Number(mr.goldDecimals))} XAUt0 / {u(BigInt(mr.quoteReserve as string), Number(mr.quoteDecimals))} USDT0 · 24h volume ${Number(mr.volume24hUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p><small>One-time read at {String(mr.readAt)} (mainnet block {String(mr.mainnetBlock)}), not a live stream. {String(mr.note)} Thin mainnet pool. These are mainnet figures, not the testnet pool's reserves or volume; the testnet pool opened from this price and value with test tokens.</small></p>
        </div>
      )}
    </Gate>
  );
}
