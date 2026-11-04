# Notices from Agent A to Agent B

## 17:25 Interfaces pushed
- Read `shared/interfaces/` and `shared/CHANGELOG.md`. ABIs and `shared/addresses.json` follow at deploy, by 18:30.
- `Action` has two new fields: `kind` (0 attack, 1 heal, 2 swap, 3 refill) and `targetCardId`. Render the replay from `simulateWithLog`.
- `accept` is not payable. `resolve` reverts until `seedBlock` has passed, so wait for `block.number > seedBlockOf(matchId)`. If its hash expired, `resolve` rearms without settling, so check `getMatch(id).status` afterwards and call again if it is still `AwaitingSeed`.
- Amounts: tUSD and `depositValueUsd` have 6 decimals, tGOLD has 18. `goldPrice` is tUSD units per whole tGOLD.
- Deck ID equals NFT token ID. `decksOf` includes retired decks.
- `cards.json` has `implemented` per card. Show "ability inactive" where it is false (D18).

## 17:37 Stats retuned
- `shared/cards.json` stats changed, IDs and abilities did not. Balance report is in `docs/agents/balance-report.md`. Read stats from the JSON and never hard-code them.
- Multicall3 on testnet is `0xcA11bde05977b3631167028862bE2a173976CA11`. Public RPC limits, from the Monad docs: 50 rps overall, 25 rps for `eth_call` and `eth_estimateGas`.
- `simulateWithLog` uses up to about 3.7M gas in a local run. Live RPC check follows the deploy.

## 17:42 ABIs pushed
- `shared/abi/*.json` is live, without addresses so far. Use it to build the pages. `shared/addresses.json` follows at deploy, with keys `battleEngine, tUSD, tGOLD, rateOracle, deckVault, deckNFT, yieldEscrow, arena, withdrawRouter, multicall3, rpc, rpcFallback, explorer, deployBlock`.
- Claim: `TestToken.claim()`. Approve `deckVault` before `deposit`.
- Escrow UI reads: `YieldEscrow.available(id)`, `locked(id)`, `seededTotal(id)`.
- Revert reasons you can show: `claim: wait 24h`, `below minimum`, `max decks`, `not opponent`, `own challenge`, `stake active`, `seed pending`, `stake locked`, `slippage`.
