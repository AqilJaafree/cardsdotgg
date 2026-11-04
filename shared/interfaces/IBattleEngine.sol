// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Action} from "./Types.sol";

interface IBattleEngine {
    function simulate(bytes32 seed, uint8 tierA, uint8 tierB)
        external pure returns (uint8 winnerSide, uint8 rounds, uint16 hpShareA, uint16 hpShareB); // 0 A, 1 B, 2 draw
    /// The app animates this from eth_call. Same rolls as simulate, so the replay is the contract's own output.
    function simulateWithLog(bytes32 seed, uint8 tierA, uint8 tierB) external pure returns (Action[] memory);
}
