// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Asset, Deck} from "@shared/Types.sol";
import {IDeckVault} from "@shared/IDeckVault.sol";
import {SvgRenderer} from "./SvgRenderer.sol";

/// tokenId == deckId. Non-transferable while active, because principal and escrow follow the deck owner.
contract DeckNFT is ERC721 {
    IDeckVault public immutable vault;

    constructor(IDeckVault vault_) ERC721("YieldDeck", "YDECK") {
        vault = vault_;
    }

    function mint(address to, uint256 deckId) external {
        require(msg.sender == address(vault), "not vault");
        _mint(to, deckId);
    }

    function retire(uint256 deckId) external view {
        require(msg.sender == address(vault), "not vault");
        _requireOwned(deckId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = _ownerOf(tokenId);
        require(from == address(0) || vault.getDeck(tokenId).retired, "non-transferable");
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Deck memory d = vault.getDeck(tokenId);
        uint8 tier = uint8(d.tier);
        string memory svg = SvgRenderer.render(tokenId, tier, d.asset == Asset.TGOLD, d.retired);
        string memory json = string.concat(
            '{"name":"', SvgRenderer.tierName(tier), " Deck #", Strings.toString(tokenId),
            '","description":"YieldDeck testnet deck","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)), '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }
}
