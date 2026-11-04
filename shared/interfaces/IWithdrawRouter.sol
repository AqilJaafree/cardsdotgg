// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Asset} from "./Types.sol";

interface IWithdrawRouter {
    event Withdrawn(uint256 indexed deckId, address indexed owner, Asset exitAsset, uint256 principalOut, uint256 escrowOut);
    /// Both values are in exitAsset units, converted at the oracle gold price where needed.
    function quote(uint256 deckId, Asset exitAsset) external view returns (uint256 principalOut, uint256 escrowOut);
    /// Full withdraw only (D7). Reverts while a stake is locked. minOut applies to principalOut + escrowOut.
    function withdraw(uint256 deckId, Asset exitAsset, uint256 minOut) external;
}
