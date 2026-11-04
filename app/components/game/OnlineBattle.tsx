"use client";
import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { abis, ad, cards, TIERS } from "@/lib/contracts";
import { cardById, decks as artDecks } from "@/lib/game/catalog";
import HoloCard from "./HoloCard";

/** The card art shown for an onchain card: the art deck of its tier, in the same position. */
export function artFor(cardId: number) {
  const c = cards.find((x) => x.id === cardId);
  const tier = c?.tier ?? 0;
  const idx = cards.filter((x) => x.tier === tier).sort((a, b) => a.id - b.id).findIndex((x) => x.id === cardId);
  return cardById(artDecks[tier].cards[Math.max(0, idx)]);
}
/** A tier's eight onchain cards in lineup order (slots 0-2 start active). */
const lineup = (tier: number) => cards.filter((c) => c.tier === tier).sort((a, b) => a.id - b.id);
const maxHp = (cardId: number) => (cards.find((c) => c.id === cardId)?.hp ?? 30) * 50;

/** Searching: a ring of cards spinning above a radar sweep. */
export function SearchingAnim({ tier }: { tier: number }) {
  const ids = artDecks[tier].cards.slice(0, 6);
  return (
    <div className="ob-search" aria-hidden>
      <div className="ob-radar" />
      <div className="ob-ring">
        {ids.map((id, i) => <img key={id} src={cardById(id).src} alt="" style={{ "--i": i } as React.CSSProperties} draggable={false} />)}
      </div>
    </div>
  );
}

/** Opponent found: both lead cards slam in from the sides with a VS flash. */
export function VsSlam({ myTier, theirTier, them }: { myTier: number; theirTier?: number; them: string }) {
  const mine = cardById(artDecks[myTier].cards[0]);
  const theirs = cardById(artDecks[theirTier ?? (myTier + 2) % 3].cards[0]);
  return (
    <div className="ob-vs" aria-hidden>
      <div className="ob-vs-card left"><HoloCard rarity="Holo Rare"><img src={mine.src} alt="" draggable={false} /></HoloCard><b>YOU</b></div>
      <div className="ob-vs-flash">VS</div>
      <div className="ob-vs-card right"><HoloCard rarity="Holo Rare"><img src={theirs.src} alt="" draggable={false} /></HoloCard><b>{them}</b></div>
    </div>
  );
}

const AMOUNT = 10_000_000n; // 10 tUSD, the vault minimum (6 decimals)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A free starter pack: gas from the server, then claim testnet tUSD, approve and deposit into a random tier, which mints the deck. */
export function StarterPack({ onDone }: { onDone: () => void }) {
  const { address } = useAccount();
  const pub = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [step, setStep] = useState<"idle" | "gas" | "claim" | "approve" | "mint" | "reveal">("idle");
  const [tier, setTier] = useState(0);
  const [err, setErr] = useState("");
  const label = { idle: "", gas: "Getting gas for your wallet…", claim: "Claiming your free tUSD…", approve: "Approving the vault…", mint: "Minting your deck…", reveal: "" }[step];

  async function open() {
    if (!address || !pub) return;
    setErr("");
    const t = crypto.getRandomValues(new Uint8Array(1))[0] % 3;
    setTier(t);
    try {
      setStep("gas");
      await fetch("/api/starter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) }).catch(() => null);
      for (let i = 0; i < 20 && (await pub.getBalance({ address })) < parseEther("0.005"); i++) await sleep(1500);
      const send = async (s: typeof step, req: Parameters<typeof writeContractAsync>[0]) => {
        setStep(s);
        const hash = await writeContractAsync(req);
        const r = await pub.waitForTransactionReceipt({ hash });
        if (r.status !== "success") throw new Error("Transaction reverted onchain.");
      };
      const bal = (await pub.readContract({ address: ad("tUSD"), abi: abis.token, functionName: "balanceOf", args: [address] })) as bigint;
      if (bal < AMOUNT) await send("claim", { address: ad("tUSD"), abi: abis.token, functionName: "claim" });
      const allowance = (await pub.readContract({ address: ad("tUSD"), abi: abis.token, functionName: "allowance", args: [address, ad("deckVault")] })) as bigint;
      if (allowance < AMOUNT) await send("approve", { address: ad("tUSD"), abi: abis.token, functionName: "approve", args: [ad("deckVault"), AMOUNT] });
      await send("mint", { address: ad("deckVault"), abi: abis.vault, functionName: "deposit", args: [0, AMOUNT, t] });
      setStep("reveal");
      setTimeout(onDone, 3200);
    } catch (e) {
      setStep("idle");
      setErr((e as { shortMessage?: string }).shortMessage ?? (e instanceof Error ? e.message.split("\n")[0] : "Something went wrong."));
    }
  }

  if (step === "reveal") {
    const ids = artDecks[tier].cards.slice(0, 3);
    return (
      <>
        <div className="ob-burst" aria-hidden />
        <h2 className="ob-reveal-title">{TIERS[tier].toUpperCase()} DECK!</h2>
        <div className="ob-reveal">
          {ids.map((id, i) => <div key={id} className="ob-reveal-card" style={{ "--i": i - 1 } as React.CSSProperties}><HoloCard rarity="Holo Rare"><img src={cardById(id).src} alt="" draggable={false} /></HoloCard></div>)}
        </div>
        <p>Your deck NFT is minted on Monad. Let&apos;s battle!</p>
      </>
    );
  }
  const busy = step !== "idle";
  return (
    <>
      <h2>Your free starter pack</h2>
      <div className={`ob-pack ${busy ? "shaking" : ""}`}>
        <img src={artDecks[busy ? tier : 1].pack} alt="" draggable={false} />
      </div>
      <p>{busy ? label : "Every player gets one free pack. It becomes your battle deck, minted onchain."}</p>
      <button className="cm-btn cm-play qm-btn" disabled={busy || !address} onClick={open}>{busy ? "OPENING…" : "OPEN FREE PACK"}</button>
      {busy && <small>Approve each step in your wallet.</small>}
      {err && <p className="err">{err}</p>}
    </>
  );
}

type Slot = { cardId: number; hp: number; max: number } | null;
type Fx = { side: number; slot: number; target: number; dmg: number; crit: boolean; dodged: boolean; kind: number; n: number };

/** Replays a settled match from the engine's own log (the same call the contract settled with), then reports the winner. */
export function OnchainBattle({ id, m, me, onDone }: { id: bigint; m: any; me: string; onDone: () => void }) {
  const meSide = m.playerA?.toLowerCase() === me ? 0 : 1;
  const decks = useReadContracts({ contracts: [m.deckA, m.deckB].map((d: bigint) => ({ address: ad("deckVault"), abi: abis.vault, functionName: "getDeck", args: [d] })) as any });
  const tiers = decks.data?.map((r) => Number((r.result as any)?.tier ?? 0));
  const log = useReadContract({ address: ad("battleEngine"), abi: abis.engine, functionName: "simulateWithLog", args: tiers ? [m.seed, tiers[0], tiers[1]] : undefined, query: { enabled: !!tiers } });
  const actions = (log.data as any[] | undefined) ?? [];

  const start = useMemo<Slot[][]>(() => (tiers ? tiers.map((t) => lineup(t).slice(0, 3).map((c) => ({ cardId: c.id, hp: maxHp(c.id), max: maxHp(c.id) }))) : [[], []]), [tiers?.join(",")]); // eslint-disable-line
  const [board, setBoard] = useState<Slot[][]>(start);
  const [i, setI] = useState(0);
  const [fx, setFx] = useState<Fx | null>(null);
  const [finished, setFinished] = useState(false);
  useEffect(() => setBoard(start), [start]);

  useEffect(() => {
    if (!actions.length || finished) return;
    if (i >= actions.length) { setFinished(true); setTimeout(onDone, 900); return; }
    const t = setTimeout(() => {
      const a = actions[i];
      const side = Number(a.side), other = 1 - side, kind = Number(a.kind);
      setBoard((b) => {
        const nb = b.map((row) => row.map((s) => (s ? { ...s } : s)));
        const put = (sd: number, slot: number, cardId: number, hp: number) => { if (slot < 3) nb[sd][slot] = { cardId, hp, max: maxHp(cardId) }; };
        if (kind === 0) {
          put(other, Number(a.targetSlot), Number(a.targetCardId), Number(a.targetHpAfter));
          put(side, Number(a.slot), Number(a.cardId), Number(a.selfHpAfter));
        } else if (kind === 1) {
          put(side, Number(a.targetSlot), Number(a.targetCardId), Number(a.targetHpAfter));
        } else {
          put(side, Number(a.slot), Number(a.cardId), Number(a.selfHpAfter) || maxHp(Number(a.cardId)));
        }
        return nb;
      });
      setFx({ side, slot: Number(a.slot), target: Number(a.targetSlot), dmg: Number(a.damage), crit: !!a.crit, dodged: !!a.dodged, kind, n: i });
      setI(i + 1);
    }, i === 0 ? 900 : 300);
    return () => clearTimeout(t);
  }, [i, actions.length, finished]); // eslint-disable-line

  const row = (side: number) => (
    <div className={`ob-row ${side === meSide ? "mine" : "theirs"}`}>
      {(board[side] ?? []).map((s, slot) => {
        const art = s ? artFor(s.cardId) : null;
        const attacking = fx && fx.side === side && fx.slot === slot && fx.kind === 0;
        const hit = fx && fx.kind === 0 && fx.side !== side && fx.target === slot;
        const pct = s ? Math.max(0, Math.min(100, (s.hp / s.max) * 100)) : 0;
        return (
          <div key={`${slot}-${fx?.n ?? 0}`} className={`ob-slot ${attacking ? "attacking" : ""} ${hit ? "hit" : ""} ${s && s.hp <= 0 ? "fainted" : ""}`}>
            {art && <img src={art.src} alt={art.name} draggable={false} />}
            <span className="ob-hp"><i style={{ width: `${pct}%` }} className={pct < 30 ? "low" : ""} /></span>
            {hit && <b className={`ob-dmg ${fx!.crit ? "crit" : ""}`}>{fx!.dodged ? "DODGE" : fx!.dmg === 0 ? "BLOCK" : `-${fx!.dmg}`}{fx!.crit && !fx!.dodged ? "!" : ""}</b>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="ob-battle">
      <div className="ob-battle-top"><span>MATCH #{String(id)} · ONCHAIN</span><button className="cm-btn qm-back" onClick={() => { setFinished(true); onDone(); }}>SKIP ▶</button></div>
      {!actions.length ? <p className="ob-loading">Loading the battle from Monad…</p> : <>
        {row(1 - meSide)}
        <div className="ob-mid">ROUND {actions[Math.max(0, i - 1)]?.round ?? 1}</div>
        {row(meSide)}
      </>}
    </div>
  );
}
