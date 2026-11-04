"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Maximize2, Trophy, Vault, Volume2, VolumeX } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cardById, decks } from "@/lib/game/catalog";
import HoloCard from "./HoloCard";

const FONT = "https://fonts.googleapis.com/css2?family=Lilita+One&display=swap";

/** Chunky two-line game logo: "CARDS" over "DOT GG". */
function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`cm-logo ${small ? "small" : ""}`} aria-label={BRAND}>
      <span className="cm-logo-top">CARDS</span>
      <span className="cm-logo-bottom">DOT<i>GG</i></span>
    </div>
  );
}

/** Title screen: shown once per browser session, then the menu takes over until the tab is closed. */
export function StartScreen({ onStart }: { onStart: () => void }) {
  const fan = [4, 2, 15, 10, 16];
  return (
    <button className="start-screen" onClick={onStart} aria-label="Tap to start">
      <link rel="stylesheet" href={FONT} />
      <div className="start-rays" aria-hidden />
      <div className="start-fan" aria-hidden>
        {fan.map((id, i) => (
          <div key={id} className="start-fan-card" style={{ "--i": i - 2 } as React.CSSProperties}>
            <HoloCard rarity="Holo Rare"><img src={cardById(id).src} alt="" draggable={false} /></HoloCard>
          </div>
        ))}
      </div>
      <Logo />
      <span className="start-tap">Tap to start</span>
    </button>
  );
}

/** Main menu in the style of a casual mobile game: logo, a stack of chunky buttons, a row of square icon buttons. */
export function MainMenu({ tier, onTier, onBattle, audio, onAudio }: { tier: number; onTier: (t: number) => void; onBattle: () => void; audio: boolean; onAudio: () => void }) {
  const deck = decks[tier];
  const step = (d: number) => onTier((tier + d + decks.length) % decks.length);
  function fullscreen() {
    try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch {}
  }
  return (
    <div className="cm-menu">
      <link rel="stylesheet" href={FONT} />
      <Logo />

      <div className="cm-deck">
        <div className="cm-fan">
          {[deck.cards[1], deck.cards[0], deck.cards[2]].map((id, i) => (
            <div key={id} className="cm-fan-card" style={{ "--i": i - 1 } as React.CSSProperties}>
              <HoloCard rarity={cardById(id).rarity}><img src={cardById(id).src} alt={cardById(id).name} draggable={false} /></HoloCard>
            </div>
          ))}
        </div>
        <div className="cm-picker" style={{ "--tier": deck.color } as React.CSSProperties}>
          <button onClick={() => step(-1)} aria-label="Previous deck"><ChevronLeft size={22} strokeWidth={3} /></button>
          <span><small>DECK</small>{deck.name.toUpperCase()}</span>
          <button onClick={() => step(1)} aria-label="Next deck"><ChevronRight size={22} strokeWidth={3} /></button>
        </div>
      </div>

      <nav className="cm-buttons">
        <button className="cm-btn cm-play" onClick={onBattle}>BATTLE</button>
        <Link className="cm-btn cm-ranked" href="/arena">RANKED</Link>
        <Link className="cm-btn cm-packs" href="/packs">PACKS</Link>
        <Link className="cm-btn cm-collection" href="/collection">COLLECTION</Link>
      </nav>

      <div className="cm-icons">
        <Link className="cm-square" href="/decks" aria-label="Vault"><Vault size={24} strokeWidth={2.5} /></Link>
        <Link className="cm-square" href="/arena" aria-label="Ladder"><Trophy size={24} strokeWidth={2.5} /></Link>
        <button className="cm-square" onClick={fullscreen} aria-label="Fullscreen"><Maximize2 size={24} strokeWidth={2.5} /></button>
        <button className="cm-square" onClick={onAudio} aria-label={audio ? "Mute sound" : "Enable sound"}>{audio ? <Volume2 size={24} strokeWidth={2.5} /> : <VolumeX size={24} strokeWidth={2.5} />}</button>
      </div>
    </div>
  );
}
