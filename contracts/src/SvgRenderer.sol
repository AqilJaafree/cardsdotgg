// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {CardData} from "./engine/CardData.sol";

/// Onchain SVG deck card: tier-coloured frame, asset icon, name and stats. No external images.
library SvgRenderer {
    using Strings for uint256;

    function tierName(uint8 tier) internal pure returns (string memory) {
        return tier == 0 ? "Guardian" : tier == 1 ? "Balanced" : "Degen";
    }

    function _color(uint8 tier) private pure returns (string memory) {
        return tier == 0 ? "#3b82f6" : tier == 1 ? "#d9a441" : "#ef4444";
    }

    function _icon(bool gold) private pure returns (string memory) {
        return gold
            ? '<polygon points="340,28 372,28 382,52 330,52" fill="#d9a441"/>'
            : '<circle cx="356" cy="40" r="16" fill="#22c55e"/>';
    }

    function _row(uint8 id, uint256 y) private pure returns (string memory) {
        (uint8 hp, uint8 atk, uint8 def, uint8 spd) = CardData.stats(id);
        string memory ys = y.toString();
        return string.concat(
            '<text x="24" y="', ys, '" class="n">', CardData.name(id), '</text><text x="376" y="', ys,
            '" class="s" text-anchor="end">',
            string.concat(
                uint256(hp).toString(), " / ", uint256(atk).toString(), " / ", uint256(def).toString(), " / ",
                uint256(spd).toString()
            ),
            "</text>"
        );
    }

    function render(uint256 deckId, uint8 tier, bool gold, bool retired) internal pure returns (string memory svg) {
        string memory color = _color(tier);
        svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><style>',
            ".t{font:700 22px sans-serif;fill:#fff}.m{font:12px sans-serif;fill:#a1a1aa}",
            ".n{font:14px sans-serif;fill:#fff}.s{font:12px monospace;fill:#d4d4d8}</style>",
            '<rect width="400" height="400" rx="20" fill="#18181b"/><rect x="6" y="6" width="388" height="388" rx="16" fill="none" stroke-width="6" stroke="',
            color, '"/>', _icon(gold)
        );
        svg = string.concat(
            svg, '<text x="24" y="46" class="t">', tierName(tier), " Deck</text>",
            '<text x="24" y="70" class="m">#', deckId.toString(),
            retired ? " retired" : gold ? " tGOLD" : " tUSD",
            '</text><text x="376" y="84" class="m" text-anchor="end">HP / ATK / DEF / SPD</text>'
        );
        for (uint256 i = 0; i < 8; i++) {
            svg = string.concat(svg, _row(uint8(uint256(tier) * 8 + i), 116 + i * 36));
        }
        svg = string.concat(svg, "</svg>");
    }
}
