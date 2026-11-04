// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Fixed-point Elo, K = 32, floor 0. 10^(d/400) comes from a 25-point lookup with linear interpolation.
library Elo {
    uint256 internal constant ONE = 1e6;
    int256 internal constant K = 32;

    function _pow(uint256 gap) private pure returns (uint256) {
        uint32[33] memory t = [uint32(1000000), 1154782, 1333521, 1539927, 1778279, 2053525, 2371374, 2738420, 3162278, 3651741, 4216965, 4869675, 5623413, 6493816, 7498942, 8659643, 10000000, 11547820, 13335214, 15399265, 17782794, 20535250, 23713737, 27384196, 31622777, 36517413, 42169650, 48696753, 56234133, 64938163, 74989421, 86596432, 100000000];
        uint256 i = gap / 25;
        if (i >= 32) return t[32];
        return t[i] + ((uint256(t[i + 1]) - t[i]) * (gap % 25)) / 25;
    }

    /// Expected score of a player against an opponent, scaled by 1e6. Gap clamps to +/-800.
    function expected(uint32 player, uint32 opponent) internal pure returns (uint256) {
        if (opponent >= player) {
            uint256 gap = opponent - player;
            if (gap > 800) gap = 800;
            return (ONE * ONE) / (ONE + _pow(gap));
        }
        uint256 g = player - opponent;
        if (g > 800) g = 800;
        return ONE - (ONE * ONE) / (ONE + _pow(g));
    }

    /// score is 1e6 win, 5e5 draw, 0 loss. Rounds to the nearest point.
    function next(uint32 player, uint32 opponent, uint256 score) internal pure returns (uint32) {
        int256 d = K * (int256(score) - int256(expected(player, opponent)));
        d = d >= 0 ? (d + 500000) / 1000000 : (d - 500000) / 1000000;
        int256 r = int256(uint256(player)) + d;
        return r < 0 ? 0 : uint32(uint256(r));
    }
}
