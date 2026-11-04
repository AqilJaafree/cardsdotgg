"use client";
import type { PointerEvent, ReactNode } from "react";

/** Wraps a card image with a pointer-driven foil: rares get a holofoil art window, non-rares a reverse holo (foil everywhere but the art). */
export default function HoloCard({ rarity, children, className = "" }: { rarity: string; children: ReactNode; className?: string }) {
  const kind = rarity === "Holo Rare" || rarity === "Rare" ? "holo-rare" : "holo-reverse";
  function move(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    const s = e.currentTarget.style;
    s.setProperty("--mx", `${x * 100}%`);
    s.setProperty("--my", `${y * 100}%`);
    s.setProperty("--rx", `${(0.5 - y) * 14}deg`);
    s.setProperty("--ry", `${(x - 0.5) * 18}deg`);
    s.setProperty("--hyp", `${Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 2)}`);
    s.setProperty("--foil-opacity", "1");
  }
  function leave(e: PointerEvent<HTMLDivElement>) {
    const s = e.currentTarget.style;
    ["--mx", "--my", "--rx", "--ry", "--hyp", "--foil-opacity"].forEach((p) => s.removeProperty(p));
  }
  return (
    <div className={`holo-card ${kind} ${className}`} onPointerMove={move} onPointerLeave={leave}>
      {children}
      <span className="holo-foil" aria-hidden />
      <span className="holo-glare" aria-hidden />
    </div>
  );
}
