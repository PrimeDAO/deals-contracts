// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

interface IModuleBase {
    function moduleIdentifier() external view returns (bytes32);

    function baseContract() external view returns (address);
}
