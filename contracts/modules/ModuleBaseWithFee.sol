// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "./ModuleBase.sol";

/**
 * @title PrimeDeals Module Base Fee Extension
 * @dev   Smart contract to extend the module
          base with a fee mechanim
 */
contract ModuleBaseWithFee is ModuleBase {
    // Wallet that is receiving the fees
    address public feeWallet;

    // Fee in basis points (1% = 10000)
    uint32 public feeInBasisPoints;

    /**
     * @dev                         Constructor
     * @param _dealmanager         The address of DealManager implementation
     */
    constructor(address _dealmanager) ModuleBase(_dealmanager) {}

    /**
     * @notice                  This event is emitted when the fee wallet address is updated
     * @param oldFeeWallet      Address of the old fee wallet
     * @param newFeeWallet      Address of the new fee wallet
     */
    event FeeWalletChanged(
        address indexed oldFeeWallet,
        address indexed newFeeWallet
    );

    /**
     * @notice                  This event is emitted when the fee is updated
     * @param oldFee            Old fee amount in basis points (1% = 1000)
     * @param newFee            New fee in basis points (1% = 1000) that is updated
     */
    event FeeChanged(uint32 indexed oldFee, uint32 indexed newFee);

    /**
     * @dev                 Sets a new fee wallet
     * @param _feeWallet    Address of the new fee wallet
     */
    function setFeeWallet(address _feeWallet) external {
        require(msg.sender == dealManager.owner(), "Fee: not authorized");
        emit FeeWalletChanged(feeWallet, _feeWallet);
        feeWallet = _feeWallet;
    }

    /**
     * @dev                         Sets a new fee
     * @param _feeInBasisPoints     Fee amount in basis points (1% = 10000)
     */
    function setFee(uint32 _feeInBasisPoints) external {
        require(msg.sender == dealManager.owner(), "Fee: not authorized");
        require(_feeInBasisPoints <= 10000, "Fee: can't be more than 100%");
        emit FeeChanged(feeInBasisPoints, _feeInBasisPoints);
        feeInBasisPoints = _feeInBasisPoints;
    }

    /**
     * @dev             Pays the fee in a token and returns the remainder
     * @param _token    Token in which the transfer happens
     * @param _amount   Amount of the transfer
     * @return          Remaining amount after the fee payment
     */
    function _payFeeAndReturnRemainder(address _token, uint256 _amount)
        internal
        returns (uint256)
    {
        if (feeWallet != address(0) && feeInBasisPoints > 0) {
            uint256 fee = (_amount * feeInBasisPoints) / 10000;
            _transferToken(_token, feeWallet, fee);

            return _amount - fee;
        }
        return _amount;
    }

    /**
     * @dev             Transfers a token amount with automated fee payment
     * @param _token    Token in which the transfer happens
     * @param _to       Target of the transfer
     * @param _amount   Amount of the transfer
     */
    function _transferTokenWithFee(
        address _token,
        address _to,
        uint256 _amount
    ) internal {
        _transferToken(_token, _to, _payFeeAndReturnRemainder(_token, _amount));
    }

    /**
     * @dev             Transfers a token amount from someone with 
                        automated fee payment
     * @param _token    Token in which the transfer happens
     * @param _from     Source of the transfer
     * @param _to       Target of the transfer
     * @param _amount   Amount of the transfer
     */
    function _transferFromTokenWithFee(
        address _token,
        address _from,
        address _to,
        uint256 _amount
    ) internal {
        _transferFromToken(
            _token,
            _from,
            _to,
            _payFeeAndReturnRemainder(_token, _amount)
        );
    }
}
