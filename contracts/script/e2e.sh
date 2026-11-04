#!/usr/bin/env bash
# Runs the demo loop with real transactions. Env: RPC, A_KEY (must own the contracts), B_KEY, plus address vars from
# shared/addresses.json. Run from contracts/. Prints transaction hashes and results, never keys.
set -euo pipefail
ADDR=../shared/addresses.json
get() { node -p "require('$ADDR').$1"; }
TUSD=$(get tUSD); VAULT=$(get deckVault); ESCROW=$(get yieldEscrow); ARENA=$(get arena); ROUTER=$(get withdrawRouter); ENGINE=$(get battleEngine); NFT=$(get deckNFT)
A=$(cast wallet address "$A_KEY"); B=$(cast wallet address "$B_KEY")
send() { local key=$1; shift; local out; out=$(cast send --rpc-url "$RPC" --private-key "$key" --json "$@"); local st; st=$(node -p "JSON.parse(process.argv[1]).status" "$out"); local h; h=$(node -p "JSON.parse(process.argv[1]).transactionHash" "$out"); local g; g=$(node -p "BigInt(JSON.parse(process.argv[1]).gasUsed).toString()" "$out"); echo "  $2 $h gas=$g status=$st"; [ "$st" = "0x1" ] || { echo "FAILED"; exit 1; }; }
call() { cast call --rpc-url "$RPC" "$@" | cut -d' ' -f1; }
claim() { if [ "$(call "$TUSD" 'nextClaimAt(address)(uint256)' "$2")" = "0" ]; then send "$1" "$TUSD" 'claim()'; else echo "  claim skipped, already claimed in 24h"; fi; }

echo "claim"; claim "$A_KEY" "$A"; claim "$B_KEY" "$B"
echo "approve"; send "$A_KEY" "$TUSD" 'approve(address,uint256)' "$VAULT" 100000000; send "$B_KEY" "$TUSD" 'approve(address,uint256)' "$VAULT" 100000000
echo "deposit"; send "$A_KEY" "$VAULT" 'deposit(uint8,uint256,uint8)' 0 100000000 0; send "$B_KEY" "$VAULT" 'deposit(uint8,uint256,uint8)' 0 100000000 2
DA=$(cast call --rpc-url "$RPC" "$VAULT" 'decksOf(address)(uint256[])' "$A" | tr -d '[] ' | tr ',' '\n' | tail -1)
DB=$(cast call --rpc-url "$RPC" "$VAULT" 'decksOf(address)(uint256[])' "$B" | tr -d '[] ' | tr ',' '\n' | tail -1)
echo "decks A=$DA B=$DB, tokenURI bytes: $(cast call --rpc-url "$RPC" "$NFT" 'tokenURI(uint256)(string)' "$DA" | wc -c)"
echo "seed"; send "$A_KEY" "$ESCROW" 'seedEscrow(uint256,uint256)' "$DA" 1000000; send "$A_KEY" "$ESCROW" 'seedEscrow(uint256,uint256)' "$DB" 1000000
echo "challenge"; send "$A_KEY" "$ARENA" 'createChallenge(uint256,address)' "$DA" "$B"
M=$(call "$ARENA" 'matchCount()(uint256)')
echo "accept match $M"; send "$B_KEY" "$ARENA" 'accept(uint256,uint256)' "$M" "$DB"
echo "locked A=$(call "$ESCROW" 'locked(uint256)(uint256)' "$DA") B=$(call "$ESCROW" 'locked(uint256)(uint256)' "$DB")"
SB=$(call "$ARENA" 'seedBlockOf(uint256)(uint64)' "$M")
for _ in $(seq 1 60); do N=$(cast block-number --rpc-url "$RPC"); [ "$N" -gt "$SB" ] && break; [ -n "${ANVIL:-}" ] && cast rpc --rpc-url "$RPC" evm_mine >/dev/null; timeout 1 tail -f /dev/null || true; done
echo "resolve"; send "$A_KEY" "$ARENA" 'resolve(uint256)' "$M"
echo "match: $(cast call --rpc-url "$RPC" "$ARENA" 'getMatch(uint256)((uint256,uint256,address,address,uint256,uint256,bytes32,uint8,uint64,address))' "$M")"
echo "ratings A=$(call "$ARENA" 'ratingOf(address)(uint32)' "$A") B=$(call "$ARENA" 'ratingOf(address)(uint32)' "$B")"
echo "escrow A=$(call "$ESCROW" 'available(uint256)(uint256)' "$DA") B=$(call "$ESCROW" 'available(uint256)(uint256)' "$DB") prizePool=$(call "$ARENA" 'prizePool()(uint256)')"
SEED=$(cast call --rpc-url "$RPC" "$ARENA" 'getMatch(uint256)(uint256,uint256,address,address,uint256,uint256,bytes32,uint8,uint64,address)' "$M" | sed -n 7p)
echo "seed=$SEED log bytes: $(cast call --rpc-url "$RPC" "$ENGINE" 'simulateWithLog(bytes32,uint8,uint8)' "$SEED" 0 2 | wc -c)"
echo "withdraw"; send "$A_KEY" "$ROUTER" 'withdraw(uint256,uint8,uint256)' "$DA" 0 0; send "$B_KEY" "$ROUTER" 'withdraw(uint256,uint8,uint256)' "$DB" 1 0
echo "retired A: $(cast call --rpc-url "$RPC" "$VAULT" 'getDeck(uint256)((address,uint8,uint8,uint256,uint256,uint64,bool))' "$DA")"
echo "E2E OK"
