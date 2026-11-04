// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Match} from "./Types.sol";

interface IArena {
    event ChallengeCreated(uint256 indexed matchId, uint256 indexed deckA, address indexed opponent);
    event ChallengeAccepted(uint256 indexed matchId, uint256 indexed deckB, bool staked);
    event SeedSet(uint256 indexed matchId, bytes32 seed);
    event MatchResolved(uint256 indexed matchId, address winner, bytes32 seed, uint8 rounds, uint16 hpShareA, uint16 hpShareB);
    event RatingChanged(address indexed player, uint256 indexed matchId, uint32 oldRating, uint32 newRating);
    event MatchExpired(uint256 indexed matchId);
    event SeedRearmed(uint256 indexed matchId, uint64 seedBlock);

    function createChallenge(uint256 deckId, address opponent) external returns (uint256 matchId); // opponent 0 = open link
    function accept(uint256 matchId, uint256 deckId) external;
    /// Reverts until seedBlock has passed. If its hash expired (256 blocks), sets a new seedBlock
    /// and returns WITHOUT settling (emits SeedRearmed); call resolve again. Check status after.
    function resolve(uint256 matchId) external;
    /// Open challenges only, one hour after creation. Anyone can call.
    function expire(uint256 matchId) external;
    function getMatch(uint256 matchId) external view returns (Match memory);
    function ratingOf(address player) external view returns (uint32); // first read is 500
    function prizePool() external view returns (uint256);
    function matchCount() external view returns (uint256); // match IDs start at 1
    function seedBlockOf(uint256 matchId) external view returns (uint64);
    function opponentOf(uint256 matchId) external view returns (address); // 0 = open link
    function stakeFor(uint256 deckId) external view returns (uint256); // 0.1% of depositValueUsd
}
