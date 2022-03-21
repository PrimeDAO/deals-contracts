//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

interface IDepositContract {
    function initialize(address _dao) external;

    function migrateBaseContract(address _newBaseContract) external;

    function deposit(
        address _dealModule,
        uint256 _dealId,
        address _token,
        uint256 _amount
    ) external payable;

    function multipleDeposits(
        address _dealModule,
        uint256 _dealId,
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external payable;

    function registerDeposit(
        address _dealModule,
        uint256 _dealId,
        address _token
    ) external;

    function registerDeposits(
        address _dealModule,
        uint256 _dealId,
        address[] calldata _tokens
    ) external;

    function withdraw(
        address _dealModule,
        uint256 _dealId,
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
        uint256 _dealId,
        address _token,
        uint256 _amount
    ) external returns (bool);

    function startVesting(
        uint256 _dealId,
        address _token,
        uint256 _amount,
        uint256 _start,
        uint256 _end
    ) external;

    function claimVestings() external;

    function verifyBalance(address _token) external view;

    function getDeposit(
        address _dealModule,
        uint256 _dealId,
        uint256 _depositID
    )
        external
        view
        returns (
            address,
            address,
            uint256,
            uint256,
            uint256
        );

    function getAvailableDealBalance(
        address _dealModule,
        uint256 _dealId,
        address _token
    ) external view returns (uint256);

    function getTotalDepositCount(address _dealModule, uint256 _dealId)
        external
        view
        returns (uint256);

    function getWithdrawableAmountOfUser(
        address _dealModule,
        uint256 _dealId,
        address _user,
        address _token
    ) external view returns (uint256);

    function getBalance(address _token) external view returns (uint256);

    function getVestedBalance(address _token) external view returns (uint256);

    function getProcessID(address _module, uint256 _id)
        external
        pure
        returns (bytes32);
}
