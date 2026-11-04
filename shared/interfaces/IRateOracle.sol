// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Tier} from "./Types.sol";

interface IRateOracle {
    event RatesSet(uint16 guardianBps, uint16 balancedBps, uint16 degenBps, uint64 mainnetBlock);
    function setRates(uint16 guardianBps, uint16 balancedBps, uint16 degenBps, uint64 mainnetBlock) external;
    function setGoldPrice(uint256 usdPerGold1e6) external;
    function rateOf(Tier tier) external view returns (uint16 bps);
    function goldPrice() external view returns (uint256 usdPerGold1e6); // tUSD units per 1 whole tGOLD
    function lastUpdate() external view returns (uint64);
    function isStale() external view returns (bool);
    function cumulativeOf(Tier tier) external view returns (uint256); // sum of bps x seconds, for accrual
}
