"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {ArrowLeft,ArrowRight,ChevronLeft,ChevronRight,Gift,Layers,RotateCcw,Scissors,Sparkles,Volume2,VolumeX} from "lucide-react";
import {cardById,collectCards,decks,drawPack} from "@/lib/game/catalog";
import {enableSound,sound} from "@/lib/game/sound";
const PackScene=dynamic(()=>import("./PackScene"),{ssr:false});
const CardTheater=dynamic(()=>import("./CardTheater"),{ssr:false});
export default function PackRoom(){
  const [tier,setTier]=useState(0),[selected,setSelected]=useState(0),[phase,setPhase]=useState<"choose"|"sealed"|"opening"|"reveal"|"summary">("choose"),[pulled,setPulled]=useState<number[]>([]),[inspect,setInspect]=useState<number[]|null>(null),[audio,setAudio]=useState(false),[saveError,setSaveError]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>>(),opening=useRef(false),saved=useRef(false),swipe=useRef(0);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  function open(){if(opening.current||phase!=="sealed")return;opening.current=true;setPulled(drawPack());setPhase("opening");sound("pack");timer.current=setTimeout(()=>{setPhase("reveal");sound("rare");},1450);}
  function collect(){if(!saved.current){try{collectCards(pulled);saved.current=true;setSaveError(false);}catch{setSaveError(true);}}setPhase("summary");}
  function reset(){clearTimeout(timer.current);opening.current=false;saved.current=false;setPulled([]);setSaveError(false);setPhase("choose");}
  return <div className={`pack-room pack-phase-${phase}`}>
    <div className="pack-room-top"><Link className="back-link" href="/"><ArrowLeft size={16}/>Back to arena</Link><div className="arena-heading-actions"><span className="local-badge"><Gift size={13}/>Free reference pack</span><button className="round-button" aria-label={audio?"Mute sound":"Enable sound"} onClick={()=>{setAudio(!audio);enableSound(!audio);}}>{audio?<Volume2 size={17}/>:<VolumeX size={17}/>}</button></div></div>
    {phase!=="summary"&&phase!=="reveal"&&<><div className="pack-title"><span className="eyebrow"><Sparkles size={13}/>THE PACK ROOM</span><h1>{phase==="sealed"?"A little anticipation.":phase==="opening"?"Here comes the magic.":"What’s waiting inside?"}</h1><p>{phase==="sealed"?"Swipe across the seal. Your next discovery is just inside.":"Choose a pack. Break the seal. Find something wonderful."}</p></div>
      <div className="pack-type-tabs">{decks.map((d,i)=><button key={d.name} className={i===tier?"selected":""} disabled={phase!=="choose"} onClick={()=>{setTier(i);sound("flip");}}><span style={{background:d.color}}/>{d.name}</button>)}</div>
      <div className="pack-stage"><div className="pack-halo"/><PackScene tier={tier} phase={phase==="choose"?"choose":phase==="sealed"?"sealed":"opening"} selected={selected} onSelect={(id)=>{setSelected(id);sound("flip");}}/>
        {phase==="sealed"&&<div className="rip-guide" onPointerDown={e=>{swipe.current=e.clientX;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={e=>{if(Math.abs(e.clientX-swipe.current)>55)open();}}><span/><Scissors size={21}/><span/><small>SWIPE TO OPEN</small></div>}
        {phase==="opening"&&<div className="pack-open-flash"/>}
      </div>
      <div className="pack-actions">{phase==="choose"?<><div className="pack-picker"><button className="round-button" aria-label="Previous pack" onClick={()=>setSelected((selected+9)%10)}><ChevronLeft size={19}/></button><span>PACK <b>{String(selected+1).padStart(2,"0")}</b><i>/ 10</i></span><button className="round-button" aria-label="Next pack" onClick={()=>setSelected((selected+1)%10)}><ChevronRight size={19}/></button></div><button className="primary-button" onClick={()=>{setPhase("sealed");sound("flip");}}>This one feels lucky<ArrowRight size={17}/></button><small>Drag to explore · 5 cards in every pack</small></>:phase==="sealed"?<><button className="primary-button" onClick={open}><Scissors size={17}/>Open this pack</button><button className="text-button" onClick={()=>setPhase("choose")}>Choose a different pack</button></>:<span className="opening-copy">A new chapter is unfolding…</span>}</div>
      <p className="pack-disclaimer">A separate collecting experience. Free local packs; cards are saved in this browser.</p>
    </>}
    {phase==="reveal"&&<CardTheater ids={pulled} title="Your new discoveries" pack onDone={collect}/>}
    {phase==="summary"&&<section className="pack-summary"><div className="summary-mark"><Sparkles size={28}/></div><span className="eyebrow">FIVE NEW POSSIBILITIES</span><h1>A lovely little haul.</h1><p>{saveError?"Browser storage is unavailable. You can still inspect these cards.":"Your new cards have been added to your local collection."}</p><div className="pack-results">{pulled.map((id,i)=>{const card=cardById(id);return <button className={`result-card ${card.rarity==="Holo Rare"?"holo":""}`} key={i} style={{animationDelay:`${i*130}ms`}} onClick={()=>setInspect([id])}><img src={card.src} alt={card.name}/><b>{card.name}</b><small>{card.rarity}</small></button>;})}</div><div className="summary-actions"><button className="primary-button" onClick={reset}><RotateCcw size={16}/>Open another pack</button><Link className="subtle-button" href="/collection"><Layers size={16}/>View collection<ArrowRight size={16}/></Link></div></section>}
    {inspect&&<CardTheater ids={inspect} title="Your discovery" inspection onDone={()=>setInspect(null)}/>}
  </div>;
}
