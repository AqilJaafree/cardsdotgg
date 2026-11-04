// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Tier} from "@shared/Types.sol";
import {IRateOracle} from "@shared/IRateOracle.sol";

/// Keeper-written tier APRs and gold price. Constructor values are deployer-set; the first keeper
/// write skips the step cap (D9) but still clamps.
contract RateOracle is IRateOracle, Ownable {
    uint16 public constant MAX_BPS = 5000;
    uint16 public constant STEP_BPS = 200;
    uint64 public constant STALE_AFTER = 24 hours;

    address public keeper;
    bool public keeperHasWritten;
    uint64 public mainnetBlock;
    uint64 public override lastUpdate;
    uint256 public override goldPrice;

    uint16[3] private _rates;
    uint256[3] private _cumulative;
    uint64 private _cumulativeAt;

    error NotKeeper();

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    constructor(address owner_, address keeper_, uint16[3] memory rates, uint256 goldPrice_) Ownable(owner_) {
        require(goldPrice_ > 0, "gold price");
        keeper = keeper_;
        for (uint256 i = 0; i < 3; i++) _rates[i] = rates[i] > MAX_BPS ? MAX_BPS : rates[i];
        goldPrice = goldPrice_;
        lastUpdate = uint64(block.timestamp);
        _cumulativeAt = uint64(block.timestamp);
    }

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
    }

    function setRates(uint16 guardianBps, uint16 balancedBps, uint16 degenBps, uint64 mainnetBlock_)
        external
        override
        onlyKeeper
    {
        uint256 elapsed = block.timestamp - _cumulativeAt;
        uint16[3] memory incoming = [guardianBps, balancedBps, degenBps];
        for (uint256 i = 0; i < 3; i++) {
            _cumulative[i] += uint256(_rates[i]) * elapsed;
            _rates[i] = _next(_rates[i], incoming[i]);
        }
        _cumulativeAt = uint64(block.timestamp);
        keeperHasWritten = true;
        lastUpdate = uint64(block.timestamp);
        mainnetBlock = mainnetBlock_;
        emit RatesSet(_rates[0], _rates[1], _rates[2], mainnetBlock_);
    }

    function _next(uint16 current, uint16 incoming) private view returns (uint16) {
        uint16 target = incoming > MAX_BPS ? MAX_BPS : incoming;
        if (!keeperHasWritten) return target;
        if (target > current + STEP_BPS) return current + STEP_BPS;
        if (current > STEP_BPS && target < current - STEP_BPS) return current - STEP_BPS;
        return target;
    }

    function setGoldPrice(uint256 usdPerGold1e6) external override onlyKeeper {
        require(usdPerGold1e6 > 0, "gold price");
        goldPrice = usdPerGold1e6;
    }

    function rateOf(Tier tier) external view override returns (uint16) {
        return _rates[uint8(tier)];
    }

    function isStale() external view override returns (bool) {
        return block.timestamp > lastUpdate + STALE_AFTER;
    }

    function cumulativeOf(Tier tier) external view override returns (uint256) {
        uint256 i = uint8(tier);
        return _cumulative[i] + uint256(_rates[i]) * (block.timestamp - _cumulativeAt);
    }
}
