// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// Testnet token with a public drip, once per 24 hours per address.
contract TestToken is ERC20, Ownable {
    uint8 private immutable _decimals;
    uint256 public immutable DRIP;
    mapping(address => uint256) public lastClaim;

    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 drip, address owner_)
        ERC20(name_, symbol_)
        Ownable(owner_)
    {
        _decimals = decimals_;
        DRIP = drip;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function claim() external {
        uint256 last = lastClaim[msg.sender];
        require(last == 0 || block.timestamp >= last + 24 hours, "claim: wait 24h");
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, DRIP);
    }

    function nextClaimAt(address who) external view returns (uint256) {
        uint256 last = lastClaim[who];
        if (last == 0 || block.timestamp >= last + 24 hours) return 0;
        return last + 24 hours;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
