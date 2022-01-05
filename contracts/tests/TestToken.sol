//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion

    constructor() ERC20("Test Token", "TT") {
        require(totalSupply() == 0, "XGT-ALREADY-INITIALIZED");
        _mint(msg.sender, MAX_SUPPLY);
        require(totalSupply() == MAX_SUPPLY, "XGT-INVALID-SUPPLY");
    }
}
