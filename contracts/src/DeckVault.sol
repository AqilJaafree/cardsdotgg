// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Tier, Asset, Deck} from "@shared/Types.sol";
import {IDeckVault} from "@shared/IDeckVault.sol";
import {IRateOracle} from "@shared/IRateOracle.sol";

interface IVaultEscrow {
    function register(uint256 deckId) external;
    function accrue(uint256 deckId) external;
}

interface IVaultNFT {
    function mint(address to, uint256 deckId) external;
    function retire(uint256 deckId) external;
}

/// Holds principal. Only the router can move it, and only by retiring the deck on a full withdraw.
contract DeckVault is IDeckVault, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant override MIN_DEPOSIT_USD = 10e6;
    uint256 public constant override MAX_DECKS = 5;

    IERC20 public immutable tusd;
    IERC20 public immutable tgold;
    IRateOracle public immutable oracle;
    IVaultEscrow public escrow;
    IVaultNFT public nft;
    address public router;

    uint256 public deckCount;
    uint256[2] public totalPrincipal; // per Asset
    mapping(uint256 => Deck) private _decks;
    mapping(address => uint256[]) private _owned;
    mapping(address => uint256) public activeDecks;

    constructor(address owner_, IERC20 tusd_, IERC20 tgold_, IRateOracle oracle_) Ownable(owner_) {
        tusd = tusd_;
        tgold = tgold_;
        oracle = oracle_;
    }

    function wire(IVaultEscrow escrow_, IVaultNFT nft_, address router_) external onlyOwner {
        require(address(escrow) == address(0), "wired");
        escrow = escrow_;
        nft = nft_;
        router = router_;
    }

    function deposit(Asset asset, uint256 amount, Tier tier) external override returns (uint256 deckId) {
        require(activeDecks[msg.sender] < MAX_DECKS, "max decks");
        uint256 value = asset == Asset.TUSD ? amount : (amount * oracle.goldPrice()) / 1e18;
        require(value >= MIN_DEPOSIT_USD, "below minimum");

        deckId = ++deckCount;
        _decks[deckId] = Deck(msg.sender, tier, asset, amount, value, uint64(block.timestamp), false);
        _owned[msg.sender].push(deckId);
        activeDecks[msg.sender]++;
        totalPrincipal[uint8(asset)] += amount;

        _token(asset).safeTransferFrom(msg.sender, address(this), amount);
        escrow.register(deckId);
        nft.mint(msg.sender, deckId);
        emit DeckMinted(deckId, msg.sender, tier, asset, amount);
    }

    /// Router only. Pays principal to the router and retires the deck.
    function retire(uint256 deckId, address to) external returns (uint256 principal) {
        require(msg.sender == router, "not router");
        Deck storage d = _decks[deckId];
        require(!d.retired, "retired");
        principal = d.principal;
        d.principal = 0;
        d.retired = true;
        activeDecks[d.owner]--;
        totalPrincipal[uint8(d.asset)] -= principal;
        nft.retire(deckId);
        _token(d.asset).safeTransfer(to, principal);
        emit DeckRetired(deckId);
    }

    function checkpoint(uint256 deckId) external override {
        escrow.accrue(deckId);
    }

    function getDeck(uint256 deckId) external view override returns (Deck memory) {
        return _decks[deckId];
    }

    function decksOf(address owner_) external view override returns (uint256[] memory) {
        return _owned[owner_];
    }

    function _token(Asset asset) private view returns (IERC20) {
        return asset == Asset.TUSD ? tusd : tgold;
    }
}
