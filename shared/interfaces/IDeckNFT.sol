// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDeckNFT {
    /// tokenId == deckId. data:application/json;base64 with an onchain SVG image. Non-transferable while active.
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function ownerOf(uint256 tokenId) external view returns (address);
}
