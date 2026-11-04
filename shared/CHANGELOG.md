# Shared interface changelog

Changes from plan section 4:

- `Action` gains two appended fields, `kind` and `targetCardId`, so the replay can show heals, swaps and refills from the contract's own log. See `shared/interfaces/Types.sol`.
- `IArena.accept` is no longer payable, since D16 removed the entropy fee.
- `IArena` adds `matchCount`, `seedBlockOf`, `opponentOf`, `stakeFor` and the `SeedRearmed` event. Match IDs start at 1.
- `IRateOracle` adds `cumulativeOf`, which vaults use to accrue across rate changes without iterating decks.
- `IDeckVault` adds `MIN_DEPOSIT_USD` and `MAX_DECKS`. `IYieldEscrow` adds `reserve`.
- New `ITestToken` and `IDeckNFT`.
