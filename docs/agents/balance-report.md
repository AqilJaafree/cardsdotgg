# Balance report

Foundry script, 1000 matches per pairing, sides alternating. A draw counts as half a win (D13).

| Pairing | First deck win rate | Draws | Round-15 finishes | Average rounds |
| --- | --- | --- | --- | --- |
| Guardian vs Guardian | 48.1 | 9 | 1000 | 15.0 |
| Guardian vs Balanced | 56.0 | 1 | 1000 | 15.0 |
| Guardian vs Degen | 40.1 | 0 | 147 | 13.2 |
| Balanced vs Balanced | 50.7 | 0 | 69 | 12.9 |
| Balanced vs Degen | 56.3 | 0 | 0 | 9.0 |
| Degen vs Degen | 51.0 | 0 | 0 | 6.7 |

## Retune

The spec's stats were badly unbalanced on the first run (1,000 matches, first deck's win rate): Guardian beat Balanced 100.0%, Degen beat Guardian 67.4%, and Degen beat Balanced 98.1%. Each card's stats were then shifted by a per-tier delta, keeping every card's total at 100. `shared/cards.json` is now the source of truth; the deck table in `cardsdotgg.md` still shows the original stats.

| Tier | HP | ATK | DEF | SPD |
| --- | --- | --- | --- | --- |
| Guardian | -3 | +1 | -5 | +7 |
| Balanced | +6 | +5 | 0 | -11 |
| Degen | +1 | -4 | +2 | +1 |

## Limits

- This is about 1,000 matches per pairing, with a target of 40 to 60%. The 48 to 52% criterion over 10,000 matches was not run and is not claimed.
- Tiers were tuned as a whole, so individual cards were not balanced. Balanced SPD is now very low.
- Every Guardian vs Balanced match reaches round 15 and is decided on HP share, and those matches may feel slow.
