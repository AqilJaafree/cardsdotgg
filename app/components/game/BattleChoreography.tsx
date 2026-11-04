"use client";
import { useEffect, useRef, useState } from "react";
import { Hexagon, Swords, X, Zap } from "lucide-react";
import { cardById } from "@/lib/game/catalog";
import { battleTiming, moveName, type AttackCue } from "@/lib/game/choreography";
import { sound } from "@/lib/game/sound";
import { practiceDamage, type Fighter } from "@/lib/game/simulation";
import { Energy } from "./BattleBoard";

/** The battle opening is separate from the user's 3D deck showcase. */
export function BattleOpening({ opponent, onDone, onStage }: { opponent: string; onDone: () => void; onStage: (stage: string) => void }) {
  const [stage, setStage] = useState("versus");
  const done = useRef(onDone), change = useRef(onStage);
  done.current = onDone; change.current = onStage;
  useEffect(() => {
    const set = (value: string) => { setStage(value); change.current(value); sound("flip"); };
    change.current("versus");
    const timers = [
      setTimeout(() => set("coin"), battleTiming.versus),
      setTimeout(() => set("deal"), battleTiming.versus + battleTiming.openingCoin),
      setTimeout(() => done.current(), battleTiming.versus + battleTiming.openingCoin + battleTiming.deal),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  return <div className={`battle-opening opening-${stage}`} aria-label="Battle opening">
    {stage === "versus" && <div className="versus-screen">
      <div className="versus-band rival"><span className="versus-avatar"><Hexagon size={40}/></span><small>READY FOR THE CHALLENGE</small><b>{opponent}</b></div>
      <div className="versus-ring"/><strong className="versus-word">VS.</strong>
      <div className="versus-band you"><span className="versus-avatar"><Swords size={40}/></span><small>MAKE YOUR MOVE</small><b>YOU</b></div>
    </div>}
    {stage === "coin" && <div className="opening-coin"><div className="flip-coin"><Hexagon size={46}/></div><strong>Going first</strong></div>}
    {stage === "deal" && <div className="deal-announcement">Your cards are ready</div>}
    <button className="opening-skip" onClick={() => done.current()}>Skip opening</button>
  </div>;
}

export function AttackCinematic({ cue }: { cue: AttackCue }) {
  const card = cardById(cue.cardId);
  return <div className={`attack-cinematic attack-tier-${cue.tier} attack-from-${cue.side}`} key={cue.id} aria-live="polite">
    <div className="attack-dimmer"/>
    <img className="attack-hero" src={card.src} alt={card.name}/>
    <div className="attack-title-band"><b>{moveName(cue.cardId)}</b><small>{card.name}{cue.strong ? " · Power attack" : ""}</small></div>
    <div className="attack-speed-lines"/>
  </div>;
}

export function AttackChoices({ unit, tier, onAttack, onClose, onInspect }: { unit: Fighter; tier: number; onAttack: (strong: boolean) => void; onClose: () => void; onInspect: () => void }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return <div className="attack-choices" role="dialog" aria-modal="true" aria-label="Choose an attack">
    <button className="attack-dismiss" onClick={onClose} aria-label="Close attack choices"><X size={19}/></button>
    <button className="choice-card" onClick={onInspect} aria-label="Inspect active card"><img src={cardById(unit.id).src} alt={cardById(unit.id).name}/></button>
    <div className={`move-options attack-tier-${tier}`}>
      <button autoFocus onClick={() => onAttack(false)}><span><Energy tier={tier}/><b>{moveName(unit.id)}</b></span><strong>{practiceDamage(unit, false)}</strong><small>Attack with your active Pokémon.</small></button>
      <button disabled={unit.energy < 2} onClick={() => onAttack(true)}><span><Zap size={15}/><b>Power attack</b></span><strong>{practiceDamage(unit, true)}</strong><small>{unit.energy < 2 ? "Attach 2 Energy to unlock" : "Charge up for a stronger hit."}</small></button>
      <button className="move-cancel" onClick={onClose}>Back to the board</button>
    </div>
  </div>;
}
