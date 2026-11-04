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

## 17:46 Rates
- `shared/rate-sources.json` is an array, one entry per tier: `tier, bps, live, source, sourceContract, sourceUrl, note, readAt, mainnetBlock`. All three tiers are `live: true`. Show "source: Monad mainnet", the source contract and `note`. Read the current rate from `RateOracle.rateOf`, not the JSON.
- Balanced is credit-only, because no gold strategy was found on Monad, and the spec says the app must say so. It is in `note`.
- **The gold price is NOT live.** `RateOracle.goldPrice` is deployer-set, because no gold feed was verified. Label it "demo gold price, not live" wherever tGOLD is converted.
- `resolve` costs about 1M to 1.3M gas, and `resolve` gas depends on the seed.

## 17:48 Live RPC check
- `simulateWithLog` works through `eth_call` on all three public testnet RPCs, tested with a code override: `testnet-rpc.monad.xyz`, `rpc.ankr.com/monad_testnet` and `rpc-testnet.monadinfra.com`. The full loop passed on local anvil. Live deploy is waiting on the funded key.

## 17:57 New feature, requested by the user: liquidity pool
- `LiquidityPool` is a tUSD/tGOLD constant-product pool. ABI: `shared/abi/LiquidityPool.json`, interface: `shared/interfaces/ILiquidityPool.sol`, address key: `liquidityPool` at deploy. The pool contract is also the LP share ERC-20, with 12 decimals.
- **Request:** please add one page, with one clean path: approve both tokens to the pool, `addLiquidity`, `swap`, `removeLiquidity`. Show `reserves()` and `positionOf(address)`. Set the min arguments from `quoteSwap` and `reserves` with a slippage setting. Reverts: `pool: slippage`, `pool: zero shares`, `pool: zero in`, `pool: zero out`, `pool: too small`.
- Fees stay in the reserves, so there is nothing to claim. Do not show a fee APR, since the contract does not track one. `positionOf` values also move with the pool price.
- Label it honestly: testnet tokens, fees come only from swaps on this pool, and the opening price is the deployer-set demo gold price, not a market price.
- The rest of your scope is unchanged. Deploy needs about 17.4M gas.

## 18:01 Real liquidity data, requested by the user. Replaces the 17:46 and 17:57 gold labels
- New `shared/liquidity-source.json`, read from Monad mainnet: PancakeSwap V3 XAUt0/USDT0 pool. Fields include `usdPerGold1e6, goldReserve, goldDecimals, quoteReserve, quoteDecimals, reserveValueUsd1e6, feePips, volume24hUsd, volumeSource, sourceContract, note, readAt, mainnetBlock`.
- `RateOracle.goldPrice` now comes from this pool through the keeper, and the testnet pool opens at this price and total value, split evenly. Drop the "demo gold price" label. Show "source: Monad mainnet", the pool address and `readAt`.
- It is a one-time read per keeper run, not a live stream, so always show `readAt`.
- Pool page: show the mainnet data as a clearly separate "Mainnet reference" panel. `reserves()` and `positionOf()` are the testnet pool and test tokens. Never present mainnet reserves or volume as this pool's own, and do not derive an APR from them.
- Still label it: testnet tokens, thin mainnet pool, fees here come only from swaps on this pool. The testnet pool's price moves with its own swaps and does not follow mainnet.
