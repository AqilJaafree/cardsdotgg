// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITestToken {
    function claim() external; // once per 24h per address
    function nextClaimAt(address who) external view returns (uint256); // unix seconds, 0 = claimable now
    function DRIP() external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function balanceOf(address who) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}
