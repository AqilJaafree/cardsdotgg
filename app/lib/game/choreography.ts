/** Millisecond beats measured against the supplied gameplay reference. */
export const battleTiming = {
  versus: 2300,
  openingCoin: 1900,
  deal: 1300,
  turn: 1600,
  attackImpact: 1200,
  attackRecover: 2500,
  knockout: 850,
  pointStart: 1050,
  pointEnd: 2350,
  energy: 650,
  swap: 700,
} as const;

const moves: Record<number, string> = {
  1: "Confuse Ray", 2: "Hydro Pump", 3: "Double-edge", 4: "Fire Spin",
  5: "Metronome", 6: "Dragon Rage", 7: "Thunderpunch", 8: "Jab",
  9: "Thunder Wave", 10: "Psychic", 11: "Water Gun", 12: "Agility",
  13: "Water Gun", 14: "Thunder", 15: "Solar Beam", 16: "Whirlwind",
  17: "Twineedle", 20: "Scrunch", 21: "Selfdestruct", 22: "Foul Gas",
  27: "Meditate", 30: "Vine Whip", 44: "Leech Seed", 58: "Thundershock",
};
export const moveName = (id: number) => moves[id] ?? "Tackle";
export type AttackCue = { id: number; cardId: number; side: "player" | "opponent"; tier: number; strong: boolean };
