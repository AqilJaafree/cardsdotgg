#!/usr/bin/env bash
# Helps other wallets join the game. Run from contracts/. Never prints keys.
#   script/player.sh fund <address> [MON, default 0.2]   sends gas MON from the deployer
#   script/player.sh seed-new [tUSD, default 1]          seeds every active deck that has no seed yet
set -euo pipefail
set -a; . ../.env; set +a
RPC=${MONAD_TESTNET_RPC_URL:-https://testnet-rpc.monad.xyz}
GAS=(--gas-price 104gwei --priority-gas-price 2gwei)
tx() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(process.argv[1],r.status,r.transactionHash)})' "$1"; }
case "${1:-}" in
  fund)
    cast send --rpc-url "$RPC" --private-key "$DEPLOYER_PRIVATE_KEY" "${GAS[@]}" --json "$2" --value "${3:-0.2}ether" | tx "fund $2"
    echo "balance: $(cast balance "$2" --ether --rpc-url "$RPC") MON"
    ;;
  seed-new)
    VAULT=$(node -p "require('../shared/addresses.json').deckVault"); ESCROW=$(node -p "require('../shared/addresses.json').yieldEscrow")
    AMOUNT=$(node -p "BigInt(Math.round(${2:-1} * 1e6)).toString()")
    COUNT=$(cast call --rpc-url "$RPC" "$VAULT" 'deckCount()(uint256)' | cut -d' ' -f1)
    for ((id = 1; id <= COUNT; id++)); do
      RETIRED=$(cast call --rpc-url "$RPC" "$VAULT" 'getDeck(uint256)((address,uint8,uint8,uint256,uint256,uint64,bool))' "$id" | tr -d '() ' | awk -F, '{print $NF}')
      SEEDED=$(cast call --rpc-url "$RPC" "$ESCROW" 'seededTotal(uint256)(uint256)' "$id" | cut -d' ' -f1)
      if [ "$RETIRED" = "false" ] && [ "$SEEDED" = "0" ]; then
        cast send --rpc-url "$RPC" --private-key "$DEPLOYER_PRIVATE_KEY" "${GAS[@]}" --json "$ESCROW" 'seedEscrow(uint256,uint256)' "$id" "$AMOUNT" | tx "seed deck $id"
      else
        echo "deck $id skipped (retired=$RETIRED seeded=$SEEDED)"
      fi
    done
    ;;
  *) echo "usage: player.sh fund <address> [MON] | seed-new [tUSD]"; exit 1 ;;
esac
