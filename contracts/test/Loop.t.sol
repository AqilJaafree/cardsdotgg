// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.t.sol";
import {Tier, Asset, Match, MatchStatus} from "@shared/Types.sol";
import {Elo} from "../src/libs/Elo.sol";

contract LoopTest is Base {
    uint256 a;
    uint256 b;

    function setUp() public override {
        super.setUp();
        a = _deck(alice, Asset.TUSD, 100e6, Tier.Guardian);
        b = _deck(bob, Asset.TUSD, 200e6, Tier.Degen);
    }

    // Stake settlement

    function test_acceptLocksBothStakes() public {
        _seed(a, 1e6);
        _seed(b, 1e6);
        vm.prank(alice);
        uint256 id = arena.createChallenge(a, bob);
        assertEq(escrow.locked(a), 0.1e6);
        vm.prank(bob);
        arena.accept(id, b);
        assertEq(escrow.locked(b), 0.2e6);
    }

    function test_winnerGets95PercentAndPrizePool5Percent() public {
        _seed(a, 1e6);
        _seed(b, 1e6);
        uint256 id = _play(a, b, keccak256("settle"));
        Match memory m = arena.getMatch(id);
        assertEq(uint8(m.status), uint8(MatchStatus.Resolved));
        assertEq(escrow.locked(a) + escrow.locked(b), 0);
        require(m.winner != address(0), "pick a seed with a winner");
        (uint256 w, uint256 l, uint256 lost) = m.winner == alice ? (a, b, uint256(0.2e6)) : (b, a, uint256(0.1e6));
        uint256 own = w == a ? 0.1e6 : 0.2e6;
        assertEq(escrow.balanceOf(w), 1e6 - own + own + (lost * 95) / 100);
        assertEq(escrow.balanceOf(l), 1e6 - lost);
        assertEq(arena.prizePool(), (lost * 5) / 100);
        assertEq(tusd.balanceOf(address(arena)), arena.prizePool());
    }

    function test_shortEscrowFallsBackToRankOnly() public {
        _seed(a, 1e6);
        vm.prank(alice);
        uint256 id = arena.createChallenge(a, bob);
        assertEq(escrow.locked(a), 0.1e6);
        vm.prank(bob);
        arena.accept(id, b);
        Match memory m = arena.getMatch(id);
        assertEq(m.stakeA, 0);
        assertEq(m.stakeB, 0);
        assertEq(escrow.locked(a), 0);
    }

    function test_expireAfterOneHourRefunds() public {
        _seed(a, 1e6);
        vm.prank(alice);
        uint256 id = arena.createChallenge(a, bob);
        vm.expectRevert("too early");
        arena.expire(id);
        vm.warp(block.timestamp + 1 hours);
        arena.expire(id);
        assertEq(escrow.locked(a), 0);
    }

    function test_cannotResolveBeforeSeedBlockOrTwice() public {
        vm.prank(alice);
        uint256 id = arena.createChallenge(a, bob);
        vm.prank(bob);
        arena.accept(id, b);
        vm.expectRevert("seed pending");
        arena.resolve(id);
        uint64 sb = arena.seedBlockOf(id);
        vm.roll(sb + 1);
        vm.setBlockhash(sb, keccak256("x"));
        arena.resolve(id);
        vm.expectRevert("not awaiting seed");
        arena.resolve(id);
    }

    function test_expiredHashRearmsWithoutSettling() public {
        vm.prank(alice);
        uint256 id = arena.createChallenge(a, bob);
        vm.prank(bob);
        arena.accept(id, b);
        uint64 sb = arena.seedBlockOf(id);
        vm.roll(sb + 300);
        vm.setBlockhash(sb, bytes32(0));
        arena.resolve(id);
        assertEq(uint8(arena.getMatch(id).status), uint8(MatchStatus.AwaitingSeed));
        assertEq(arena.seedBlockOf(id), block.number + 1);
    }

    function test_resultMatchesEngine() public {
        uint256 id = _play(a, b, keccak256("engine"));
        Match memory m = arena.getMatch(id);
        (uint8 side,,,) = engine.simulate(m.seed, 0, 2);
        assertEq(m.winner, side == 0 ? alice : side == 1 ? bob : address(0));
    }

    // Access

    function test_namedOpponentOnly() public {
        vm.prank(alice);
        uint256 id = arena.createChallenge(a, address(0xC));
        vm.prank(bob);
        vm.expectRevert("not opponent");
        arena.accept(id, b);
    }

    function test_cannotAcceptOwnChallenge() public {
        uint256 a2 = _deck(alice, Asset.TUSD, 50e6, Tier.Degen);
        vm.prank(alice);
        uint256 id = arena.createChallenge(a, address(0));
        vm.prank(alice);
        vm.expectRevert("own challenge");
        arena.accept(id, a2);
    }

    // Elo

    function test_equalRatingsMoveBy16() public pure {
        assertEq(Elo.next(500, 500, 1e6), 516);
        assertEq(Elo.next(500, 500, 0), 484);
        assertEq(Elo.next(500, 500, 5e5), 500);
    }

    function test_eloMatchesReference() public pure {
        // 32 x (1 - 1 / (1 + 10^(-200/400))) rounds to 8; upset 32 x (1 - 1 / (1 + 10^(200/400))) rounds to 24.
        assertEq(Elo.next(700, 500, 1e6), 708);
        assertEq(Elo.next(500, 700, 1e6), 524);
    }

    function test_eloFloorAtZero() public pure {
        assertEq(Elo.next(1, 500, 0), 0); // loses 2 points from a rating of 1
    }

    function test_ratingsChangeInMatch() public {
        assertEq(arena.ratingOf(alice), 500);
        uint256 id = _play(a, b, keccak256("rate"));
        address w = arena.getMatch(id).winner;
        if (w == address(0)) return;
        assertEq(arena.ratingOf(w), 516);
        assertEq(arena.ratingOf(w == alice ? bob : alice), 484);
    }

    // Seed escrow

    function test_seedEscrowOwnerOnlyAndEmits() public {
        vm.prank(alice);
        vm.expectRevert();
        escrow.seedEscrow(a, 1e6);
        vm.expectEmit(true, false, false, true);
        emit EscrowSeeded(a, 1e6);
        _seed(a, 1e6);
        assertEq(escrow.seededTotal(a), 1e6);
    }

    event EscrowSeeded(uint256 indexed deckId, uint256 amount);

    function test_seedEscrowComesFromReserveNotPrincipal() public {
        uint256 reserveBefore = escrow.reserve();
        uint256 vaultBefore = tusd.balanceOf(address(vault));
        _seed(a, 1e6);
        assertEq(reserveBefore - escrow.reserve(), 1e6);
        assertEq(tusd.balanceOf(address(vault)), vaultBefore);
    }

    // Yield

    function test_accruesAtOracleRateAcrossRateChange() public {
        vm.warp(block.timestamp + 365 days / 2);
        assertEq(escrow.available(a), 2.5e6); // 100 tUSD at 5% for half a year
        vm.prank(keeper);
        oracle.setRates(1000, 800, 1500, 1); // first keeper write skips the step cap
        vm.warp(block.timestamp + 365 days / 2);
        assertEq(escrow.available(a), 7.5e6);
    }

    function test_reserveShortPaysPartial() public {
        _seed(a, escrow.reserve() - 1e6);
        vm.warp(block.timestamp + 365 days); // deck b is owed 30 tUSD, the reserve holds about 1 tUSD
        vault.checkpoint(b);
        assertEq(escrow.balanceOf(b), 1e6);
        assertEq(escrow.reserve(), 0);
    }

    // Withdraw

    function test_fullWithdrawReturnsPrincipalPlusEscrow() public {
        _seed(a, 1e6);
        uint256 before = tusd.balanceOf(alice);
        vm.prank(alice);
        router.withdraw(a, Asset.TUSD, 101e6);
        assertEq(tusd.balanceOf(alice), before + 101e6);
        assertTrue(vault.getDeck(a).retired);
        assertEq(vault.totalPrincipal(0), 200e6);
    }

    function test_withdrawToGoldUsesOraclePrice() public {
        _seed(a, 1e6);
        uint256 before = tgold.balanceOf(alice);
        vm.prank(alice);
        router.withdraw(a, Asset.TGOLD, 0);
        assertEq(tgold.balanceOf(alice) - before, (101e6 * 1 ether) / GOLD_PRICE);
    }

    function test_withdrawGoldDeckToTusd() public {
        uint256 g = _deck(alice, Asset.TGOLD, 0.1 ether, Tier.Balanced);
        assertEq(vault.getDeck(g).depositValueUsd, 400e6);
        uint256 before = tusd.balanceOf(alice);
        vm.prank(alice);
        router.withdraw(g, Asset.TUSD, 400e6);
        assertEq(tusd.balanceOf(alice) - before, 400e6);
    }

    function test_withdrawRevertsWhileLockedSlippageAndOwner() public {
        _seed(a, 1e6);
        vm.prank(alice);
        arena.createChallenge(a, bob);
        vm.prank(alice);
        vm.expectRevert("stake locked");
        router.withdraw(a, Asset.TUSD, 0);
        vm.prank(bob);
        vm.expectRevert("not deck owner");
        router.withdraw(a, Asset.TUSD, 0);
    }

    function test_withdrawSlippageGuard() public {
        vm.prank(alice);
        vm.expectRevert("slippage");
        router.withdraw(a, Asset.TUSD, 101e6);
    }

    function test_lostStakesReduceEscrowOut() public {
        _seed(a, 1e6);
        _seed(b, 1e6);
        uint256 id = _play(a, b, keccak256("settle"));
        address w = arena.getMatch(id).winner;
        require(w != address(0), "pick a seed with a winner");
        (uint256 loser, address who) = w == alice ? (b, bob) : (a, alice);
        (, uint256 out) = router.quote(loser, Asset.TUSD);
        assertLt(out, 1e6);
        vm.prank(who);
        router.withdraw(loser, Asset.TUSD, 0);
    }

    // NFT and tokens

    function test_tokenURIAndNonTransferable() public {
        string memory uri = nft.tokenURI(a);
        assertGt(bytes(uri).length, 1000);
        vm.prank(alice);
        vm.expectRevert("non-transferable");
        nft.transferFrom(alice, bob, a);
        vm.prank(alice);
        router.withdraw(a, Asset.TUSD, 0);
        assertGt(bytes(nft.tokenURI(a)).length, 1000);
    }

    function test_maxFiveDecksAndMinimum() public {
        vm.prank(alice);
        vm.expectRevert("below minimum");
        vault.deposit(Asset.TUSD, 9e6, Tier.Degen);
        for (uint256 i = 0; i < 4; i++) _deck(alice, Asset.TUSD, 10e6, Tier.Degen);
        vm.prank(alice);
        vm.expectRevert("max decks");
        vault.deposit(Asset.TUSD, 10e6, Tier.Degen);
    }

    function test_claimOncePer24h() public {
        vm.prank(alice);
        vm.expectRevert("claim: wait 24h");
        tusd.claim();
        vm.warp(block.timestamp + 24 hours);
        vm.prank(alice);
        tusd.claim();
    }

    function test_oracleKeeperStepCapAndClamp() public {
        vm.expectRevert();
        oracle.setRates(1, 1, 1, 1);
        vm.startPrank(keeper);
        oracle.setRates(9000, 800, 1500, 1); // first write: no step cap, still clamps
        assertEq(oracle.rateOf(Tier.Guardian), 5000);
        oracle.setRates(100, 2000, 1500, 2);
        assertEq(oracle.rateOf(Tier.Guardian), 4800);
        assertEq(oracle.rateOf(Tier.Balanced), 1000);
        vm.stopPrank();
        vm.warp(block.timestamp + 24 hours + 1);
        assertTrue(oracle.isStale());
    }
}
