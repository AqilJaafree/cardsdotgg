// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "../Base.t.sol";
import {Tier, Asset, Match, MatchStatus, Deck} from "@shared/Types.sol";
import {Arena} from "../../src/Arena.sol";
import {YieldEscrow} from "../../src/YieldEscrow.sol";
import {Test} from "forge-std/Test.sol";

contract MatchHandler is Test {
    Arena arena;
    YieldEscrow escrow;
    address owner;
    address alice;
    address bob;
    uint256 a;
    uint256 b;
    uint256 open;
    uint256 pending;

    constructor(Arena arena_, YieldEscrow escrow_, address owner_, address alice_, address bob_, uint256 a_, uint256 b_) {
        arena = arena_;
        escrow = escrow_;
        owner = owner_;
        alice = alice_;
        bob = bob_;
        a = a_;
        b = b_;
    }

    function seed(uint256 who, uint256 amount) external {
        vm.prank(owner);
        escrow.seedEscrow(who % 2 == 0 ? a : b, bound(amount, 0, 1e6));
    }

    function create() external {
        vm.prank(alice);
        open = arena.createChallenge(a, bob);
    }

    function accept() external {
        vm.prank(bob);
        arena.accept(open, b);
        pending = open;
    }

    function resolve(bytes32 hash) external {
        uint64 sb = arena.seedBlockOf(pending);
        vm.roll(sb + 1);
        vm.setBlockhash(sb, hash == bytes32(0) ? keccak256("h") : hash);
        arena.resolve(pending);
    }

    function expire(uint256 skipBy) external {
        vm.warp(block.timestamp + bound(skipBy, 0, 2 hours));
        arena.expire(open);
    }
}

contract PrincipalInvariant is Base {
    uint256 a;
    uint256 b;
    uint256 c;
    MatchHandler handler;
    uint256 vaultTusd;
    uint256 vaultGold;

    function setUp() public override {
        super.setUp();
        a = _deck(alice, Asset.TUSD, 100e6, Tier.Guardian);
        b = _deck(bob, Asset.TUSD, 200e6, Tier.Degen);
        c = _deck(bob, Asset.TGOLD, 0.1 ether, Tier.Balanced);
        vaultTusd = tusd.balanceOf(address(vault));
        vaultGold = tgold.balanceOf(address(vault));
        handler = new MatchHandler(arena, escrow, owner, alice, bob, a, b);
        targetContract(address(handler));
    }

    function invariant_principalNeverMovedByMatch() public view {
        assertEq(tusd.balanceOf(address(vault)), vaultTusd);
        assertEq(tgold.balanceOf(address(vault)), vaultGold);
        assertEq(vault.totalPrincipal(0), vaultTusd);
        assertEq(vault.totalPrincipal(1), vaultGold);
        assertEq(vault.getDeck(a).principal + vault.getDeck(b).principal, vaultTusd);
        assertEq(vault.getDeck(c).principal, vaultGold);
    }

    function invariant_escrowHoldsWhatItOwes() public view {
        assertEq(
            tusd.balanceOf(address(escrow)),
            escrow.reserve() + escrow.balanceOf(a) + escrow.balanceOf(b) + escrow.balanceOf(c)
                + escrow.locked(a) + escrow.locked(b) + escrow.locked(c)
        );
    }
}
