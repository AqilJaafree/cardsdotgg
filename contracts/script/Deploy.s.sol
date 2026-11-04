// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TestToken} from "../src/TestToken.sol";
import {RateOracle} from "../src/RateOracle.sol";
import {DeckVault, IVaultEscrow, IVaultNFT} from "../src/DeckVault.sol";
import {DeckNFT} from "../src/DeckNFT.sol";
import {YieldEscrow} from "../src/YieldEscrow.sol";
import {Arena} from "../src/Arena.sol";
import {WithdrawRouter} from "../src/WithdrawRouter.sol";
import {BattleEngine} from "../src/engine/BattleEngine.sol";

/// Keys come only from the environment. Writes shared/addresses.json.
contract Deploy is Script {
    uint256 constant RESERVE = 1_000_000e6;
    uint256 constant ROUTER_TUSD = 1_000_000e6;
    uint256 constant ROUTER_GOLD = 1_000 ether;

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(key);
        address keeper = vm.addr(vm.envUint("KEEPER_PRIVATE_KEY"));
        uint16[3] memory rates = [
            uint16(vm.envOr("RATE_GUARDIAN_BPS", uint256(500))),
            uint16(vm.envOr("RATE_BALANCED_BPS", uint256(800))),
            uint16(vm.envOr("RATE_DEGEN_BPS", uint256(1500)))
        ];
        uint256 gold = vm.envOr("GOLD_PRICE_USD_1E6", uint256(4000e6));

        vm.startBroadcast(key);
        BattleEngine engine = new BattleEngine();
        TestToken tusd = new TestToken("Test USD (testnet)", "tUSD", 6, 1000e6, deployer);
        TestToken tgold = new TestToken("Test Gold (testnet)", "tGOLD", 18, 0.5 ether, deployer);
        RateOracle oracle = new RateOracle(deployer, keeper, rates, gold);
        DeckVault vault = new DeckVault(deployer, tusd, tgold, oracle);
        DeckNFT nft = new DeckNFT(vault);
        YieldEscrow escrow = new YieldEscrow(deployer, tusd, vault, oracle);
        Arena arena = new Arena(engine, vault, escrow);
        WithdrawRouter router = new WithdrawRouter(tusd, tgold, vault, escrow, oracle);
        vault.wire(IVaultEscrow(address(escrow)), IVaultNFT(address(nft)), address(router));
        escrow.wire(address(arena), address(router));
        tusd.mint(deployer, RESERVE);
        tusd.approve(address(escrow), RESERVE);
        escrow.fundReserve(RESERVE);
        tusd.mint(address(router), ROUTER_TUSD);
        tgold.mint(address(router), ROUTER_GOLD);
        vm.stopBroadcast();

        string memory o = "addresses";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeAddress(o, "deployer", deployer);
        vm.serializeAddress(o, "keeper", keeper);
        vm.serializeAddress(o, "battleEngine", address(engine));
        vm.serializeAddress(o, "tUSD", address(tusd));
        vm.serializeAddress(o, "tGOLD", address(tgold));
        vm.serializeAddress(o, "rateOracle", address(oracle));
        vm.serializeAddress(o, "deckVault", address(vault));
        vm.serializeAddress(o, "deckNFT", address(nft));
        vm.serializeAddress(o, "yieldEscrow", address(escrow));
        vm.serializeAddress(o, "arena", address(arena));
        vm.serializeAddress(o, "withdrawRouter", address(router));
        vm.serializeAddress(o, "multicall3", 0xcA11bde05977b3631167028862bE2a173976CA11);
        vm.serializeString(o, "rpc", "https://testnet-rpc.monad.xyz");
        vm.serializeString(o, "rpcFallback", "https://rpc.ankr.com/monad_testnet");
        vm.serializeString(o, "explorer", "https://testnet.monadvision.com");
        string memory json = vm.serializeUint(o, "deployBlock", block.number);
        vm.writeJson(json, "../shared/addresses.json");
        console2.log(json);
    }
}
