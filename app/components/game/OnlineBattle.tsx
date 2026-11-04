"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { abis, ad, cards, TIERS } from "@/lib/contracts";
import { cardById, decks as artDecks } from "@/lib/game/catalog";
import HoloCard from "./HoloCard";
import BattleBoard from "./BattleBoard";
import { AttackCinematic, BattleOpening } from "./BattleChoreography";
import type { EffectEvent } from "./BattleEffects";
import type { BattleState, Fighter, Side as BattleSide } from "@/lib/game/simulation";
import { battleTiming, type AttackCue } from "@/lib/game/choreography";
import { enableSound, sound } from "@/lib/game/sound";
import { ArrowRight, Swords, Trophy, Volume2, VolumeX } from "lucide-react";
const CardTheater = dynamic(() => import("./CardTheater"), { ssr: false });

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

/** Onchain card -> the board's fighter (the board draws art by its catalog id). HP shows at a tenth, like printed card HP. */
const show = (n: number) => Math.round(n / 10);
const fighterOf = (cardId: number, hp: number): Fighter => ({ id: artFor(cardId).id, hp: show(Math.max(0, hp)), maxHp: show(maxHp(cardId)), energy: 1 });

type SideTrack = { slots: number[]; hp: Record<number, number>; focus: number; entered: Set<number>; kos: number };
const startSide = (tier: number): SideTrack => {
  const ids = lineup(tier).map((c) => c.id);
  return { slots: ids.slice(0, 3), hp: Object.fromEntries(ids.map((id) => [id, maxHp(id)])), focus: 0, entered: new Set(ids.slice(0, 3)), kos: 0 };
};
/** The practice board's view of one side: the focused slot is active, the other two are the bench, the rest wait in hand. */
const sideView = (t: SideTrack, tier: number): BattleSide => {
  const active = t.slots[t.focus];
  return {
    active: fighterOf(active, t.hp[active]),
    bench: t.slots.filter((_, i) => i !== t.focus).map((id) => fighterOf(id, t.hp[id])),
    hand: lineup(tier).map((c) => c.id).filter((id) => !t.entered.has(id)).map((id) => artFor(id).id),
    points: Math.min(3, t.kos),
  };
};
const cloneTrack = (t: SideTrack[]) => t.map((x) => ({ ...x, slots: [...x.slots], hp: { ...x.hp }, entered: new Set(x.entered) }));
/** Brings an attack's attacker and target into the active spots, before the hit lands. */
function aim(prev: SideTrack[], a: any): SideTrack[] {
  const next = cloneTrack(prev);
  const own = next[Number(a.side)], opp = next[1 - Number(a.side)];
  own.slots[Number(a.slot)] = Number(a.cardId); own.focus = Number(a.slot);
  opp.slots[Number(a.targetSlot)] = Number(a.targetCardId); opp.focus = Number(a.targetSlot);
  return next;
}
/** Applies one engine log entry: kind 0 attacks, kind 1 heals, anything else brings a card in. */
function step(prev: SideTrack[], a: any): SideTrack[] {
  const kind = Number(a.kind);
  const next = kind === 0 ? aim(prev, a) : cloneTrack(prev);
  const own = next[Number(a.side)], opp = next[1 - Number(a.side)];
  if (kind === 0) {
    const before = opp.hp[Number(a.targetCardId)];
    opp.hp[Number(a.targetCardId)] = Number(a.targetHpAfter);
    own.hp[Number(a.cardId)] = Number(a.selfHpAfter);
    if (before > 0 && Number(a.targetHpAfter) <= 0) own.kos++;
  } else if (kind === 1) {
    own.hp[Number(a.targetCardId)] = Number(a.targetHpAfter);
  } else {
    own.slots[Number(a.slot)] = Number(a.cardId); own.entered.add(Number(a.cardId)); own.hp[Number(a.cardId)] = Number(a.selfHpAfter) || own.hp[Number(a.cardId)];
  }
  return next;
}

/**
 * Replays a settled match with the full practice choreography: the 3D lineup showcase, the VS and coin opening,
 * attack cinematics, knockouts and points, then the result. It is driven by the engine's own log (the call the
 * contract settled with), so what plays is exactly what was settled onchain.
 */
export function OnchainBattle({ id, m, me, practice = false, onDone }: { id: bigint; m: any; me: string; practice?: boolean; onDone: () => void }) {
  const meSide = m.playerA?.toLowerCase() === me ? 0 : 1;
  const decks = useReadContracts({ contracts: [m.deckA, m.deckB].map((d: bigint) => ({ address: ad("deckVault"), abi: abis.vault, functionName: "getDeck", args: [d] })) as any });
  const tiers = decks.data?.map((r) => Number((r.result as any)?.tier ?? 0));
  const log = useReadContract({ address: ad("battleEngine"), abi: abis.engine, functionName: "simulateWithLog", args: tiers ? [m.seed, tiers[0], tiers[1]] : undefined, query: { enabled: !!tiers } });
  const actions = (log.data as any[] | undefined) ?? [];

  const [phase, setPhase] = useState<"intro" | "opening" | "battle" | "result">("intro");
  const [openingStage, setOpeningStage] = useState("versus");
  const [track, setTrack] = useState<SideTrack[] | null>(null);
  const [round, setRound] = useState(1), [mover, setMover] = useState(-1);
  const [attack, setAttack] = useState<"player" | "opponent">();
  const [effect, setEffect] = useState<EffectEvent>();
  const [knockout, setKnockout] = useState<"player" | "opponent">();
  const [cue, setCue] = useState<AttackCue>();
  const [point, setPoint] = useState<"player" | "opponent" | null>(null);
  const [banner, setBanner] = useState("");
  const [inspect, setInspect] = useState<number[] | null>(null);
  const [audio, setAudio] = useState(false), [fast, setFast] = useState(false);
  const speed = useRef(1); speed.current = fast ? 2 : 1;
  useEffect(() => { if (tiers && !track) setTrack([startSide(tiers[0]), startSide(tiers[1])]); }, [tiers?.join(",")]); // eslint-disable-line
  const who = (side: number) => (side === meSide ? "player" : "opponent");
  const won = m.winner?.toLowerCase() === me, draw = /^0x0+$/.test(m.winner ?? "");

  function finish() {
    setPhase("result"); setBanner(""); setCue(undefined); setAttack(undefined); setKnockout(undefined); setPoint(null);
    if (won) { setEffect({ id: Date.now(), kind: "victory", target: "player" }); sound("rare"); }
  }
  function skip() {
    if (!tiers || !actions.length) return;
    setTrack(actions.reduce(step, [startSide(tiers[0]), startSide(tiers[1])]));
    setRound(Number(actions[actions.length - 1].round));
    finish();
  }

  // The replay itself: one log entry at a time, with the practice game's beats.
  useEffect(() => {
    if (phase !== "battle" || !tiers || !actions.length) return;
    let live = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const pause = (ms: number) => new Promise<void>((r) => { timers.push(setTimeout(r, ms / speed.current)); });
    (async () => {
      let t = [startSide(tiers[0]), startSide(tiers[1])];
      setTrack(t);
      const opened = new Set<number>();
      let prevRound = 0;
      for (const a of actions) {
        const side = Number(a.side), kind = Number(a.kind), r = Number(a.round);
        if (r !== prevRound) {
          prevRound = r; setRound(r); setBanner(r === 1 ? "Battle start" : `Round ${r}`); sound("turn");
          await pause(1100); if (!live) return;
          setBanner("");
        }
        if (kind === 0) {
          const attacker = who(side), defender = who(1 - side);
          const ko = t[1 - side].hp[Number(a.targetCardId)] > 0 && Number(a.targetHpAfter) <= 0;
          const cinematic = !opened.has(side) || ko;
          opened.add(side);
          t = aim(t, a); setTrack(t); setMover(side);
          if (cinematic) {
            setCue({ id: Date.now(), cardId: artFor(Number(a.cardId)).id, side: attacker, tier: tiers[side], strong: !!a.crit }); sound("flip");
            await pause(battleTiming.attackImpact - 300); if (!live) return;
            setAttack(attacker);
            await pause(300); if (!live) return;
            setCue(undefined);
          } else {
            setAttack(attacker);
            await pause(260); if (!live) return;
          }
          t = step(t, a); setTrack(t);
          setEffect({ id: Date.now(), kind: "hit", target: defender, amount: a.dodged ? 0 : show(Number(a.damage)), color: a.crit ? 0xff5f6d : undefined }); sound("hit");
          if (ko) setKnockout(defender);
          await pause(320); if (!live) return;
          setAttack(undefined);
          if (ko) {
            await pause(battleTiming.knockout - 320); if (!live) return;
            setKnockout(undefined);
            if (t[side].kos <= 3) {
              setPoint(attacker); sound("rare");
              await pause(battleTiming.pointEnd - battleTiming.pointStart); if (!live) return;
              setPoint(null);
            }
          }
          await pause(cinematic ? 700 : 340); if (!live) return;
        } else if (kind === 1) {
          t = step(t, a); setTrack(t);
          setEffect({ id: Date.now(), kind: "heal", target: who(side), amount: show(Number(a.damage)) });
          await pause(450); if (!live) return;
        } else {
          t = step(t, a); setTrack(t); sound("flip");
          await pause(300); if (!live) return;
        }
      }
      await pause(600); if (live) finish();
    })();
    return () => { live = false; timers.forEach(clearTimeout); };
  }, [phase, actions.length, !!tiers]); // eslint-disable-line

  const state: BattleState | null = track && tiers
    ? { player: sideView(track[meSide], tiers[meSide]), opponent: sideView(track[1 - meSide], tiers[1 - meSide]), turn: round, energyUsed: true, winner: phase === "result" ? (won ? "player" : "opponent") : null }
    : null;
  const rival = (meSide === 0 ? m.playerB : m.playerA) as string;
  const rivalName = practice ? "BOT" : rival ? rival.slice(2, 6).toUpperCase() : "RIVAL";
  const status = phase === "result" ? "MATCH COMPLETE" : phase !== "battle" ? "YOUR LINEUP" : !actions.length ? "LOADING" : mover === meSide ? "YOUR MOVE" : "OPPONENT'S MOVE";
  const myLineup = tiers ? lineup(tiers[meSide]).map((c) => artFor(c.id).id) : [];

  return (
    <div className="arena-page game-fullscreen">
      <div className="arena-layout">
        <section className="arena-center">
          <div className="match-toolbar">
            <span><Swords size={14} />{practice ? "Practice" : "Match"} #{String(id)}</span>
            <span className="match-status"><i />{status}</span>
            <button className="text-button" onClick={() => setFast(!fast)} aria-label={fast ? "Normal speed" : "Double speed"} disabled={phase !== "battle"}>{fast ? "2×" : "1×"}</button>
            <button className="text-button" onClick={skip} aria-label="Skip to result" disabled={phase === "result" || !actions.length}>SKIP ▶</button>
            <button className="text-button game-sound" aria-label={audio ? "Mute sound" : "Enable sound"} onClick={() => { setAudio(!audio); enableSound(!audio); }}>{audio ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
          </div>
          <div className="board-surround">
            {state ? (
              <BattleBoard state={state} tier={tiers![meSide]} opponentTier={tiers![1 - meSide]} opponentName={rivalName} opponentTag={practice ? "Practice bot" : "Online rival"} phase={phase} onInspect={setInspect} banner={banner} attack={attack} effect={effect} knockout={knockout} openingStage={phase === "opening" ? openingStage : "done"}>
                {phase === "opening" && <BattleOpening opponent={rivalName} onDone={() => setPhase("battle")} onStage={setOpeningStage} />}
                {cue && <AttackCinematic cue={cue} />}
                {point && <div className={`point-overlay ${point}`}><div className="point-medal"><Trophy size={28} /></div><h2>+1 point!</h2><div className="point-ribbon" /><p>{point === "player" ? "YOU" : rivalName}</p><div className="big-score">{[0, 1, 2].map((i) => <span key={i} className={state[point].points > i ? "won" : ""}>{i + 1}</span>)}</div></div>}
                {phase === "result" && (
                  <div className="result-overlay">
                    <div className="result-glow" />
                    <span className="eyebrow">{practice ? "PRACTICE" : "ONCHAIN"} MATCH #{String(id)}</span>
                    <Trophy size={45} />
                    <h2>{draw ? "Draw." : won ? "Victory!" : "Well played."}</h2>
                    <p>{draw ? "Nobody fell this time." : won ? "Settled onchain. Your rating goes up." : "Settled onchain. Every battle is a chance to grow."}</p>
                    <img src={cardById(state.player.active.id).src} alt={cardById(state.player.active.id).name} />
                    <div className="result-score"><b>{track![meSide].kos}</b><span>—</span><b>{track![1 - meSide].kos}</b></div>
                    <button className="primary-button" onClick={onDone}>Continue<ArrowRight size={17} /></button>
                  </div>
                )}
              </BattleBoard>
            ) : (
              <p className="ob-loading">Loading the battle from Monad…</p>
            )}
          </div>
        </section>
      </div>
      {phase === "intro" && tiers && <CardTheater ids={myLineup} onDone={() => setPhase("opening")} />}
      {inspect && <CardTheater ids={inspect} title="A closer look" inspection onDone={() => setInspect(null)} />}
    </div>
  );
}
