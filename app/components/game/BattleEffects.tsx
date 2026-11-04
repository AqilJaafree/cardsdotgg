"use client";
import { useEffect, useRef } from "react";
export type EffectEvent = { id: number; kind: "hit" | "heal" | "victory" | "energy"; target: "player" | "opponent"; amount?: number; color?: number };

/** Phaser owns only the transparent effects layer. React owns accessible cards and controls. */
export default function BattleEffects({ event }: { event?: EffectEvent }) {
  const host = useRef<HTMLDivElement>(null), dispatch = useRef<((event:EffectEvent)=>void)|null>(null);
  useEffect(() => {
    let cancelled=false; let game: import("phaser").Game | undefined;
    import("phaser").then(({default:Phaser})=>{
      if(cancelled||!host.current)return;
      class Effects extends Phaser.Scene {
        create(){
          dispatch.current=(e:EffectEvent)=>{
            const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
            const x=210,y=e.target==="opponent"?242:415;
            const color=e.color??(e.kind==="heal"?0x66daa5:0xffd67e);
            if(e.kind==="energy"){
              const orb=this.add.circle(370,620,13,0x78efaa,.95).setStrokeStyle(3,0xffffff);
              const glow=this.add.circle(370,620,20,0x63ffbd,.3);
              this.tweens.add({targets:[orb,glow],x,y,duration:reduced?1:600,ease:"Cubic.easeInOut",onComplete:()=>{orb.destroy();glow.destroy();}});
            }
            if(e.kind==="hit"){
              const ring=this.add.circle(x,y,10,color,.1).setStrokeStyle(5,color,.9);
              this.tweens.add({targets:ring,scale:reduced?2:8,alpha:0,duration:550,onComplete:()=>ring.destroy()});
              const flash=this.add.star(x,y,8,14,65,0xffffff,.9);
              this.tweens.add({targets:flash,scale:1.6,angle:35,alpha:0,duration:300,onComplete:()=>flash.destroy()});
              if(!reduced){
                this.cameras.main.shake(180,.006);
                for(let j=0;j<10;j++){
                  const ray=this.add.rectangle(x,y,3,28,0xfff4b4).setRotation(j*Math.PI/5);
                  this.tweens.add({targets:ray,x:x+Math.sin(j*Math.PI/5)*95,y:y+Math.cos(j*Math.PI/5)*95,alpha:0,scaleY:.1,duration:340,onComplete:()=>ray.destroy()});
                }
              }
              const number=this.add.text(x,y,String(e.amount??0),{fontFamily:"Arial",fontSize:"40px",fontStyle:"bold",color:"#ffffff",stroke:"#253e56",strokeThickness:5}).setOrigin(.5);
              this.tweens.add({targets:number,y:y-64,alpha:0,delay:300,duration:750,ease:"Cubic.easeOut",onComplete:()=>number.destroy()});
            }
            const count=reduced?5:e.kind==="victory"?95:30;
            for(let i=0;i<count;i++){
              const confetti=e.kind==="victory";
              const particle=confetti?this.add.rectangle(Math.random()*420,-15,4+Math.random()*5,10,[0x6cd8bd,0xefd782,0x9fbaf1,0xffffff][i%4]):this.add.circle(x,y,1+Math.random()*3,color);
              const angle=Math.random()*Math.PI*2,radius=35+Math.random()*110;
              this.tweens.add({targets:particle,x:confetti?particle.x+(Math.random()-.5)*100:x+Math.cos(angle)*radius,y:confetti?740:y+Math.sin(angle)*radius,alpha:0,angle:Math.random()*540,duration:confetti?1800+Math.random()*1600:500+Math.random()*500,delay:confetti?i*12:0,ease:"Cubic.easeOut",onComplete:()=>particle.destroy()});
            }
          };
        }
      }
      game=new Phaser.Game({type:Phaser.AUTO,parent:host.current,width:420,height:720,transparent:true,banner:false,audio:{noAudio:true},render:{antialias:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Effects});
    }).catch(()=>{/* CSS effects and battle actions remain available without WebGL. */});
    return()=>{cancelled=true;dispatch.current=null;game?.destroy(true);};
  },[]);
  useEffect(()=>{if(event)dispatch.current?.(event);},[event]);
  return <div ref={host} className="battle-effects" aria-hidden="true"/>;
}
