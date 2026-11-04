# Cardsdotgg

Yield-funded card battles on Monad testnet (chain 10143). Deposit testnet tokens, mint a deck NFT with an onchain SVG, and stake accrued yield in 1v1 battles. Principal never moves in a match. Battles are resolved onchain and the app replays the contract's own `simulateWithLog` output.

## Live contracts (Monad testnet)

Chain 10143. Explorer: https://testnet.monadvision.com

| Contract | Address |
| --- | --- |
| tUSD | [0x5bBE9D2735EEfDF453f71fe3f2bcD3E1cb8CB8B0](https://testnet.monadvision.com/address/0x5bBE9D2735EEfDF453f71fe3f2bcD3E1cb8CB8B0) |
| tGOLD | [0x0056df601aBDde9A13e19e20cBD5Ab947CC74D2d](https://testnet.monadvision.com/address/0x0056df601aBDde9A13e19e20cBD5Ab947CC74D2d) |
| rateOracle | [0xf15976C37Dfc4c42aAeB1363615F663e37349Fc7](https://testnet.monadvision.com/address/0xf15976C37Dfc4c42aAeB1363615F663e37349Fc7) |
| deckVault | [0x5Ddb431A9567025961C4Ea3bd45D2402e04301d8](https://testnet.monadvision.com/address/0x5Ddb431A9567025961C4Ea3bd45D2402e04301d8) |
| deckNFT | [0xb8d8ED7a197e94966dA6dfFf1D7294996e0351a3](https://testnet.monadvision.com/address/0xb8d8ED7a197e94966dA6dfFf1D7294996e0351a3) |
| yieldEscrow | [0x04f363F59fea06Ae7428BeA452B202e2e2fB13F5](https://testnet.monadvision.com/address/0x04f363F59fea06Ae7428BeA452B202e2e2fB13F5) |
| arena | [0xB960eD7FC078037608615a0b62a1a0295493f26E](https://testnet.monadvision.com/address/0xB960eD7FC078037608615a0b62a1a0295493f26E) |
| battleEngine | [0x300Fa0Af86201A410bEBD511Ca7FB81548a0f027](https://testnet.monadvision.com/address/0x300Fa0Af86201A410bEBD511Ca7FB81548a0f027) |
| withdrawRouter | [0x07B55AfA83169093276898f789A27a4e2d511F36](https://testnet.monadvision.com/address/0x07B55AfA83169093276898f789A27a4e2d511F36) |
| liquidityPool | [0xb3AF62BaFD2DA724842B0d82f485597aF90c4075](https://testnet.monadvision.com/address/0xb3AF62BaFD2DA724842B0d82f485597aF90c4075) |

## Prototype-only

- Randomness is a blockhash seed (`seedBlock = block.number + 1`), labelled "prototype-only randomness".
- tUSD and tGOLD are testnet tokens. Yield payouts are reserve-funded.
- Escrow can include a demo seed funded by the contract owner from the reserve (labelled "includes demo seed").
- A tier shows "source: Monad mainnet" only when `shared/rate-sources.json` marks it `live`; otherwise "demo rate, not live".
- Cards whose ability is not implemented show "ability inactive".
- Guardian's oracle rate is 0% at the last keeper read (its mainnet position was out of range); the app shows the rate as read. Rates are recorded by a keeper run, not streamed.
- The 48 to 52% balance criterion is not claimed; see `docs/agents/balance-report.md` for measured win rates.

## Run the app

```bash
cd app
pnpm install --ignore-workspace
pnpm dev   # syncs shared/ into app/lib/shared first
```

Needs a browser wallet on Monad Testnet with testnet MON. The app offers a one-click network switch.
