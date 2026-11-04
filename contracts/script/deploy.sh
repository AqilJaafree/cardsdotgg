#!/usr/bin/env bash
# Deploys to Monad testnet from the repo-root .env, then exports ABIs. Run from contracts/. Never prints keys.
set -euo pipefail
set -a; . ../.env; set +a
RPC=${MONAD_TESTNET_RPC_URL:-https://testnet-rpc.monad.xyz}
[ "$(cast chain-id --rpc-url "$RPC")" = "10143" ] || { echo "RPC is not chain 10143"; exit 1; }
forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --slow --non-interactive 2>&1 | grep -vE 'PRIVATE|"(deployer|keeper)"' | tail -25
node script/export-abi.mjs
