// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

interface IBaseContract {
    function createDepositContract(address _dao) external;

    function hasDepositContract(address _dao) external view returns (bool);

    function getDepositContract(address _dao) external view returns (address);

    function isDAOorOwner(address _caller, address _dao)
        external
        view
        returns (bool);

    function isDAOorOwnerFromArray(
        address _caller,
        address[] calldata _involvedDAOs
    ) external view returns (bool);

    function owner() external view returns (address);

    function weth() external view returns (address);

    function addressIsModule(address _address) external view returns (bool);
}
