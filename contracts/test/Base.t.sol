// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Tier, Asset, Match, MatchStatus} from "@shared/Types.sol";
import {TestToken} from "../src/TestToken.sol";
import {RateOracle} from "../src/RateOracle.sol";
import {DeckVault, IVaultEscrow, IVaultNFT} from "../src/DeckVault.sol";
import {DeckNFT} from "../src/DeckNFT.sol";
import {YieldEscrow} from "../src/YieldEscrow.sol";
import {Arena} from "../src/Arena.sol";
import {WithdrawRouter} from "../src/WithdrawRouter.sol";
import {BattleEngine} from "../src/engine/BattleEngine.sol";

abstract contract Base is Test {
    address owner = address(0xA11CE);
    address keeper = address(0xBEEF);
    address alice = address(0xA);
    address bob = address(0xB);

    TestToken tusd;
    TestToken tgold;
    RateOracle oracle;
    DeckVault vault;
    DeckNFT nft;
    YieldEscrow escrow;
    Arena arena;
    WithdrawRouter router;
    BattleEngine engine;

    uint256 constant GOLD_PRICE = 4000e6;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        vm.startPrank(owner);
        engine = new BattleEngine();
        tusd = new TestToken("Test USD", "tUSD", 6, 1000e6, owner);
        tgold = new TestToken("Test Gold", "tGOLD", 18, 0.5 ether, owner);
        oracle = new RateOracle(owner, keeper, [uint16(500), 800, 1500], GOLD_PRICE);
        vault = new DeckVault(owner, tusd, tgold, oracle);
        nft = new DeckNFT(vault);
        escrow = new YieldEscrow(owner, tusd, vault, oracle);
        arena = new Arena(engine, vault, escrow);
        router = new WithdrawRouter(tusd, tgold, vault, escrow, oracle);
        vault.wire(IVaultEscrow(address(escrow)), IVaultNFT(address(nft)), address(router));
        escrow.wire(address(arena), address(router));
        tusd.mint(owner, 100_000e6);
        tusd.approve(address(escrow), 50_000e6);
        escrow.fundReserve(50_000e6);
        tusd.mint(address(router), 50_000e6);
        tgold.mint(address(router), 100 ether);
        vm.stopPrank();
        for (uint256 i = 0; i < 2; i++) {
            address who = i == 0 ? alice : bob;
            vm.startPrank(who);
            tusd.claim();
            tgold.claim();
            tusd.approve(address(vault), type(uint256).max);
            tgold.approve(address(vault), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _deck(address who, Asset asset, uint256 amount, Tier tier) internal returns (uint256 id) {
        vm.prank(who);
        id = vault.deposit(asset, amount, tier);
    }

    function _seed(uint256 deckId, uint256 amount) internal {
        vm.prank(owner);
        escrow.seedEscrow(deckId, amount);
    }

    function _play(uint256 a, uint256 b, bytes32 hash) internal returns (uint256 id) {
        vm.prank(alice);
        id = arena.createChallenge(a, bob);
        vm.prank(bob);
        arena.accept(id, b);
        uint64 seedBlock = arena.seedBlockOf(id);
        vm.roll(seedBlock + 1);
        vm.setBlockhash(seedBlock, hash);
        arena.resolve(id);
    }
}
