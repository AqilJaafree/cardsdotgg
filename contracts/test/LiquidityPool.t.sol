// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Asset} from "@shared/Types.sol";
import {TestToken} from "../src/TestToken.sol";
import {LiquidityPool} from "../src/LiquidityPool.sol";

contract PoolHandler is Test {
    LiquidityPool pool;
    TestToken tusd;
    TestToken tgold;

    constructor(LiquidityPool pool_, TestToken tusd_, TestToken tgold_) {
        pool = pool_;
        tusd = tusd_;
        tgold = tgold_;
        tusd.approve(address(pool), type(uint256).max);
        tgold.approve(address(pool), type(uint256).max);
    }

    function swap(bool usdIn, uint256 amount) external {
        Asset asset = usdIn ? Asset.TUSD : Asset.TGOLD;
        pool.swap(asset, bound(amount, 1e3, usdIn ? 5000e6 : 2 ether), 0);
    }

    function add(uint256 usd, uint256 gold) external {
        pool.addLiquidity(bound(usd, 1e6, 5000e6), bound(gold, 1e15, 2 ether), 0, 0);
    }

    function remove(uint256 shares) external {
        uint256 held = pool.balanceOf(address(this));
        pool.removeLiquidity(bound(shares, 1, held), 0, 0);
    }
}

contract LiquidityPoolTest is Test {
    TestToken tusd;
    TestToken tgold;
    LiquidityPool pool;
    PoolHandler handler;
    address lp = address(0x1);
    address lp2 = address(0x2);
    address trader = address(0x3);
    uint256 lastK;

    function setUp() public {
        tusd = new TestToken("t", "tUSD", 6, 1000e6, address(this));
        tgold = new TestToken("g", "tGOLD", 18, 1 ether, address(this));
        pool = new LiquidityPool(tusd, tgold);
        address[3] memory users = [lp, lp2, trader];
        for (uint256 i = 0; i < 3; i++) {
            tusd.mint(users[i], 1_000_000e6);
            tgold.mint(users[i], 1000 ether);
            vm.startPrank(users[i]);
            tusd.approve(address(pool), type(uint256).max);
            tgold.approve(address(pool), type(uint256).max);
            vm.stopPrank();
        }
        vm.prank(lp);
        pool.addLiquidity(40_000e6, 10 ether, 0, 0);

        handler = new PoolHandler(pool, tusd, tgold);
        tusd.mint(address(handler), 1_000_000_000e6);
        tgold.mint(address(handler), 1_000_000 ether);
        targetContract(address(handler));
        (uint256 u, uint256 g) = pool.reserves();
        lastK = u * g;
    }

    function test_firstDepositLocksMinimumLiquidity() public view {
        assertEq(pool.balanceOf(address(0xdEaD)), pool.MINIMUM_LIQUIDITY());
        assertEq(pool.balanceOf(lp) + pool.MINIMUM_LIQUIDITY(), pool.totalSupply());
    }

    function test_swapPaysConstantProductLessFee() public {
        uint256 out = pool.quoteSwap(Asset.TUSD, 1000e6);
        // 1000 x 0.997 x 10 / (40000 + 997) = 0.243188...
        assertApproxEqAbs(out, 0.243188 ether, 0.000001 ether);
        vm.prank(trader);
        assertEq(pool.swap(Asset.TUSD, 1000e6, out), out);
        (uint256 u, uint256 g) = pool.reserves();
        assertEq(u, 41_000e6);
        assertEq(g, 10 ether - out);
    }

    function test_swapSlippageReverts() public {
        uint256 out = pool.quoteSwap(Asset.TUSD, 1000e6);
        vm.prank(trader);
        vm.expectRevert("pool: slippage");
        pool.swap(Asset.TUSD, 1000e6, out + 1);
    }

    function test_lpEarnsFeesFromSwaps() public {
        uint256 shares = pool.balanceOf(lp);
        (, uint256 usd0, uint256 gold0) = pool.positionOf(lp);
        vm.startPrank(trader);
        for (uint256 i = 0; i < 10; i++) {
            pool.swap(Asset.TUSD, 2000e6, 0);
            pool.swap(Asset.TGOLD, 0.5 ether, 0);
        }
        vm.stopPrank();
        (uint256 ru, uint256 rg) = pool.reserves();
        assertGt(ru * rg, uint256(40_000e6) * 10 ether); // k grew, which is the fee
        vm.prank(lp);
        (uint256 u1, uint256 g1) = pool.removeLiquidity(shares, 0, 0);
        assertGt(u1 * g1, usd0 * gold0);
    }

    function test_addIsProportionalAndDoesNotMovePrice() public {
        vm.prank(lp2);
        (uint256 u, uint256 g, uint256 shares) = pool.addLiquidity(4000e6, 5 ether, 0, 0);
        assertEq(u, 4000e6);
        assertEq(g, 1 ether); // the excess gold is not taken
        assertApproxEqRel(shares * 10, pool.totalSupply() - shares, 1e12);
    }

    function test_addSlippageReverts() public {
        vm.prank(lp2);
        vm.expectRevert("pool: slippage");
        pool.addLiquidity(4000e6, 5 ether, 0, 2 ether);
    }

    function test_addThenRemoveCannotProfit() public {
        uint256 u0 = tusd.balanceOf(lp2);
        uint256 g0 = tgold.balanceOf(lp2);
        vm.startPrank(lp2);
        (,, uint256 shares) = pool.addLiquidity(4000e6, 1 ether, 0, 0);
        pool.removeLiquidity(shares, 0, 0);
        vm.stopPrank();
        assertLe(tusd.balanceOf(lp2), u0);
        assertLe(tgold.balanceOf(lp2), g0);
    }

    function test_donationDoesNotChangeSharesOrPrice() public {
        uint256 before = pool.quoteSwap(Asset.TUSD, 1000e6);
        vm.prank(trader);
        tusd.transfer(address(pool), 100_000e6);
        assertEq(pool.quoteSwap(Asset.TUSD, 1000e6), before);
    }

    function test_removeMoreThanHeldReverts() public {
        uint256 shares = pool.balanceOf(lp);
        vm.prank(lp);
        vm.expectRevert();
        pool.removeLiquidity(shares + 1, 0, 0);
    }

    function testFuzz_swapNeverReducesK(uint256 amount, bool usdIn) public {
        amount = bound(amount, 1e3, usdIn ? 100_000e6 : 100 ether);
        (uint256 u0, uint256 g0) = pool.reserves();
        vm.prank(trader);
        try pool.swap(usdIn ? Asset.TUSD : Asset.TGOLD, amount, 0) {
            (uint256 u1, uint256 g1) = pool.reserves();
            assertGe(u1 * g1, u0 * g0);
        } catch {}
    }

    function invariant_reservesBackedByBalances() public view {
        (uint256 u, uint256 g) = pool.reserves();
        assertGe(tusd.balanceOf(address(pool)), u);
        assertGe(tgold.balanceOf(address(pool)), g);
        assertGt(u, 0);
        assertGt(g, 0);
        assertGe(pool.totalSupply(), pool.MINIMUM_LIQUIDITY());
    }
}
