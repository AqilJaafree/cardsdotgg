# Demo script (about 3 minutes)

Two wallets: A (challenger) and B (opponent), both with testnet MON. The contract owner wallet seeds escrow.

1. Wallet A: Deposit page, claim tUSD, approve, deposit 10+ tUSD in a tier. Open Decks to show the onchain SVG deck NFT and the rates panel.
2. Owner wallet: Decks, "Seed escrow", enter an amount for both decks. Escrow now shows "includes demo seed".
3. Wallet A: Arena, create a challenge (open or naming B). Note the staked vs Rank-only message.
4. Wallet B: claim, deposit, then Arena, Accept the challenge with its deck. Stakes lock.
5. Either wallet: wait for the seed block, press Resolve (press again if it re-arms).
6. Open "Watch replay": the log animates from the contract's `simulateWithLog`; the winner check shows green.
7. Arena ratings and Decks show the Elo and stake changes.
8. Winner/either wallet: Withdraw page, pick exit asset, withdraw all. Open each explorer link shown under the buttons.
