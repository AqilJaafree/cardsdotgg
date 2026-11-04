// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Asset, Deck} from "@shared/Types.sol";
import {IWithdrawRouter} from "@shared/IWithdrawRouter.sol";
import {IRateOracle} from "@shared/IRateOracle.sol";
import {DeckVault} from "./DeckVault.sol";
import {YieldEscrow} from "./YieldEscrow.sol";

/// Full withdraw to tUSD or tGOLD at the oracle gold price. Holds both tokens as conversion liquidity.
contract WithdrawRouter is IWithdrawRouter {
    using SafeERC20 for IERC20;

    IERC20 public immutable tusd;
    IERC20 public immutable tgold;
    DeckVault public immutable vault;
    YieldEscrow public immutable escrow;
    IRateOracle public immutable oracle;

    constructor(IERC20 tusd_, IERC20 tgold_, DeckVault vault_, YieldEscrow escrow_, IRateOracle oracle_) {
        tusd = tusd_;
        tgold = tgold_;
        vault = vault_;
        escrow = escrow_;
        oracle = oracle_;
    }

    function quote(uint256 deckId, Asset exitAsset)
        public
        view
        override
        returns (uint256 principalOut, uint256 escrowOut)
    {
        Deck memory d = vault.getDeck(deckId);
        uint256 price = oracle.goldPrice();
        uint256 escrowTusd = escrow.available(deckId);
        if (exitAsset == Asset.TUSD) {
            principalOut = d.asset == Asset.TUSD ? d.principal : (d.principal * price) / 1e18;
            escrowOut = escrowTusd;
        } else {
            principalOut = d.asset == Asset.TGOLD ? d.principal : (d.principal * 1e18) / price;
            escrowOut = (escrowTusd * 1e18) / price;
        }
    }

    function withdraw(uint256 deckId, Asset exitAsset, uint256 minOut) external override {
        Deck memory d = vault.getDeck(deckId);
        require(d.owner == msg.sender, "not deck owner");
        require(!d.retired, "retired");
        require(escrow.locked(deckId) == 0, "stake locked");

        (uint256 principalOut, uint256 escrowOut) = quote(deckId, exitAsset);
        require(principalOut + escrowOut >= minOut, "slippage");

        escrow.drain(deckId, address(this));
        vault.retire(deckId, address(this));
        (exitAsset == Asset.TUSD ? tusd : tgold).safeTransfer(msg.sender, principalOut + escrowOut);
        emit Withdrawn(deckId, msg.sender, exitAsset, principalOut, escrowOut);
    }
}
