// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Asset} from "@shared/Types.sol";
import {ILiquidityPool} from "@shared/ILiquidityPool.sol";

/// Constant-product pool with a 0.3% fee that stays in the reserves. Prices come only from the reserves;
/// the oracle is not used. Reserves are tracked, so direct token transfers do not change prices or shares.
contract LiquidityPool is ILiquidityPool, ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant override FEE_BPS = 30;
    uint256 public constant MINIMUM_LIQUIDITY = 1000; // locked forever on the first deposit
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IERC20 public immutable tusd;
    IERC20 public immutable tgold;
    uint256 private _tusdReserve;
    uint256 private _goldReserve;

    constructor(IERC20 tusd_, IERC20 tgold_) ERC20("YieldDeck tUSD/tGOLD LP (testnet)", "ydLP") {
        tusd = tusd_;
        tgold = tgold_;
    }

    function decimals() public pure override returns (uint8) {
        return 12; // sqrt(6 + 18 decimals)
    }

    function addLiquidity(uint256 tusdDesired, uint256 goldDesired, uint256 tusdMin, uint256 goldMin)
        external
        override
        nonReentrant
        returns (uint256 tusdIn, uint256 goldIn, uint256 shares)
    {
        uint256 supply = totalSupply();
        if (supply == 0) {
            (tusdIn, goldIn) = (tusdDesired, goldDesired);
            uint256 root = Math.sqrt(tusdIn * goldIn);
            require(root > MINIMUM_LIQUIDITY, "pool: too small");
            shares = root - MINIMUM_LIQUIDITY;
            _mint(DEAD, MINIMUM_LIQUIDITY);
        } else {
            uint256 goldOptimal = (tusdDesired * _goldReserve) / _tusdReserve;
            if (goldOptimal <= goldDesired) {
                (tusdIn, goldIn) = (tusdDesired, goldOptimal);
            } else {
                (tusdIn, goldIn) = ((goldDesired * _tusdReserve) / _goldReserve, goldDesired);
            }
            shares = Math.min((tusdIn * supply) / _tusdReserve, (goldIn * supply) / _goldReserve);
        }
        require(tusdIn >= tusdMin && goldIn >= goldMin, "pool: slippage");
        require(shares > 0, "pool: zero shares");

        _tusdReserve += tusdIn;
        _goldReserve += goldIn;
        _mint(msg.sender, shares);
        tusd.safeTransferFrom(msg.sender, address(this), tusdIn);
        tgold.safeTransferFrom(msg.sender, address(this), goldIn);
        emit LiquidityAdded(msg.sender, tusdIn, goldIn, shares);
    }

    function removeLiquidity(uint256 shares, uint256 tusdMin, uint256 goldMin)
        external
        override
        nonReentrant
        returns (uint256 tusdOut, uint256 goldOut)
    {
        require(shares > 0, "pool: zero shares");
        (tusdOut, goldOut) = _redeemable(shares);
        require(tusdOut >= tusdMin && goldOut >= goldMin, "pool: slippage");

        _burn(msg.sender, shares);
        _tusdReserve -= tusdOut;
        _goldReserve -= goldOut;
        tusd.safeTransfer(msg.sender, tusdOut);
        tgold.safeTransfer(msg.sender, goldOut);
        emit LiquidityRemoved(msg.sender, tusdOut, goldOut, shares);
    }

    function swap(Asset assetIn, uint256 amountIn, uint256 minOut)
        external
        override
        nonReentrant
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "pool: zero in");
        amountOut = quoteSwap(assetIn, amountIn);
        require(amountOut > 0, "pool: zero out");
        require(amountOut >= minOut, "pool: slippage");

        if (assetIn == Asset.TUSD) {
            _tusdReserve += amountIn;
            _goldReserve -= amountOut;
            tusd.safeTransferFrom(msg.sender, address(this), amountIn);
            tgold.safeTransfer(msg.sender, amountOut);
        } else {
            _goldReserve += amountIn;
            _tusdReserve -= amountOut;
            tgold.safeTransferFrom(msg.sender, address(this), amountIn);
            tusd.safeTransfer(msg.sender, amountOut);
        }
        emit Swapped(msg.sender, assetIn, amountIn, amountOut);
    }

    function reserves() external view override returns (uint256, uint256) {
        return (_tusdReserve, _goldReserve);
    }

    function quoteSwap(Asset assetIn, uint256 amountIn) public view override returns (uint256) {
        (uint256 rIn, uint256 rOut) =
            assetIn == Asset.TUSD ? (_tusdReserve, _goldReserve) : (_goldReserve, _tusdReserve);
        if (rIn == 0 || rOut == 0) return 0;
        uint256 inAfterFee = amountIn * (10000 - FEE_BPS);
        return (inAfterFee * rOut) / (rIn * 10000 + inAfterFee);
    }

    function positionOf(address provider)
        external
        view
        override
        returns (uint256 shares, uint256 tusdValue, uint256 goldValue)
    {
        shares = balanceOf(provider);
        if (shares > 0) (tusdValue, goldValue) = _redeemable(shares);
    }

    function _redeemable(uint256 shares) private view returns (uint256, uint256) {
        uint256 supply = totalSupply();
        return ((shares * _tusdReserve) / supply, (shares * _goldReserve) / supply);
    }
}
