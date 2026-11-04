"use client";
import Link from "next/link";
import { ArrowRight, Layers, Package, Swords, Trophy, Vault, Volume2, VolumeX } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cardById, decks } from "@/lib/game/catalog";
import HoloCard from "./HoloCard";

/** Title screen: shown once per browser session, then the menu takes over until the tab is closed. */
export function StartScreen({ onStart }: { onStart: () => void }) {
  const fan = [4, 2, 15, 10, 16];
  return (
    <button className="start-screen" onClick={onStart} aria-label="Tap to start">
      <div className="start-rays" aria-hidden />
      <div className="start-fan" aria-hidden>
        {fan.map((id, i) => (
          <div key={id} className="start-fan-card" style={{ "--i": i - 2 } as React.CSSProperties}>
            <HoloCard rarity="Holo Rare"><img src={cardById(id).src} alt="" draggable={false} /></HoloCard>
          </div>
        ))}
      </div>
      <div className="start-title">
        <span className="start-kicker">MONAD · TRADING CARD BATTLES</span>
        <h1>{BRAND}</h1>
        <p>Your yield is your deck.</p>
      </div>
      <span className="start-tap">Tap to start</span>
    </button>
  );
}

/** Main menu: pick a deck, then battle, go ranked onchain, or open the collection, packs and vault. */
export function MainMenu({ tier, onTier, onBattle, audio, onAudio }: { tier: number; onTier: (t: number) => void; onBattle: () => void; audio: boolean; onAudio: () => void }) {
  const deck = decks[tier];
  return (
    <div className="main-menu">
      <header className="menu-top">
        <span className="menu-brand">{BRAND}</span>
        <button className="menu-icon" onClick={onAudio} aria-label={audio ? "Mute sound" : "Enable sound"}>{audio ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      </header>

      <section className="menu-deck">
        <span className="menu-label">CHOOSE YOUR DECK</span>
        <div className="menu-deck-fan">
          {[deck.cards[1], deck.cards[0], deck.cards[2]].map((id, i) => (
            <div key={id} className="menu-deck-card" style={{ "--i": i - 1 } as React.CSSProperties}>
              <HoloCard rarity={cardById(id).rarity}><img src={cardById(id).src} alt={cardById(id).name} draggable={false} /></HoloCard>
            </div>
          ))}
        </div>
        <div className="menu-tiers">
          {decks.map((d, i) => (
            <button key={d.name} className={i === tier ? "on" : ""} style={{ "--tier": d.color } as React.CSSProperties} onClick={() => onTier(i)}>
              <b>{d.name}</b><small>{d.subtitle}</small>
            </button>
          ))}
        </div>
      </section>

      <nav className="menu-actions">
        <button className="menu-play" onClick={onBattle}><Swords size={22} /><span><b>Battle</b><small>Practice bracket · 3 rounds</small></span><ArrowRight size={20} /></button>
        <Link className="menu-tile ranked" href="/arena"><Trophy size={20} /><b>Ranked</b><small>Onchain · stake yield</small></Link>
        <Link className="menu-tile" href="/collection"><Layers size={20} /><b>Collection</b><small>Your cards</small></Link>
        <Link className="menu-tile" href="/packs"><Package size={20} /><b>Packs</b><small>Open a pack</small></Link>
        <Link className="menu-tile" href="/decks"><Vault size={20} /><b>Vault</b><small>Deposit · decks</small></Link>
      </nav>
    </div>
  );
}
