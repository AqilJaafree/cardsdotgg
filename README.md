# YieldDeck

Yield-funded card battles on Monad testnet (chain 10143). Deposit testnet tokens, mint a deck NFT with an onchain SVG, and stake accrued yield in 1v1 battles. Principal never moves in a match. Battles are resolved onchain and the app replays the contract's own `simulateWithLog` output.

## Live contracts (Monad testnet)

_Filled from `shared/addresses.json` after deploy._

## Prototype-only

- Randomness is a blockhash seed (`seedBlock = block.number + 1`), labelled "prototype-only randomness".
- tUSD and tGOLD are testnet tokens. Yield payouts are reserve-funded.
- Escrow can include a demo seed funded by the contract owner from the reserve (labelled "includes demo seed").
- A tier shows "source: Monad mainnet" only when `shared/rate-sources.json` marks it `live`; otherwise "demo rate, not live".
- Cards whose ability is not implemented show "ability inactive".
- The 48 to 52% balance criterion is not claimed; see `docs/agents/balance-report.md` for measured win rates.

## Run the app

```bash
cd app
pnpm install --ignore-workspace
pnpm dev   # syncs shared/ into app/lib/shared first
```

Needs a browser wallet on Monad Testnet with testnet MON. The app offers a one-click network switch.
