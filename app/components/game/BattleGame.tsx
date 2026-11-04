"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, ArrowUpRight, ChevronRight, Crown, Eye, Flag, Leaf, Play, RotateCcw, Shield, Sparkles, Swords, Trophy, Volume2, VolumeX, X, Zap, Maximize2, Minimize2 } from "lucide-react";
import { cardById, decks } from "@/lib/game/catalog";
import { attachEnergy, hit, newBattle, nextTurn, practiceDamage, swapActive, type BattleState } from "@/lib/game/simulation";
import { enableSound, sound } from "@/lib/game/sound";
import BattleBoard, {Energy} from "./BattleBoard";
import { AttackChoices, AttackCinematic, BattleOpening } from "./BattleChoreography";
import { battleTiming, type AttackCue } from "@/lib/game/choreography";
import type { EffectEvent } from "./BattleEffects";
import { MainMenu, StartScreen } from "./GameMenu";
const STARTED_KEY="cardsdotgg.started";
const CardTheater=dynamic(()=>import("./CardTheater"),{ssr:false});
type Log={text:string;kind:"attack"|"info"|"point"};
const rounds=["Quarter-final","Semi-final","Grand final"];
const rivals=["ASTER","NOVA","SOL"];

export default function BattleGame(){
  const [tier,setTier]=useState(0),[round,setRound]=useState(0),[phase,setPhase]=useState<"ready"|"intro"|"opening"|"battle"|"result">("ready");
  const [state,setState]=useState(()=>newBattle(decks[0].cards,decks[2].cards));
  // The title screen shows once per browser session (sessionStorage), not on every refresh.
  const [started,setStarted]=useState<boolean|null>(null);
  useEffect(()=>{try{setStarted(sessionStorage.getItem(STARTED_KEY)==="1");}catch{setStarted(true);}},[]);
  const current=useRef(state);current.current=state;
  const [busy,setBusy]=useState(false),[banner,setBanner]=useState(""),[attack,setAttack]=useState<"player"|"opponent">(),[effect,setEffect]=useState<EffectEvent>();
  const [inspect,setInspect]=useState<number[]|null>(null),[logs,setLogs]=useState<Log[]>([]),[audio,setAudio]=useState(false),[point,setPoint]=useState<"player"|"opponent"|null>(null),[coin,setCoin]=useState(false);
  const [confirmExit,setConfirmExit]=useState(false),[choices,setChoices]=useState(false),[focused,setFocused]=useState(false);
  const [openingStage,setOpeningStage]=useState("versus"),[cue,setCue]=useState<AttackCue>(),[knockout,setKnockout]=useState<"player"|"opponent">(),[swapping,setSwapping]=useState(false);
  const pending=useRef<ReturnType<typeof setTimeout>[]>([]);const generation=useRef(0);const locked=useRef(false);
  const wait=(ms:number,fn:()=>void)=>{const timer=setTimeout(fn,ms);pending.current.push(timer);};
  const clear=()=>{generation.current++;pending.current.forEach(clearTimeout);pending.current=[];locked.current=false;};
  useEffect(()=>()=>{generation.current++;pending.current.forEach(clearTimeout);},[]);
  const change=(next:BattleState)=>{current.current=next;setState(next);};
  const note=(text:string,kind:Log["kind"]="info")=>setLogs(previous=>[...previous,{text,kind}].slice(-16));
  const burst=(kind:EffectEvent["kind"],target:EffectEvent["target"],amount?:number)=>setEffect({id:Date.now(),kind,target,amount});
  function reset(selected=tier,stage=0){clear();setTier(selected);setRound(stage);change(newBattle(decks[selected].cards,decks[(selected+2+stage)%3].cards));setBusy(false);setAttack(undefined);setBanner("");setPoint(null);setCoin(false);setCue(undefined);setKnockout(undefined);setChoices(false);setSwapping(false);setOpeningStage("versus");setLogs([]);}
  // Matches take the whole screen; the browser's own fullscreen is a bonus where it is allowed (not on iPhone Safari).
  function goFullscreen(){try{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.({navigationUI:"hide"}).catch(()=>{});}catch{}}
  function leaveFullscreen(){try{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}catch{}}
  function begin(stage=round){goFullscreen();reset(tier,stage);setPhase("intro");}
  function enter(){setPhase("opening");}
  function startBattle(){setPhase("battle");setBanner("Your turn");sound("turn");note(`${rounds[round]} begins. First to 3 points wins.`);wait(1800,()=>setBanner(""));}
  function finish(winner:"player"|"opponent"){setBusy(false);locked.current=false;setAttack(undefined);setBanner("");setPhase("result");if(winner==="player"){burst("victory","player");sound("rare");}}
  function applyHit(side:"player"|"opponent",amount:number){
    const old=current.current,defender=side==="player"?"opponent":"player";
    const target=cardById(old[defender].active.id).name;
    const next=hit(old,side,amount);
    const knockedOut=next[side].points>old[side].points;
    if(knockedOut){
      change({...old,[defender]:{...old[defender],active:{...old[defender].active,hp:0}}});
      setKnockout(defender);
      wait(battleTiming.knockout,()=>{change(next);setKnockout(undefined);});
    }else change(next);
    burst("hit",defender,amount);sound("hit");
    note(`${side==="player"?"You":rivals[round]} dealt ${amount} damage to ${target}.`,"attack");
    if(knockedOut){wait(battleTiming.pointStart,()=>{setPoint(side);sound("rare");note(`${side==="player"?"You":rivals[round]} earned a point.`,"point");});wait(battleTiming.pointEnd,()=>setPoint(null));}
    return next;
  }
  function animateAttack(side:"player"|"opponent",strong=false){
    const unit=current.current[side].active;
    setCue({id:Date.now(),cardId:unit.id,side,tier:side==="player"?tier:2,strong});sound("flip");
    wait(battleTiming.attackImpact-300,()=>setAttack(side));
    wait(battleTiming.attackImpact,()=>{
      setCue(undefined);setAttack(undefined);
      const amount=side==="player"?practiceDamage(unit,strong):20+Math.min(current.current.turn,3)*5;
      const next=applyHit(side,amount);
      wait(battleTiming.attackRecover,()=>{
        if(next.winner){finish(next.winner);return;}
        if(side==="player")opponentTurn();
        else{change(nextTurn(current.current));setBusy(false);locked.current=false;setBanner("Your turn");sound("turn");wait(battleTiming.turn,()=>setBanner(""));}
      });
    });
  }
  function opponentTurn(){
    if(current.current.winner)return;
    setBanner("Your opponent’s turn");sound("turn");
    wait(battleTiming.turn,()=>{setBanner("");animateAttack("opponent");});
  }
  function doAttack(strong=false){
    if(locked.current||phase!=="battle"||current.current.winner)return;
    if(strong&&current.current.player.active.energy<2)return;
    locked.current=true;setBusy(true);setChoices(false);
    if(strong){setCoin(true);sound("flip");wait(1100,()=>{setCoin(false);animateAttack("player",true);});}
    else animateAttack("player");
  }
  function energy(){
    if(locked.current||phase!=="battle"||current.current.energyUsed)return;
    locked.current=true;setBusy(true);burst("energy","player");sound("turn");
    wait(battleTiming.energy,()=>{change(attachEnergy(current.current));setBusy(false);locked.current=false;note(`Attached an Energy to ${cardById(current.current.player.active.id).name}.`);});
  }
  function switchCard(index:number){
    if(phase!=="battle"||locked.current){if(!busy)setInspect([state.player.bench[index].id]);return;}
    locked.current=true;setBusy(true);setSwapping(true);sound("flip");
    wait(battleTiming.swap/2,()=>{change(swapActive(current.current,index));note(`${cardById(current.current.player.active.id).name} takes the active spot.`);});
    wait(battleTiming.swap,()=>{setSwapping(false);setBusy(false);locked.current=false;});
  }
  const deck=decks[tier],inBattle=phase==="battle";
  const menu=phase==="ready"?<div className="arena-page game-fullscreen game-menu">
    {started===false&&<StartScreen onStart={()=>{try{sessionStorage.setItem(STARTED_KEY,"1");}catch{}setStarted(true);goFullscreen();sound("rare");}}/>}
    {started!==null&&<MainMenu tier={tier} onTier={(t)=>reset(t)} onBattle={()=>begin(0)} audio={audio} onAudio={()=>{setAudio(!audio);enableSound(!audio);}}/>}
  </div>:null;
  if(menu)return menu;
  return <div className={`arena-page ${focused?"arena-focused":""} game-fullscreen`}>
    <section className="arena-heading"><div><div className="eyebrow"><span className="live-dot"/>THE ARENA</div><h1>Every card. <span>A new possibility.</span></h1><p>Know your deck. Make your move. Be the last one standing.</p></div><div className="arena-heading-actions"><span className="local-badge">Local practice</span><button className="round-button" aria-label={focused?"Exit focused view":"Focus arena"} onClick={()=>setFocused(!focused)}>{focused?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button><button className="round-button" aria-label={audio?"Mute sound":"Enable sound"} onClick={()=>{setAudio(!audio);enableSound(!audio);}}>{audio?<Volume2 size={18}/>:<VolumeX size={18}/>}</button></div></section>
    <div className="arena-layout">
      <aside className="deck-sidebar"><div className="sidebar-label"><span>YOUR DECK</span><span>01 / 03</span></div><div className="tier-tabs">{decks.map((d,i)=><button key={d.name} disabled={phase!=="ready"} className={i===tier?"selected":""} onClick={()=>reset(i)}>{d.name}</button>)}</div>
        <div className="deck-art-fan">{[deck.cards[1],deck.cards[0],deck.cards[2]].map((id,i)=><img key={id} src={cardById(id).src} alt={cardById(id).name} style={{"--fan-index":i} as React.CSSProperties}/>)}</div>
        <div className="deck-description"><span className="deck-type"><Shield size={14}/>{deck.name.toUpperCase()} CLASS</span><h2>{deck.subtitle}</h2><p>Eight cards. A world of possibilities.</p></div>
        <button className="subtle-button full-width" onClick={()=>setInspect([...deck.cards])}><Eye size={16}/>Explore your cards<ArrowUpRight size={15}/></button>
        <div className="deck-stat-row"><div><strong>08</strong><span>CARDS</span></div><div><strong>03</strong><span>TO WIN</span></div><div><strong>∞</strong><span>POSSIBILITIES</span></div></div>
        <div className="tournament-mini"><div className="sidebar-label"><span><Trophy size={13}/>BATTLE ROYALE</span><span>8 PLAYERS</span></div>{rounds.map((r,i)=><div className={`bracket-round ${i===round?"current":""} ${i<round?"complete":""}`} key={r}><span>{i<round?"✓":`0${i+1}`}</span><div><b>{r}</b><small>{i<round?"Qualified":i===round?`You vs ${rivals[i]}`:"Awaiting your victory"}</small></div>{i===round&&<ChevronRight size={15}/>}</div>)}</div>
        <p className="practice-note">Practice bracket with computer opponents. No tokens or yield are staked.</p>
      </aside>
      <section className="arena-center"><div className="match-toolbar"><span><Swords size={14}/>{rounds[round]}</span><span className="match-status"><i/>{phase==="ready"?"READY TO PLAY":inBattle?busy?"RESOLVING MOVE":"YOUR TURN":phase==="result"?"MATCH COMPLETE":"YOUR LINEUP"}</span><button className="text-button" disabled={phase==="ready"} onClick={()=>setConfirmExit(true)} aria-label="Forfeit match"><Flag size={14}/></button><button className="text-button game-sound" aria-label={audio?"Mute sound":"Enable sound"} onClick={()=>{setAudio(!audio);enableSound(!audio);}}>{audio?<Volume2 size={15}/>:<VolumeX size={15}/>}</button></div>
        <div className="board-surround"><BattleBoard state={state} tier={tier} opponentName={rivals[round]} phase={phase} onInspect={setInspect} onBench={switchCard} onActive={()=>{if(inBattle&&!busy)setChoices(true);else if(!busy)setInspect([state.player.active.id]);}} openingStage={openingStage} knockout={knockout} swapping={swapping} banner={banner} attack={attack} effect={effect}>
          {phase==="ready"&&<div className="ready-card"><div className="ready-icon"><Swords size={22}/></div><span className="eyebrow">THE NEXT CHAPTER IS YOURS</span><h2>Meet your match.</h2><p>Your deck is ready. Are you?</p><button className="primary-button" onClick={()=>begin(0)}>Enter battle<ArrowRight size={17}/></button><small>Preview your cards before every battle</small></div>}
          {phase==="opening"&&<BattleOpening opponent={rivals[round]} onDone={startBattle} onStage={setOpeningStage}/>}
          {cue&&<AttackCinematic cue={cue}/>}
          {choices&&<AttackChoices unit={state.player.active} tier={tier} onAttack={doAttack} onClose={()=>setChoices(false)} onInspect={()=>{setChoices(false);setInspect([state.player.active.id]);}}/>}
          {point&&<div className={`point-overlay ${point}`}><div className="point-medal"><Trophy size={28}/></div><h2>+1 point!</h2><div className="point-ribbon"/><p>{point==="player"?"YOU":rivals[round]}</p><div className="big-score">{[0,1,2].map(i=><span key={i} className={state[point].points>i?"won":""}>{i+1}</span>)}</div></div>}
          {coin&&<div className="coin-overlay"><div className="flip-coin"><Zap size={42}/></div><span>Power surge</span></div>}
          {phase==="result"&&<div className="result-overlay"><div className="result-glow"/><span className="eyebrow">{rounds[round]} COMPLETE</span><Trophy size={45}/><h2>{state.winner==="player"?round===2?"Champion!":"Victory!":"Well played."}</h2><p>{state.winner==="player"?round===2?"Three battles. One champion. You.":"One step closer to the crown.":"Every battle is a chance to grow."}</p><img src={cardById(state.player.active.id).src} alt={cardById(state.player.active.id).name}/><div className="result-score"><b>{state.player.points}</b><span>—</span><b>{state.opponent.points}</b></div><button className="primary-button" onClick={()=>state.winner==="player"&&round<2?begin(round+1):(reset(tier,0),setPhase("ready"))}>{state.winner==="player"&&round<2?"Next battle":"Back to arena"}<ArrowRight size={16}/></button></div>}
        </BattleBoard></div>
        <div className="battle-controls"><button className="energy-button" disabled={!inBattle||busy||state.energyUsed} onClick={energy}><Energy tier={tier}/><span>{state.energyUsed?"Energy attached":"Attach Energy"}</span></button><button className="attack-button" disabled={!inBattle||busy} onClick={()=>doAttack(false)}><Swords size={17}/><span>Attack</span><b>{practiceDamage(state.player.active,false)}</b></button><button className="power-button" disabled={!inBattle||busy||state.player.active.energy<2} onClick={()=>doAttack(true)} aria-label="Power attack"><Zap size={18}/></button></div>
      </section>
      <aside className="activity-sidebar"><div className="sidebar-label"><span>MATCH JOURNAL</span><span className="journal-dot"/></div><div className="journal-head"><span className="journal-icon"><Swords size={18}/></span><div><b>A story in every turn.</b><small>{inBattle?`Turn ${state.turn} in progress`:"Your next story starts here"}</small></div></div><div className="journal" aria-live="polite">{logs.length===0?<div className="journal-empty"><div className="journal-line"/><p>The arena is quiet.<br/>Make the first move.</p></div>:logs.slice(-7).map((l,i)=><div className={`journal-entry ${l.kind}`} key={`${logs.length}-${i}`}><i>{l.kind==="point"?<Trophy size={12}/>:l.kind==="attack"?<Swords size={12}/>:<Sparkles size={12}/>}</i><p>{l.text}</p></div>)}</div>
        <div className="tip-card"><Leaf size={20}/><span className="eyebrow">A LITTLE STRATEGY</span><h3>Small moves.<br/>Big possibilities.</h3><p>Attach Energy to strengthen your attacks. Switch in a fresh card when your active Pokémon needs a break.</p></div>
        <Link className="pack-promo" href="/packs"><div><Sparkles size={15}/><span>A little surprise awaits.</span><b>Explore booster packs <ArrowUpRight size={14}/></b></div><img src="/cards/pack-balanced.svg" alt="Balanced booster pack"/></Link>
        <Link href="/arena" className="chain-link">Open onchain challenges<ArrowUpRight size={13}/></Link>
      </aside>
    </div>
    <div className="mobile-deck-select">{decks.map((d,i)=><button key={d.name} disabled={phase!=="ready"} className={tier===i?"selected":""} onClick={()=>reset(i)}>{d.name}</button>)}</div>
    {phase==="intro"&&<CardTheater key={`${tier}-${round}`} ids={[...deck.cards]} onDone={enter}/>}
    {inspect&&<CardTheater ids={inspect} title="A closer look" inspection onDone={()=>setInspect(null)}/>}
    {confirmExit&&<div className="modal-backdrop"><section className="confirmation" role="dialog" aria-modal="true" aria-label="Forfeit match"><button className="round-button dismiss" onClick={()=>setConfirmExit(false)} aria-label="Close"><X size={18}/></button><Flag size={28}/><h2>Forfeit this match?</h2><p>Quitting counts as a loss. Your opponent wins this round.</p><button className="primary-button" onClick={()=>{clear();setConfirmExit(false);setChoices(false);setCue(undefined);change({...current.current,winner:"opponent"});note("You forfeited. The match goes to your opponent.","point");finish("opponent");}}>Forfeit and lose</button><button className="subtle-button" onClick={()=>setConfirmExit(false)}>Keep playing</button></section></div>}
  </div>;
}
