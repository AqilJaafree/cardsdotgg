// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Action} from "@shared/Types.sol";
import {BattleEngine} from "../src/engine/BattleEngine.sol";

contract BattleEngineTest is Test {
    BattleEngine engine = new BattleEngine();

    function test_sameSeedSameResult() public view {
        for (uint8 a = 0; a < 3; a++) {
            for (uint8 b = 0; b < 3; b++) {
                bytes32 seed = keccak256(abi.encode(a, b));
                (uint8 w1, uint8 r1, uint16 x1, uint16 y1) = engine.simulate(seed, a, b);
                (uint8 w2, uint8 r2, uint16 x2, uint16 y2) = engine.simulate(seed, a, b);
                assertEq(w1, w2);
                assertEq(r1, r2);
                assertEq(x1, x2);
                assertEq(y1, y2);
                assertEq(
                    keccak256(abi.encode(engine.simulateWithLog(seed, a, b))),
                    keccak256(abi.encode(engine.simulateWithLog(seed, a, b)))
                );
            }
        }
    }

    function test_logAgreesWithResult() public view {
        for (uint256 i = 0; i < 30; i++) {
            bytes32 seed = keccak256(abi.encode("log", i));
            uint8 a = uint8(i % 3);
            uint8 b = uint8((i / 3) % 3);
            (, uint8 rounds,,) = engine.simulate(seed, a, b);
            Action[] memory log = engine.simulateWithLog(seed, a, b);
            assertGt(log.length, 0);
            assertLe(log[log.length - 1].round, rounds);
        }
    }

    function test_damageFormulaFloors() public view {
        assertEq(engine.baseDamage(15, 35), 176); // 15000 / 85 = 176.47
        assertEq(engine.baseDamage(44, 8), 758); // 44000 / 58 = 758.62
    }

    function test_differentSeedsDiffer() public view {
        bytes32 a = keccak256(abi.encode(engine.simulateWithLog(bytes32(uint256(1)), 2, 2)));
        bytes32 b = keccak256(abi.encode(engine.simulateWithLog(bytes32(uint256(2)), 2, 2)));
        assertTrue(a != b);
    }

    function test_worstCaseGas() public {
        uint256 worst;
        uint256 worstLog;
        for (uint256 i = 0; i < 90; i++) {
            bytes32 seed = keccak256(abi.encode("gas", i));
            uint8 a = uint8(i % 3);
            uint8 b = uint8((i / 3) % 3);
            uint256 g = gasleft();
            engine.simulate(seed, a, b);
            uint256 used = g - gasleft();
            if (used > worst) worst = used;
            g = gasleft();
            engine.simulateWithLog(seed, a, b);
            used = g - gasleft();
            if (used > worstLog) worstLog = used;
        }
        emit log_named_uint("worst simulate gas", worst);
        emit log_named_uint("worst simulateWithLog gas", worstLog);
    }
}
