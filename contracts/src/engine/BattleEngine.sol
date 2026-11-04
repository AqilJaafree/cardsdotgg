// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Action} from "@shared/Types.sol";
import {IBattleEngine} from "@shared/IBattleEngine.sol";
import {CardData} from "./CardData.sol";

/// Pure, deterministic auto-battle. Rules: cardsdotgg.md "Battle engine" plus shared/engine-rules.md.
contract BattleEngine is IBattleEngine {
    uint8 internal constant NONE = 255;
    uint256 internal constant LOG_CAP = 700; // 15 rounds x (6 acts x up to 6 entries + 8 heals and swaps) is lower

    uint8 internal constant PEGSHELL = 0;
    uint8 internal constant SENTINEL = 1;
    uint8 internal constant TORTOISE = 2;
    uint8 internal constant OWL = 3;
    uint8 internal constant GOLEM = 4;
    uint8 internal constant SPRITE = 5;
    uint8 internal constant CRAB = 6;
    uint8 internal constant BISON = 7;
    uint8 internal constant LYNX = 8;
    uint8 internal constant HERON = 9;
    uint8 internal constant RAM = 10;
    uint8 internal constant FOX = 11;
    uint8 internal constant BEAR = 12;
    uint8 internal constant BEETLE = 13;
    uint8 internal constant KESTREL = 14;
    uint8 internal constant SERPENT = 15;
    uint8 internal constant RAPTOR = 16;
    uint8 internal constant WOLF = 17;
    uint8 internal constant WASP = 18;
    uint8 internal constant KRAKEN = 19;
    uint8 internal constant PANTHER = 20;
    uint8 internal constant COMET = 21;
    uint8 internal constant MANTIS = 22;
    uint8 internal constant HYDRA = 23;

    struct Card {
        uint8 id;
        uint32 hp;
        uint32 maxHp;
        uint32 atk;
        uint32 def;
        uint32 spd;
        uint32 atkBonus; // Accrue
        uint32 defBps; // Safe Haven
        uint32 critBonus; // Open Interest
        uint8 widen; // rounds left of Widen
        bool halved; // next heal is halved
        bool shieldUsed; // Peg Shield, resets each round
        bool used; // the card's once-per-match ability
    }

    struct Side {
        Card[8] cards;
        uint8[3] active; // card index per slot, NONE if empty
        uint8[5] bench; // card index in bench order, NONE if used
        uint8 tier;
    }

    struct Ctx {
        Side[2] sides;
        bytes32 seed;
        uint256 ctr;
        uint8 round;
        bool logging;
        Action[] log;
        uint256 n;
        bool done;
        uint8 winner;
    }

    struct Turn {
        uint8 side;
        uint8 slot;
        uint8 idx;
        bool first; // Full Send
        uint32 spd;
    }

    struct Hit {
        uint32 damage;
        uint32 selfDamage;
        bool crit;
        bool dodged;
    }

    function simulate(bytes32 seed, uint8 tierA, uint8 tierB)
        external
        pure
        returns (uint8 winnerSide, uint8 rounds, uint16 hpShareA, uint16 hpShareB)
    {
        Ctx memory c = _run(seed, tierA, tierB, false);
        return (c.winner, c.round, _share(c.sides[0]), _share(c.sides[1]));
    }

    function simulateWithLog(bytes32 seed, uint8 tierA, uint8 tierB) external pure returns (Action[] memory log) {
        Ctx memory c = _run(seed, tierA, tierB, true);
        log = c.log;
        uint256 n = c.n;
        assembly ("memory-safe") {
            mstore(log, n)
        }
    }

    /// Damage base from the spec formula: floor(ATK x 1000 / (50 + DEF)).
    function baseDamage(uint256 atkEff, uint256 defEff) public pure returns (uint256) {
        return (atkEff * 1000) / (50 + defEff);
    }

    function _run(bytes32 seed, uint8 tierA, uint8 tierB, bool logging) internal pure returns (Ctx memory c) {
        require(tierA < 3 && tierB < 3, "tier");
        c.seed = seed;
        c.logging = logging;
        if (logging) c.log = new Action[](LOG_CAP);
        _init(c.sides[0], tierA);
        _init(c.sides[1], tierB);
        for (uint8 r = 1; r <= 15; r++) {
            c.round = r;
            _playRound(c);
            if (c.done) return c;
        }
        uint16 a = _share(c.sides[0]);
        uint16 b = _share(c.sides[1]);
        c.winner = a > b ? 0 : b > a ? 1 : 2;
    }

    function _init(Side memory s, uint8 tier) internal pure {
        s.tier = tier;
        for (uint8 i = 0; i < 8; i++) {
            uint8 id = tier * 8 + i;
            (uint8 hp, uint8 atk, uint8 def, uint8 spd) = CardData.stats(id);
            Card memory k = s.cards[i];
            k.id = id;
            k.maxHp = uint32(hp) * 50;
            k.hp = k.maxHp;
            k.atk = atk;
            k.def = def;
            k.spd = spd;
            if (i < 3) s.active[i] = i;
            else s.bench[i - 3] = i;
        }
    }

    function _roll(Ctx memory c, uint256 n) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(c.seed, c.ctr++))) % n;
    }

    function _playRound(Ctx memory c) internal pure {
        for (uint256 s = 0; s < 2; s++) {
            for (uint256 i = 0; i < 8; i++) c.sides[s].cards[i].shieldUsed = false;
        }
        uint8 tie = uint8(_roll(c, 2));
        (Turn[6] memory order, uint256 count) = _order(c, tie);
        for (uint256 i = 0; i < count; i++) {
            Turn memory t = order[i];
            Side memory s = c.sides[t.side];
            if (s.active[t.slot] != t.idx || s.cards[t.idx].hp == 0) continue; // E3
            _act(c, t);
            if (c.done) return;
        }
        _endOfRound(c);
    }

    function _order(Ctx memory c, uint8 tie) internal pure returns (Turn[6] memory order, uint256 count) {
        for (uint8 side = 0; side < 2; side++) {
            Side memory s = c.sides[side];
            Side memory e = c.sides[1 - side];
            for (uint8 slot = 0; slot < 3; slot++) {
                uint8 idx = s.active[slot];
                if (idx == NONE) continue;
                Card memory k = s.cards[idx];
                Turn memory t = Turn(side, slot, idx, k.id == COMET, _effSpd(k, e));
                uint256 j = count++;
                while (j > 0 && _before(t, order[j - 1], tie)) {
                    order[j] = order[j - 1];
                    j--;
                }
                order[j] = t;
            }
        }
    }

    function _effSpd(Card memory k, Side memory enemy) internal pure returns (uint32 spd) {
        spd = k.spd;
        if (k.id != KESTREL) return spd;
        for (uint256 i = 0; i < 3; i++) {
            uint8 idx = enemy.active[i];
            if (idx != NONE && enemy.cards[idx].spd > spd) spd = enemy.cards[idx].spd; // E10
        }
    }

    function _before(Turn memory a, Turn memory b, uint8 tie) internal pure returns (bool) {
        if (a.first != b.first) return a.first;
        if (a.spd != b.spd) return a.spd > b.spd;
        if (a.side != b.side) return a.side == tie;
        return a.slot < b.slot;
    }

    function _act(Ctx memory c, Turn memory t) internal pure {
        Side memory s = c.sides[t.side];
        Side memory e = c.sides[1 - t.side];
        Card memory a = s.cards[t.idx];
        uint256 hits = a.id == KRAKEN ? 2 : 1;
        for (uint256 h = 0; h < hits; h++) {
            if (a.hp == 0) return;
            uint8 targetSlot = _target(e, t.slot); // E11: a second Loop hit retargets
            if (targetSlot == NONE) return;
            _hit(c, t, targetSlot);
            if (c.done) return;
        }
    }

    function _target(Side memory e, uint8 slot) internal pure returns (uint8 best) {
        if (e.active[slot] != NONE) return slot;
        best = NONE;
        uint32 low = type(uint32).max;
        for (uint8 i = 0; i < 3; i++) {
            uint8 idx = e.active[i];
            if (idx != NONE && e.cards[idx].hp < low) {
                low = e.cards[idx].hp;
                best = i;
            }
        }
    }

    function _hit(Ctx memory c, Turn memory t, uint8 targetSlot) internal pure {
        Side memory s = c.sides[t.side];
        Side memory e = c.sides[1 - t.side];
        Card memory a = s.cards[t.idx];
        uint8 targetIdx = e.active[targetSlot];
        Card memory d = e.cards[targetIdx];

        Hit memory h = _computeHit(c, s, e, a, d);
        _applyHit(a, d, h);

        if (c.logging) {
            Action memory x = c.log[c.n++];
            x.round = c.round;
            x.side = t.side;
            x.slot = t.slot;
            x.targetSlot = targetSlot;
            x.cardId = a.id;
            x.damage = h.damage;
            x.crit = h.crit;
            x.dodged = h.dodged;
            x.targetHpAfter = d.hp;
            x.selfHpAfter = a.hp;
            x.targetCardId = d.id;
        }

        if (d.hp == 0) _faint(c, 1 - t.side, targetSlot);
        if (a.hp == 0) _faint(c, t.side, t.slot);
        _checkDone(c);
    }

    function _computeHit(Ctx memory c, Side memory s, Side memory e, Card memory a, Card memory d)
        internal
        pure
        returns (Hit memory h)
    {
        uint256 atkEff = ((a.atk + a.atkBonus) * (10000 + (a.id == LYNX && c.round == 1 ? 1000 : 0))) / 10000; // E5
        uint256 defMod = 10000 + d.defBps;
        if (d.id == BEAR && d.hp * 2 < d.maxHp) defMod += 1500;
        if (d.widen > 0) defMod -= 1000;
        uint256 defEff = (d.def * defMod) / 10000;
        if (a.id == RAM && !a.used) {
            a.used = true;
            defEff /= 2;
        }

        uint256 dmg = (baseDamage(atkEff, defEff) * (90 + _roll(c, 21))) / 100;

        (uint256 critBps, uint256 critMul) = _crit(s.tier);
        if (_roll(c, 10000) < critBps + a.critBonus) {
            if (!_audit(e)) {
                h.crit = true;
                dmg = (dmg * critMul) / 100;
            }
        }

        if (a.id == KRAKEN) dmg = (dmg * 60) / 100;
        if (a.id == RAPTOR) {
            if (_roll(c, 100) < 60) {
                dmg *= 2;
            } else {
                dmg /= 2;
                h.selfDamage = a.maxHp / 10;
            }
        }

        if (d.id == MANTIS && _roll(c, 100) < 20) {
            h.dodged = true;
            return h;
        }
        if (d.id == PEGSHELL && !d.shieldUsed) {
            d.shieldUsed = true;
            return h;
        }
        if (d.id == TORTOISE) dmg = (dmg * 90) / 100;
        if (dmg == 0) dmg = 1;
        h.damage = uint32(dmg);
    }

    function _applyHit(Card memory a, Card memory d, Hit memory h) internal pure {
        uint32 dmg = h.damage;
        if (dmg > 0) {
            if (dmg >= d.hp) {
                if (d.id == BISON && !d.used) {
                    d.used = true;
                    d.hp = 1;
                } else {
                    d.hp = 0;
                }
            } else {
                d.hp -= dmg;
            }
            if (a.id == WOLF && d.hp * 5 < d.maxHp) d.hp = 0;
            if (d.id == CRAB) a.hp = _sub(a.hp, dmg / 10);
            if (a.id == WASP && a.hp > 0) _heal(a, (dmg * 30) / 100);
            if (a.id == SERPENT) d.widen = 2;
            if (a.id == HYDRA) d.halved = true;
        }
        if (h.selfDamage > 0) a.hp = _sub(a.hp, h.selfDamage);
    }

    function _audit(Side memory e) internal pure returns (bool) {
        for (uint256 i = 0; i < 3; i++) {
            uint8 idx = e.active[i];
            if (idx == NONE) continue;
            Card memory k = e.cards[idx];
            if (k.id == OWL && !k.used && k.hp > 0) {
                k.used = true;
                return true;
            }
        }
        return false;
    }

    function _crit(uint8 tier) internal pure returns (uint256 bps, uint256 mul) {
        if (tier == 0) return (500, 130);
        if (tier == 1) return (1200, 150);
        return (2500, 180);
    }

    function _sub(uint32 hp, uint32 amount) internal pure returns (uint32) {
        return amount >= hp ? 0 : hp - amount;
    }

    /// Returns HP actually restored. E6: caps at max, skips the fainted, Halving is used up by the next heal.
    function _heal(Card memory k, uint32 amount) internal pure returns (uint32 restored) {
        if (k.hp == 0 || amount == 0) return 0;
        if (k.halved) {
            k.halved = false;
            amount /= 2;
        }
        restored = amount > k.maxHp - k.hp ? k.maxHp - k.hp : amount;
        k.hp += restored;
    }

    function _faint(Ctx memory c, uint8 side, uint8 slot) internal pure {
        Side memory s = c.sides[side];
        uint8 gone = s.active[slot];
        for (uint256 i = 0; i < 8; i++) {
            Card memory k = s.cards[i];
            if (k.id == GOLEM && k.hp > 0 && i != gone && k.defBps < 3000) k.defBps += 1000;
        }
        (uint8 pos, uint8 next) = _firstBench(s);
        s.active[slot] = next;
        if (next == NONE) return;
        s.bench[pos] = NONE;
        _logMove(c, 3, side, slot, s.cards[next], s.cards[gone]);
    }

    function _firstBench(Side memory s) internal pure returns (uint8 pos, uint8 idx) {
        for (uint8 i = 0; i < 5; i++) {
            uint8 b = s.bench[i];
            if (b != NONE && s.cards[b].hp > 0) return (i, b);
        }
        return (NONE, NONE);
    }

    function _logMove(Ctx memory c, uint8 kind, uint8 side, uint8 slot, Card memory incoming, Card memory outgoing)
        internal
        pure
    {
        if (!c.logging) return;
        Action memory x = c.log[c.n++];
        x.round = c.round;
        x.side = side;
        x.slot = slot;
        x.targetSlot = slot;
        x.cardId = incoming.id;
        x.selfHpAfter = incoming.hp;
        x.targetHpAfter = outgoing.hp;
        x.kind = kind;
        x.targetCardId = outgoing.id;
    }

    function _checkDone(Ctx memory c) internal pure {
        bool aAlive = _alive(c.sides[0]);
        bool bAlive = _alive(c.sides[1]);
        if (aAlive && bAlive) return;
        c.done = true;
        c.winner = aAlive ? 0 : bAlive ? 1 : 2;
    }

    function _alive(Side memory s) internal pure returns (bool) {
        for (uint256 i = 0; i < 8; i++) {
            if (s.cards[i].hp > 0) return true;
        }
        return false;
    }

    function _endOfRound(Ctx memory c) internal pure {
        for (uint8 side = 0; side < 2; side++) _healStep(c, side);
        for (uint8 side = 0; side < 2; side++) _growthStep(c.sides[side]);
        for (uint8 side = 0; side < 2; side++) _swapStep(c, side);
        for (uint256 side = 0; side < 2; side++) {
            for (uint256 i = 0; i < 8; i++) {
                Card memory k = c.sides[side].cards[i];
                if (k.widen > 0) k.widen--;
            }
        }
    }

    function _healStep(Ctx memory c, uint8 side) internal pure {
        Side memory s = c.sides[side];
        for (uint8 slot = 0; slot < 3; slot++) {
            uint8 idx = s.active[slot];
            if (idx == NONE) continue;
            Card memory k = s.cards[idx];
            uint32 amount = k.id == SENTINEL ? k.maxHp / 20 : k.id == BEETLE ? (k.maxHp * 3) / 100 : 0;
            if (amount == 0) continue;
            uint32 restored = _heal(k, amount);
            if (c.logging && restored > 0) {
                Action memory x = c.log[c.n++];
                x.round = c.round;
                x.side = side;
                x.slot = slot;
                x.targetSlot = slot;
                x.cardId = k.id;
                x.damage = restored;
                x.targetHpAfter = k.hp;
                x.selfHpAfter = k.hp;
                x.kind = 1;
                x.targetCardId = k.id;
            }
        }
    }

    function _growthStep(Side memory s) internal pure {
        for (uint256 slot = 0; slot < 3; slot++) {
            uint8 idx = s.active[slot];
            if (idx == NONE) continue;
            Card memory k = s.cards[idx];
            if (k.id == HERON && k.atkBonus < 10) k.atkBonus += 2;
            if (k.id == PANTHER && k.critBonus < 2500) k.critBonus += 500;
        }
    }

    function _swapStep(Ctx memory c, uint8 side) internal pure {
        Side memory s = c.sides[side];
        for (uint8 slot = 0; slot < 3; slot++) {
            uint8 idx = s.active[slot];
            if (idx == NONE) continue;
            Card memory k = s.cards[idx];
            if (k.used) continue;
            if (k.id == SPRITE && k.hp * 10 < k.maxHp * 3) {
                if (_swap(c, side, slot)) k.used = true;
            } else if (k.id == FOX) {
                uint8 low = _lowestBelow40(s);
                if (low != NONE && _swap(c, side, low)) k.used = true;
            }
        }
    }

    function _lowestBelow40(Side memory s) internal pure returns (uint8 best) {
        best = NONE;
        uint32 low = type(uint32).max;
        for (uint8 i = 0; i < 3; i++) {
            uint8 idx = s.active[i];
            if (idx == NONE) continue;
            Card memory k = s.cards[idx];
            if (k.hp * 10 < k.maxHp * 4 && k.hp < low) {
                low = k.hp;
                best = i;
            }
        }
    }

    function _swap(Ctx memory c, uint8 side, uint8 slot) internal pure returns (bool) {
        Side memory s = c.sides[side];
        (uint8 pos, uint8 next) = _firstBench(s);
        if (next == NONE) return false;
        uint8 out = s.active[slot];
        s.active[slot] = next;
        s.bench[pos] = out;
        _logMove(c, 2, side, slot, s.cards[next], s.cards[out]);
        return true;
    }

    function _share(Side memory s) internal pure returns (uint16) {
        uint256 cur;
        uint256 max;
        for (uint256 i = 0; i < 8; i++) {
            cur += s.cards[i].hp;
            max += s.cards[i].maxHp;
        }
        return uint16((cur * 10000) / max); // E9
    }
}
