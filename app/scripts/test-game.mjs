import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import ts from "typescript";
import { test } from "node:test";

const code = ts.transpileModule(await readFile(new URL("../lib/game/simulation.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { newBattle, attachEnergy, swapActive, hit, nextTurn, practiceDamage } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const lineup = [15, 2, 1, 3, 13, 17, 30, 44];
const opponent = [4, 10, 12, 6, 8, 7, 5, 11];

test("energy can be attached once each turn, including after switching", () => {
  const initial = newBattle(lineup, opponent);
  const charged = attachEnergy(initial);
  assert.equal(charged.player.active.energy, 2);
  assert.equal(initial.player.active.energy, 1);
  assert.equal(attachEnergy(charged), charged);
  const switched = swapActive(charged, 0);
  assert.equal(attachEnergy(switched), switched);
  assert.equal(switched.player.bench[0].energy, 2);
  assert.equal(attachEnergy(nextTurn(switched)).player.active.energy, 2);
});

test("knockout awards one point, promotes a reserve and refills its bench", () => {
  const initial = newBattle(lineup, opponent);
  const snapshot = JSON.stringify(initial);
  const after = hit(initial, "player", 120);
  assert.equal(JSON.stringify(initial), snapshot);
  assert.equal(after.player.points, 1);
  assert.equal(after.opponent.active.id, 10);
  assert.deepEqual(after.opponent.bench.map(card => card.id), [12, 6, 8]);
  assert.deepEqual(after.opponent.hand, [7, 5, 11]);
  assert.equal(after.winner, null);
});

test("three knockouts end the match and freeze further game actions", () => {
  let battle = newBattle(lineup, opponent);
  for (let i = 0; i < 3; i++) battle = hit(battle, "player", 200);
  assert.equal(battle.winner, "player");
  assert.equal(battle.player.points, 3);
  assert.equal(hit(battle, "opponent", 200), battle);
  assert.equal(attachEnergy(battle), battle);
  assert.equal(swapActive(battle, 0), battle);
  assert.equal(nextTurn(battle), battle);
});

test("computer knockouts and damage use the correct side", () => {
  const initial = newBattle(lineup, opponent);
  const after = hit(initial, "opponent", 100);
  assert.equal(after.opponent.points, 1);
  assert.equal(after.player.points, 0);
  assert.equal(after.player.active.id, 2);
  assert.equal(after.opponent.active.hp, 120);
  assert.equal(practiceDamage(attachEnergy(initial).player.active, true), 50);
});

test("invalid bench selections and negative damage do not corrupt state", () => {
  const initial = newBattle(lineup, opponent);
  assert.equal(swapActive(initial, 99), initial);
  assert.deepEqual(hit(initial, "player", -10), initial);
});

test("all 102 reference images and the deck wrappers are available locally", async () => {
  const catalog = JSON.parse(await readFile(new URL("../lib/game/card-catalog.json", import.meta.url), "utf8"));
  assert.equal(catalog.length, 102);
  assert.equal(new Set(catalog.map(card => card.id)).size, 102);
  for (const card of catalog) await access(new URL(`../public${card.src}`, import.meta.url));
  for (const file of ["back.svg", "pack-guardian.svg", "pack-balanced.svg", "pack-degen.svg"])
    await access(new URL(`../public/cards/${file}`, import.meta.url));
});
