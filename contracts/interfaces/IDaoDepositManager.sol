//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

interface IDaoDepositManager {
    function initialize(address _dao) external;

    function migrateBaseContract(address _newDaoDepositManager) external;

    function deposit(
        address _dealModule,
        uint32 _dealId,
        address _token,
        uint256 _amount
    ) external payable;

    function multipleDeposits(
        address _dealModule,
        uint32 _dealId,
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external payable;

    function registerDeposit(
        address _dealModule,
        uint32 _dealId,
        address _token
    ) external;

    function registerDeposits(
        address _dealModule,
        uint32 _dealId,
        address[] calldata _tokens
    ) external;

    function withdraw(
        address _dealModule,
        uint32 _dealId,
        uint32 _depositId,
        address _sender
    )
        external
        returns (
            address,
            address,
            uint256
        );

    function sendToModule(
        uint32 _dealId,
        address _token,
        uint256 _amount
    ) external returns (bool);

    function startVesting(
        uint32 _dealId,
        address _token,
        uint256 _amount,
        uint256 _vestingCliff,
        uint256 _vestingDuration
    ) external;

    function claimVestings() external;

    function verifyBalance(address _token) external view;

    function getDeposit(
        address _dealModule,
        uint32 _dealId,
        uint32 _depositId
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
        uint32 _dealId,
        address _token
    ) external view returns (uint256);

    function getTotalDepositCount(address _dealModule, uint32 _dealId)
        external
        view
        returns (uint256);

    function getWithdrawableAmountOfUser(
        address _dealModule,
        uint32 _dealId,
        address _user,
        address _token
    ) external view returns (uint256);

    function getBalance(address _token) external view returns (uint256);

    function getVestedBalance(address _token) external view returns (uint256);
}