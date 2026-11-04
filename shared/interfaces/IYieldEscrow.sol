// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IYieldEscrow {
    event StakeLocked(uint256 indexed deckId, uint256 indexed matchId, uint256 amount);
    event StakeReleased(uint256 indexed deckId, uint256 indexed matchId, uint256 amount);
    event ReserveShort(uint256 indexed deckId, uint256 shortfall);
    event EscrowSeeded(uint256 indexed deckId, uint256 amount);
    function available(uint256 deckId) external view returns (uint256); // tUSD 6 decimals, includes pending accrual
    function locked(uint256 deckId) external view returns (uint256);
    function seededTotal(uint256 deckId) external view returns (uint256); // lifetime demo seed, for the UI label
    function seedEscrow(uint256 deckId, uint256 amount) external; // owner only, funded from the reserve
    function reserve() external view returns (uint256);
}
