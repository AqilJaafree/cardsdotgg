#!/usr/bin/env bash
# Deploys to Monad testnet from the repo-root .env, then exports ABIs. Run from contracts/. Never prints keys.
set -euo pipefail
set -a; . ../.env; set +a
RPC=${MONAD_TESTNET_RPC_URL:-https://testnet-rpc.monad.xyz}
[ "$(cast chain-id --rpc-url "$RPC")" = "10143" ] || { echo "RPC is not chain 10143"; exit 1; }
(cd ../keeper && pnpm -s dry) # reads real mainnet data; stops the deploy if the read fails
GOLD_PRICE_USD_1E6=$(node -p "require('../shared/liquidity-source.json').usdPerGold1e6")
POOL_VALUE_USD_1E6=$(node -p "require('../shared/liquidity-source.json').reserveValueUsd1e6")
export GOLD_PRICE_USD_1E6 POOL_VALUE_USD_1E6
forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --slow --non-interactive --with-gas-price 104gwei --priority-gas-price 2gwei --gas-estimate-multiplier 115 2>&1 | grep -vE 'PRIVATE|"(deployer|keeper)"' | tail -25
node script/export-abi.mjs
