#!/usr/bin/env bash
# LP loop with real transactions. Env: RPC, A_KEY (provider), B_KEY (trader). Run from contracts/. Never prints keys.
set -euo pipefail
get() { node -p "require('../shared/addresses.json').$1"; }
TUSD=$(get tUSD); GOLD=$(get tGOLD); POOL=$(get liquidityPool)
A=$(cast wallet address "$A_KEY"); B=$(cast wallet address "$B_KEY")
send() { local key=$1; shift; local out st; out=$(cast send --rpc-url "$RPC" --private-key "$key" --json "$@"); st=$(node -p "JSON.parse(process.argv[1]).status" "$out"); echo "  $2 $(node -p "JSON.parse(process.argv[1]).transactionHash" "$out") status=$st"; [ "$st" = "0x1" ] || { echo FAILED; exit 1; }; }
claim() { [ "$(cast call --rpc-url "$RPC" "$1" 'nextClaimAt(address)(uint256)' "$3" | cut -d' ' -f1)" = "0" ] && send "$2" "$1" 'claim()' || echo "  claim skipped"; }
pos() { cast call --rpc-url "$RPC" "$POOL" 'positionOf(address)(uint256,uint256,uint256)' "$A" | cut -d' ' -f1 | paste -sd' '; }
for t in "$TUSD" "$GOLD"; do claim "$t" "$A_KEY" "$A"; claim "$t" "$B_KEY" "$B"; send "$A_KEY" "$t" 'approve(address,uint256)' "$POOL" 1000000000000000000000; send "$B_KEY" "$t" 'approve(address,uint256)' "$POOL" 1000000000000000000000; done
BEFORE=$(pos | cut -d' ' -f1)
echo add; send "$A_KEY" "$POOL" 'addLiquidity(uint256,uint256,uint256,uint256)' 400000000 100000000000000000 0 0
START=$(pos); echo "position after add: $START"
echo swaps; send "$B_KEY" "$POOL" 'swap(uint8,uint256,uint256)' 0 200000000 0; send "$B_KEY" "$POOL" 'swap(uint8,uint256,uint256)' 1 50000000000000000 0
echo "position after swaps: $(pos)"
SHARES=$(python3 -c "print($(echo "$START" | cut -d' ' -f1) - $BEFORE)") # only what this run added, never the opening liquidity
echo remove; send "$A_KEY" "$POOL" 'removeLiquidity(uint256,uint256,uint256)' "$SHARES" 0 0
echo "position after remove: $(pos)"; echo "reserves: $(cast call --rpc-url "$RPC" "$POOL" 'reserves()(uint256,uint256)' | cut -d' ' -f1 | paste -sd' ')"
echo "LP E2E OK"
