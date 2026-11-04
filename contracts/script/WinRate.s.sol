// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {BattleEngine} from "../src/engine/BattleEngine.sol";

/// Win rates per pairing over seeded matches. A draw counts as half a win (D13). Sides alternate.
contract WinRate is Script {
    uint256 MATCHES;

    function run() external {
        MATCHES = vm.envOr("MATCHES", uint256(1000));
        BattleEngine engine = new BattleEngine();
        string[3] memory names = ["Guardian", "Balanced", "Degen"];
        string memory md = string.concat(
            "# Balance report\n\nFoundry script, ", vm.toString(MATCHES),
            " matches per pairing, sides alternating. A draw counts as half a win (D13).\n\n",
            "| Pairing | First deck win rate | Draws | Round-15 finishes | Average rounds |\n| --- | --- | --- | --- | --- |\n"
        );
        for (uint8 x = 0; x < 3; x++) {
            for (uint8 y = x; y < 3; y++) {
                uint256 halfWins;
                uint256 draws;
                uint256 full;
                uint256 totalRounds;
                for (uint256 i = 0; i < MATCHES; i++) {
                    bytes32 seed = keccak256(abi.encode(x, y, i));
                    bool flip = i % 2 == 1;
                    (uint8 w, uint8 r,,) = flip ? engine.simulate(seed, y, x) : engine.simulate(seed, x, y);
                    if (w == 2) {
                        halfWins += 1;
                        draws++;
                    } else if ((w == 0) != flip) {
                        halfWins += 2;
                    }
                    if (r == 15) full++;
                    totalRounds += r;
                }
                uint256 tenths = (halfWins * 1000) / (2 * MATCHES);
                string memory row = string.concat(
                    "| ", names[x], " vs ", names[y], " | ", _pct(tenths), " | ", vm.toString(draws), " | ",
                    vm.toString(full), " | ", _pct(totalRounds * 10 / MATCHES), " |\n"
                );
                console2.log(row);
                md = string.concat(md, row);
            }
        }
        vm.writeFile("../docs/agents/balance-report.md", md);
    }

    function _pct(uint256 tenths) internal pure returns (string memory) {
        return string.concat(vm.toString(tenths / 10), ".", vm.toString(tenths % 10));
    }
}
