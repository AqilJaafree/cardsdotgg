// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Deck} from "@shared/Types.sol";
import {IYieldEscrow} from "@shared/IYieldEscrow.sol";
import {IDeckVault} from "@shared/IDeckVault.sol";
import {IRateOracle} from "@shared/IRateOracle.sol";

/// Holds the tUSD reserve and each deck's yield. Never holds principal.
/// tUSD balance == reserve + sum of balances + sum of locked stakes.
contract YieldEscrow is IYieldEscrow, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant YEAR_BPS = 10000 * 365 days;

    IERC20 public immutable tusd;
    IDeckVault public immutable vault;
    IRateOracle public immutable oracle;
    address public arena;
    address public router;

    uint256 public override reserve;
    mapping(uint256 => uint256) public balanceOf;
    mapping(uint256 => uint256) public override locked;
    mapping(uint256 => uint256) public override seededTotal;
    mapping(uint256 => uint256) private _lastCumulative;

    constructor(address owner_, IERC20 tusd_, IDeckVault vault_, IRateOracle oracle_) Ownable(owner_) {
        tusd = tusd_;
        vault = vault_;
        oracle = oracle_;
    }

    function wire(address arena_, address router_) external onlyOwner {
        require(arena == address(0), "wired");
        arena = arena_;
        router = router_;
    }

    function fundReserve(uint256 amount) external {
        reserve += amount;
        tusd.safeTransferFrom(msg.sender, address(this), amount);
    }

    function register(uint256 deckId) external {
        require(msg.sender == address(vault), "not vault");
        _lastCumulative[deckId] = oracle.cumulativeOf(vault.getDeck(deckId).tier);
    }

    function accrue(uint256 deckId) public {
        Deck memory d = vault.getDeck(deckId);
        if (d.owner == address(0) || d.retired) return;
        uint256 cumulative = oracle.cumulativeOf(d.tier);
        uint256 pending = _pending(deckId, d, cumulative);
        _lastCumulative[deckId] = cumulative;
        uint256 paid = pending > reserve ? reserve : pending;
        if (paid < pending) emit ReserveShort(deckId, pending - paid); // D12
        reserve -= paid;
        balanceOf[deckId] += paid;
    }

    function available(uint256 deckId) public view override returns (uint256) {
        Deck memory d = vault.getDeck(deckId);
        if (d.owner == address(0) || d.retired) return balanceOf[deckId];
        uint256 pending = _pending(deckId, d, oracle.cumulativeOf(d.tier));
        return balanceOf[deckId] + (pending > reserve ? reserve : pending);
    }

    function _pending(uint256 deckId, Deck memory d, uint256 cumulative) private view returns (uint256) {
        return (d.depositValueUsd * (cumulative - _lastCumulative[deckId])) / YEAR_BPS;
    }

    function seedEscrow(uint256 deckId, uint256 amount) external override onlyOwner {
        Deck memory d = vault.getDeck(deckId);
        require(d.owner != address(0) && !d.retired, "deck");
        accrue(deckId);
        require(amount <= reserve, "reserve");
        reserve -= amount;
        balanceOf[deckId] += amount;
        seededTotal[deckId] += amount;
        emit EscrowSeeded(deckId, amount);
    }

    function lock(uint256 deckId, uint256 matchId, uint256 amount) external {
        require(msg.sender == arena, "not arena");
        require(locked[deckId] == 0, "stake active");
        accrue(deckId);
        balanceOf[deckId] -= amount;
        locked[deckId] = amount;
        emit StakeLocked(deckId, matchId, amount);
    }

    function release(uint256 deckId, uint256 matchId) external {
        require(msg.sender == arena, "not arena");
        uint256 amount = locked[deckId];
        locked[deckId] = 0;
        balanceOf[deckId] += amount;
        emit StakeReleased(deckId, matchId, amount);
    }

    /// Winner keeps their own stake and gets 95% of the loser's. 5% goes to Arena's prize pool (D5).
    function settle(uint256 winnerDeck, uint256 loserDeck, uint256 matchId) external returns (uint256 prize) {
        require(msg.sender == arena, "not arena");
        uint256 own = locked[winnerDeck];
        uint256 lost = locked[loserDeck];
        locked[winnerDeck] = 0;
        locked[loserDeck] = 0;
        prize = (lost * 5) / 100;
        balanceOf[winnerDeck] += own + lost - prize;
        emit StakeReleased(winnerDeck, matchId, own + lost - prize);
        emit StakeReleased(loserDeck, matchId, 0);
        tusd.safeTransfer(arena, prize);
    }

    /// Router only, on full withdraw.
    function drain(uint256 deckId, address to) external returns (uint256 amount) {
        require(msg.sender == router, "not router");
        require(locked[deckId] == 0, "stake locked");
        accrue(deckId);
        amount = balanceOf[deckId];
        balanceOf[deckId] = 0;
        tusd.safeTransfer(to, amount);
    }
}
