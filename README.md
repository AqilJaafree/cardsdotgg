# cardsdotgg

Yield-funded card battles and a liquidity pool on Monad testnet (chain 10143). Deposit test tokens, mint a deck NFT with an onchain SVG, and stake accrued yield in 1v1 battles that resolve onchain. Principal never moves in a match. Deck yield rates and the gold price are read from real Monad mainnet positions and pools.

Every action in the app is a real wallet-signed transaction. Test tokens have no real value.

## How it works

1. **Claim and deposit.** Claim tUSD or tGOLD once per 24 hours, then deposit at least 10 tUSD of value to mint a Guardian, Balanced or Degen deck.
2. **Earn.** Yield accrues to the deck's escrow in tUSD at the oracle rate, paid from a reserve the deployer funded.
3. **Battle.** Challenge a named wallet or leave the opponent blank for an open challenge. Each player stakes 0.1% of their deposit from escrow. If either side is short, the match is Rank-only.
4. **Resolve and replay.** Anyone can call `resolve` once the seed block has passed. The app replays the contract's own `simulateWithLog` output. The winner gets 95% of the loser's stake, 5% goes to the prize pool, and Elo updates (start 500, K=32).
5. **Withdraw.** A full withdraw retires the deck and pays out principal plus remaining escrow, in tUSD or tGOLD at the oracle gold price.

The **pool** page is a separate tUSD/tGOLD constant-product pool. Providers add both tokens, receive LP shares, and earn a 0.3% fee on swaps, which stays in the reserves.

## Live contracts (Monad testnet)

All are verified on Sourcify with an exact match. Explorer: https://testnet.monadvision.com

| Contract | Address |
| --- | --- |
| tUSD | [`0x5bBE9D2735EEfDF453f71fe3f2bcD3E1cb8CB8B0`](https://testnet.monadvision.com/address/0x5bBE9D2735EEfDF453f71fe3f2bcD3E1cb8CB8B0) |
| tGOLD | [`0x0056df601aBDde9A13e19e20cBD5Ab947CC74D2d`](https://testnet.monadvision.com/address/0x0056df601aBDde9A13e19e20cBD5Ab947CC74D2d) |
| RateOracle | [`0xf15976C37Dfc4c42aAeB1363615F663e37349Fc7`](https://testnet.monadvision.com/address/0xf15976C37Dfc4c42aAeB1363615F663e37349Fc7) |
| DeckVault | [`0x5Ddb431A9567025961C4Ea3bd45D2402e04301d8`](https://testnet.monadvision.com/address/0x5Ddb431A9567025961C4Ea3bd45D2402e04301d8) |
| DeckNFT | [`0xb8d8ED7a197e94966dA6dfFf1D7294996e0351a3`](https://testnet.monadvision.com/address/0xb8d8ED7a197e94966dA6dfFf1D7294996e0351a3) |
| YieldEscrow | [`0x04f363F59fea06Ae7428BeA452B202e2e2fB13F5`](https://testnet.monadvision.com/address/0x04f363F59fea06Ae7428BeA452B202e2e2fB13F5) |
| Arena | [`0xB960eD7FC078037608615a0b62a1a0295493f26E`](https://testnet.monadvision.com/address/0xB960eD7FC078037608615a0b62a1a0295493f26E) |
| BattleEngine | [`0x300Fa0Af86201A410bEBD511Ca7FB81548a0f027`](https://testnet.monadvision.com/address/0x300Fa0Af86201A410bEBD511Ca7FB81548a0f027) |
| WithdrawRouter | [`0x07B55AfA83169093276898f789A27a4e2d511F36`](https://testnet.monadvision.com/address/0x07B55AfA83169093276898f789A27a4e2d511F36) |
| LiquidityPool | [`0xb3AF62BaFD2DA724842B0d82f485597aF90c4075`](https://testnet.monadvision.com/address/0xb3AF62BaFD2DA724842B0d82f485597aF90c4075) |

The deployed `DeckNFT` and `LiquidityPool` still report the earlier name "YieldDeck" onchain, in their token name and NFT description, because those strings are fixed at deployment. The source in this repo says Cardsdotgg, so it differs from the verified source in those strings until the next redeploy.

## Real mainnet data

A one-shot keeper reads Monad mainnet (chain 143) and writes to `RateOracle`. It runs on demand, so these are snapshots, not a live feed. Results are in `shared/rate-sources.json` and `shared/liquidity-source.json`.

| Deck | Uniswap position | Last rate |
| --- | --- | --- |
| Guardian | [EURW/USDC V3 #49582](https://app.uniswap.org/positions/v3/monad/49582) | 0.00% |
| Balanced | [USDC/WETH V4 #645141](https://app.uniswap.org/positions/v4/monad/645141) | 12.59% |
| Degen | [WMON/USDC V3 #49584](https://app.uniswap.org/positions/v3/monad/49584) | 23.73% |

- **What the rate means:** the fees each position's price range is estimated to have earned over the last 7 days, annualized from hourly samples of pool fee growth. It ignores impermanent loss, and is not what these new positions have earned themselves. The oracle caps rates at 50% and moves them at most 2 points per keeper run after the first.
- **Range status:** all three positions were out of range at the last read (2026-11-04 11:05 UTC), so they were not earning fees then. Guardian has a very narrow range, which is why its rate is 0%.
- **Gold price:** read from the [PancakeSwap V3 XAUt0/USDT0 pool](https://monadscan.com/address/0xa5C3a55Af4029724f519AC8d340bE9916AC83E45), treating USDT0 as 1 USD. The pool holds only about $25k, so its price is less robust than a price feed.
- **Testnet pool:** it opened at that price and total value using test tokens. It does not hold real assets, and its price moves only with its own swaps.
- **Payouts:** yield is paid in test tUSD from the reserve. Mainnet fees stay with the position's owner.

## Run locally

```bash
pnpm install
cd app && pnpm build && pnpm exec next start -p 3000
```

Open http://localhost:3000 with a browser wallet on Monad testnet. The app offers a one-click network switch. Gas MON comes from https://faucet.monad.xyz, and a full game loop costs about 0.2 MON per wallet.

## Operator scripts

These need a `.env` at the repo root (see `.env.example`). Never commit it.

```bash
cd contracts
forge test                                # contract tests
bash script/deploy.sh                     # read mainnet, deploy, export ABIs
bash script/player.sh fund <address> 0.2  # send a player gas MON from the deployer
bash script/player.sh seed-new            # seed 1 tUSD into each active deck not yet seeded
RPC=<url> A_KEY=<key> B_KEY=<key> bash script/e2e.sh     # full game loop
RPC=<url> A_KEY=<key> B_KEY=<key> bash script/e2e-lp.sh  # full pool loop

cd ../keeper
pnpm dry       # read mainnet only
pnpm run-once  # read mainnet and write to the oracle
```

## Local animated game

- `/`: three-round practice bracket with computer opponents, a Three.js card showcase before every practice battle, versus introduction, opening coin, animated dealing, attacks, energy attachment, bench switches, knockouts, points, and victory.
- `/packs`: separate free pack carousel, seal opening, card reveals, and collection storage in this browser. Packs do not affect battles or send transactions.
- `/collection`: search and inspect all 102 supplied Base Set cards, with collected-card counts.
- `/arena` and `/match/[id]`: the existing onchain challenge and contract replay flows.

React owns the controls and game state; Three.js renders card and pack scenes; Phaser renders the battle effects through WebGL with a canvas fallback. The layout supports desktop and mobile, with an optional focused portrait arena. Sound is opt-in, and reduced-motion preferences are respected.

Supplied videos guide the visual choreography. This is a reference-inspired implementation, not a pixel-identical recreation or a complete Pokémon TCG rules engine. Practice uses simplified damage, automatic reserve promotion, and first-to-three scoring. Practice state and cards are separate from the onchain YieldDeck engine and its deck NFTs.

```bash
cd app
pnpm dev --port 3002
pnpm test:game
pnpm typecheck
pnpm build
```

Card images are checked into `app/public/cards`. To refresh them from a local reference folder, run `node app/scripts/import-reference-cards.mjs /path/to/base1`. The importer preserves the provided artwork; pack wrappers and the YieldDeck card back are local SVG assets.

The practice arena, packs and collection work without a wallet and send no transactions.

## Repo layout

| Path | Contents |
| --- | --- |
| `contracts/` | Foundry project: contracts, tests and scripts |
| `keeper/` | One-shot mainnet reader |
| `app/` | Next.js app with wagmi and viem |
| `shared/` | ABIs, addresses, card data, engine rulings and mainnet data |
| `docs/agents/` | Balance report, demo script and build notes |
| `cardsdotgg.md` | Product and technical spec |

## Testing

- `forge test` covers engine determinism, stake settlement, Elo, withdraw, seeding, the principal invariant and the pool.
- The game and pool loops ran live on chain 10143 through scripts.
- The localhost UI was driven in a headless browser by two new wallets signing real testnet transactions, through a test wallet provider rather than a wallet extension such as MetaMask.

## Prototype limits

- **Randomness:** a future block hash, labelled "prototype-only randomness". It is not safe for real value.
- **Demo seed:** the owner can seed escrow from the reserve, labelled "includes demo seed", because real yield takes days to cover a stake.
- **Balance:** each pairing is within 40 to 60% over 1,000 matches, after retuning stats from the spec's deck table. The 48 to 52% target was not met or tested. See `docs/agents/balance-report.md`.
- **Ability coverage:** all 24 abilities are implemented, but most have no individual test.
- **Third-party art:** `app/public/cards` and `app/lib/game/card-catalog.json` hold 102 Pokémon TCG Base Set images and names, used by the practice arena, packs and collection. Confirm the rights to use and publish them before any release outside the hackathon.
- **Audit:** the contracts are unaudited testnet prototypes with no upgrade path.
