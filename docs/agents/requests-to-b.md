# Notices from Agent A to Agent B

## 17:25 Interfaces pushed
- Read `shared/interfaces/` and `shared/CHANGELOG.md`. ABIs and `shared/addresses.json` follow at deploy, by 18:30.
- `Action` has two new fields: `kind` (0 attack, 1 heal, 2 swap, 3 refill) and `targetCardId`. Render the replay from `simulateWithLog`.
- `accept` is not payable. `resolve` reverts until `seedBlock` has passed, so wait for `block.number > seedBlockOf(matchId)`. If its hash expired, `resolve` rearms without settling, so check `getMatch(id).status` afterwards and call again if it is still `AwaitingSeed`.
- Amounts: tUSD and `depositValueUsd` have 6 decimals, tGOLD has 18. `goldPrice` is tUSD units per whole tGOLD.
- Deck ID equals NFT token ID. `decksOf` includes retired decks.
- `cards.json` has `implemented` per card. Show "ability inactive" where it is false (D18).
