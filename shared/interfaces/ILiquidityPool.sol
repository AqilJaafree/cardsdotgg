// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Asset} from "./Types.sol";

/// tUSD/tGOLD constant-product pool. The pool contract is also the LP share ERC-20 (12 decimals).
/// Swap fees stay in the reserves, so they raise the value of every share. Caller approves both tokens to the pool.
interface ILiquidityPool {
    event LiquidityAdded(address indexed provider, uint256 tusdIn, uint256 goldIn, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 tusdOut, uint256 goldOut, uint256 shares);
    event Swapped(address indexed trader, Asset assetIn, uint256 amountIn, uint256 amountOut);

    function addLiquidity(uint256 tusdDesired, uint256 goldDesired, uint256 tusdMin, uint256 goldMin)
        external returns (uint256 tusdIn, uint256 goldIn, uint256 shares);
    function removeLiquidity(uint256 shares, uint256 tusdMin, uint256 goldMin)
        external returns (uint256 tusdOut, uint256 goldOut);
    function swap(Asset assetIn, uint256 amountIn, uint256 minOut) external returns (uint256 amountOut);

    function reserves() external view returns (uint256 tusd, uint256 gold);
    function quoteSwap(Asset assetIn, uint256 amountIn) external view returns (uint256 amountOut);
    /// What an address's shares redeem for right now.
    function positionOf(address provider) external view returns (uint256 shares, uint256 tusd, uint256 gold);
    function FEE_BPS() external view returns (uint256);
}
