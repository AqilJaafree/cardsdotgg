// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Deck, Match, MatchStatus} from "@shared/Types.sol";
import {IArena} from "@shared/IArena.sol";
import {IBattleEngine} from "@shared/IBattleEngine.sol";
import {IDeckVault} from "@shared/IDeckVault.sol";
import {YieldEscrow} from "./YieldEscrow.sol";
import {Elo} from "./libs/Elo.sol";

/// Challenges, seed, battle, stakes and Elo. The seed uses a future block hash: prototype-only randomness (D16).
contract Arena is IArena {
    uint256 public constant CHALLENGE_TTL = 1 hours;
    uint32 public constant START_RATING = 500;

    IBattleEngine public immutable engine;
    IDeckVault public immutable vault;
    YieldEscrow public immutable escrow;

    uint256 public override matchCount;
    uint256 public override prizePool;
    mapping(uint256 => Match) private _matches;
    mapping(uint256 => uint64) public override seedBlockOf;
    mapping(uint256 => address) public override opponentOf;
    mapping(address => uint32) private _ratingPlusOne; // 0 = never played

    constructor(IBattleEngine engine_, IDeckVault vault_, YieldEscrow escrow_) {
        engine = engine_;
        vault = vault_;
        escrow = escrow_;
    }

    function stakeFor(uint256 deckId) public view override returns (uint256) {
        return vault.getDeck(deckId).depositValueUsd / 1000;
    }

    function createChallenge(uint256 deckId, address opponent) external override returns (uint256 matchId) {
        _requireOwnedActive(deckId);
        require(opponent != msg.sender, "self");
        matchId = ++matchCount;
        Match storage m = _matches[matchId];
        m.deckA = deckId;
        m.playerA = msg.sender;
        m.status = MatchStatus.Open;
        m.createdAt = uint64(block.timestamp);
        opponentOf[matchId] = opponent;

        uint256 stake = stakeFor(deckId);
        if (escrow.available(deckId) >= stake) {
            m.stakeA = stake;
            escrow.lock(deckId, matchId, stake);
        }
        emit ChallengeCreated(matchId, deckId, opponent);
    }

    function accept(uint256 matchId, uint256 deckId) external override {
        Match storage m = _matches[matchId];
        require(m.status == MatchStatus.Open && m.playerA != address(0), "not open");
        require(block.timestamp < m.createdAt + CHALLENGE_TTL, "expired");
        require(msg.sender != m.playerA, "own challenge");
        address opponent = opponentOf[matchId];
        require(opponent == address(0) || opponent == msg.sender, "not opponent");
        _requireOwnedActive(deckId);
        require(!vault.getDeck(m.deckA).retired, "challenger retired");

        m.deckB = deckId;
        m.playerB = msg.sender;
        m.status = MatchStatus.AwaitingSeed;
        seedBlockOf[matchId] = uint64(block.number + 1);

        uint256 stake = stakeFor(deckId);
        bool staked = m.stakeA > 0 && escrow.available(deckId) >= stake;
        if (staked) {
            m.stakeB = stake;
            escrow.lock(deckId, matchId, stake);
        } else if (m.stakeA > 0) {
            m.stakeA = 0; // D4: either player short means Rank-only
            escrow.release(m.deckA, matchId);
        }
        emit ChallengeAccepted(matchId, deckId, staked);
    }

    function resolve(uint256 matchId) external override {
        Match storage m = _matches[matchId];
        require(m.status == MatchStatus.AwaitingSeed, "not awaiting seed");
        uint64 seedBlock = seedBlockOf[matchId];
        require(block.number > seedBlock, "seed pending");
        bytes32 hash = blockhash(seedBlock);
        if (hash == bytes32(0)) {
            uint64 nextBlock = uint64(block.number + 1);
            seedBlockOf[matchId] = nextBlock;
            emit SeedRearmed(matchId, nextBlock);
            return;
        }

        bytes32 seed = keccak256(abi.encode(matchId, m.deckA, m.deckB, hash));
        m.seed = seed;
        emit SeedSet(matchId, seed);

        uint8 tierA = uint8(vault.getDeck(m.deckA).tier);
        uint8 tierB = uint8(vault.getDeck(m.deckB).tier);
        (uint8 side, uint8 rounds, uint16 shareA, uint16 shareB) = engine.simulate(seed, tierA, tierB);

        m.status = MatchStatus.Resolved;
        m.winner = side == 0 ? m.playerA : side == 1 ? m.playerB : address(0);

        if (m.stakeA > 0) _settleStakes(m, matchId, side);
        _updateRatings(matchId, m.playerA, m.playerB, side);
        emit MatchResolved(matchId, m.winner, seed, rounds, shareA, shareB);
    }

    function expire(uint256 matchId) external override {
        Match storage m = _matches[matchId];
        require(m.status == MatchStatus.Open && m.playerA != address(0), "not open");
        require(block.timestamp >= m.createdAt + CHALLENGE_TTL, "too early");
        m.status = MatchStatus.Expired;
        if (m.stakeA > 0) escrow.release(m.deckA, matchId);
        emit MatchExpired(matchId);
    }

    function getMatch(uint256 matchId) external view override returns (Match memory) {
        return _matches[matchId];
    }

    function ratingOf(address player) public view override returns (uint32) {
        uint32 stored = _ratingPlusOne[player];
        return stored == 0 ? START_RATING : stored - 1;
    }

    function _requireOwnedActive(uint256 deckId) private view {
        Deck memory d = vault.getDeck(deckId);
        require(d.owner == msg.sender, "not deck owner");
        require(!d.retired, "retired");
        require(escrow.locked(deckId) == 0, "stake active");
    }

    function _settleStakes(Match storage m, uint256 matchId, uint8 side) private {
        if (side == 2) {
            escrow.release(m.deckA, matchId);
            escrow.release(m.deckB, matchId);
            return;
        }
        (uint256 won, uint256 lost) = side == 0 ? (m.deckA, m.deckB) : (m.deckB, m.deckA);
        prizePool += escrow.settle(won, lost, matchId);
    }

    function _updateRatings(uint256 matchId, address a, address b, uint8 side) private {
        uint32 oldA = ratingOf(a);
        uint32 oldB = ratingOf(b);
        uint256 scoreA = side == 0 ? 1e6 : side == 1 ? 0 : 5e5;
        uint32 newA = Elo.next(oldA, oldB, scoreA);
        uint32 newB = Elo.next(oldB, oldA, 1e6 - scoreA);
        _ratingPlusOne[a] = newA + 1;
        _ratingPlusOne[b] = newB + 1;
        emit RatingChanged(a, matchId, oldA, newA);
        emit RatingChanged(b, matchId, oldB, newB);
    }
}
