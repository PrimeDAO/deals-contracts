//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

interface IDepositContract {
    function initialize(address _dao) external;

    function migrateBaseContract(address _newBaseContract) external;

    function deposit(
        bytes32 _processID,
        address _token,
        uint256 _amount
    ) external payable;

    function multipleDeposits(
        bytes32 _processID,
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external payable;

    function registerDeposit(bytes32 _processID, address _token) external;

    function registerDeposits(bytes32 _processID, address[] calldata _tokens)
        external;

    function withdraw(
        bytes32 _processID,
        uint256 _depositID,
        address _sender
    )
        external
        returns (
            address,
            address,
            uint256
        );

    function sendToModule(
        bytes32 _processID,
        address _token,
        uint256 _amount
    ) external returns (bool);

    function startVesting(
        bytes32 _actionId,
        address _token,
        uint256 _amount,
        uint256 _start,
        uint256 _end
    ) external;

    function claimVestings() external;

    function verifyBalance(address _token) external view;

    function getDeposit(bytes32 _processID, uint256 _depositID)
        external
        view
        returns (
            address,
            address,
            uint256,
            uint256,
            uint256
        );

    function getAvailableProcessBalance(bytes32 _processID, address _token)
        external
        view
        returns (uint256);

    function getTotalDepositCount(bytes32 _processID)
        external
        view
        returns (uint256);

    function getWithdrawableAmountOfUser(
        bytes32 _processID,
        address _user,
        address _token
    ) external view returns (uint256);

    function getBalance(address _token) external view returns (uint256);

    function getVestedBalance(address _token) external view returns (uint256);

    function getProcessID(string memory _module, uint256 _id)
        external
        pure
        returns (bytes32);
}
