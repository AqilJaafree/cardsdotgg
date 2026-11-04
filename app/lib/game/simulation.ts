export type Fighter = { id: number; hp: number; maxHp: number; energy: number };
export type Side = { active: Fighter; bench: Fighter[]; hand: number[]; points: number };
export type BattleState = { player: Side; opponent: Side; turn: number; energyUsed: boolean; winner: "player" | "opponent" | null };
const printedHp: Record<number, number> = { 1:80, 2:100, 3:120, 4:120, 5:40, 6:100, 7:70, 8:100, 9:60, 10:60, 11:90, 12:80, 13:90, 14:80, 15:100, 16:90, 17:80, 20:70, 21:80, 22:80, 27:50, 30:60, 44:40, 58:40 };
export const fighter = (id: number): Fighter => ({ id, hp: printedHp[id] ?? 70, maxHp: printedHp[id] ?? 70, energy: 1 });
const makeSide = (ids: readonly number[]): Side => ({ active: fighter(ids[0]), bench: ids.slice(1,4).map(fighter), hand: ids.slice(4), points: 0 });
export function newBattle(player: readonly number[], opponent: readonly number[]): BattleState {
  return { player: makeSide(player), opponent: makeSide(opponent), turn: 1, energyUsed: false, winner: null };
}
export function attachEnergy(state: BattleState): BattleState {
  if (state.winner || state.energyUsed) return state;
  return { ...state, energyUsed: true, player: { ...state.player, active: { ...state.player.active, energy: Math.min(5, state.player.active.energy + 1) } } };
}
export function swapActive(state: BattleState, index: number): BattleState {
  if (state.winner || !state.player.bench[index]) return state;
  const bench = [...state.player.bench];
  const active = bench[index]; bench[index] = state.player.active;
  return { ...state, player: { ...state.player, active, bench } };
}
export function hit(state: BattleState, attacker: "player" | "opponent", amount: number): BattleState {
  if (state.winner) return state;
  const defender = attacker === "player" ? "opponent" : "player";
  const next = structuredClone(state);
  const target = next[defender];
  target.active.hp = Math.max(0, target.active.hp - Math.max(0, amount));
  if (!target.active.hp) {
    next[attacker].points++;
    if (next[attacker].points >= 3 || (!target.bench.length && !target.hand.length)) next.winner = attacker;
    else {
      target.active = target.bench.shift() ?? fighter(target.hand.shift()!);
      if (target.hand.length) target.bench.push(fighter(target.hand.shift()!));
    }
  }
  return next;
}
export function nextTurn(state: BattleState): BattleState {
  if (state.winner) return state;
  return { ...state, turn: state.turn + 1, energyUsed: false };
}
export function practiceDamage(unit: Fighter, strong: boolean) { return (strong ? 30 : 20) + unit.energy * 10; }
