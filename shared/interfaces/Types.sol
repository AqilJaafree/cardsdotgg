// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum Tier { Guardian, Balanced, Degen }
enum Asset { TUSD, TGOLD }
enum MatchStatus { Open, AwaitingSeed, SeedReady, Resolved, Expired } // SeedReady is unused (D16)

/// depositValueUsd is in tUSD units (6 decimals). principal is in the deposited asset's units.
struct Deck {
    address owner; Tier tier; Asset asset; uint256 principal;
    uint256 depositValueUsd; uint64 depositedAt; bool retired;
}

struct Match {
    uint256 deckA; uint256 deckB; address playerA; address playerB;
    uint256 stakeA; uint256 stakeB; bytes32 seed; MatchStatus status;
    uint64 createdAt; address winner; // winner is address(0) for a draw
}

/// kind: 0 attack, 1 heal, 2 end-of-round swap, 3 faint refill.
/// attack: side/slot/cardId attack targetSlot/targetCardId.
/// heal: side/slot/cardId healed by `damage` HP, selfHpAfter is the new HP.
/// swap and refill: on `side`, cardId enters `slot`, targetCardId leaves it. selfHpAfter is cardId's HP.
struct Action {
    uint8 round; uint8 side; uint8 slot; uint8 targetSlot; uint8 cardId;
    uint32 damage; bool crit; bool dodged; uint32 targetHpAfter; uint32 selfHpAfter;
    uint8 kind; uint8 targetCardId;
}
