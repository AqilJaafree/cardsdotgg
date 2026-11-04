// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Tier, Asset, Deck} from "./Types.sol";

interface IDeckVault {
    event DeckMinted(uint256 indexed deckId, address indexed owner, Tier tier, Asset asset, uint256 principal);
    event DeckRetired(uint256 indexed deckId);
    /// Caller must approve this vault for `amount` first. Minimum is 10 tUSD of value at the oracle price.
    function deposit(Asset asset, uint256 amount, Tier tier) external returns (uint256 deckId);
    function getDeck(uint256 deckId) external view returns (Deck memory);
    /// Includes retired decks; filter on Deck.retired.
    function decksOf(address owner) external view returns (uint256[] memory);
    function checkpoint(uint256 deckId) external;
    function MIN_DEPOSIT_USD() external view returns (uint256);
    function MAX_DECKS() external view returns (uint256);
}
