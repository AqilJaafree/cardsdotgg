#!/usr/bin/env bash
# Seeds demo escrow from the reserve (D3). Usage, from contracts/: script/seed.sh <deckId> [tUSD, default 1]
set -euo pipefail
set -a; . ../.env; set +a
RPC=${MONAD_TESTNET_RPC_URL:-https://testnet-rpc.monad.xyz}
ESCROW=$(node -p "require('../shared/addresses.json').yieldEscrow")
AMOUNT=$(node -p "BigInt(Math.round(${2:-1} * 1e6)).toString()")
cast send --rpc-url "$RPC" --private-key "$DEPLOYER_PRIVATE_KEY" --json "$ESCROW" 'seedEscrow(uint256,uint256)' "$1" "$AMOUNT" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(r.status,r.transactionHash)})'
