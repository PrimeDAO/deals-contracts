// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IDaoDepositManager.sol";
import "../interfaces/IDealManager.sol";

/**
 * @title PrimeDeals Module Base
 * @dev   Smart contract to serve as the
          basis for each module
 */
contract ModuleBase {
    // Address of the DealManager implementation
    IDealManager public dealManager;

    // @notics      Status of a deal
    // NULL         Uninitialized deal
    // ACTIVE       Deal has been created and is ready to be funded
    // CANCELLED    Deal has been canceld and is no longer valid
    // DONE         Deal has been executed
    enum Status {
        NULL,
        ACTIVE,
        CANCELLED,
        DONE
    }

    /**
     * @dev                            Constructor
     * @param _dealManager             The address of DealManager implementation
     */
    constructor(address _dealManager) {
        require(
            _dealManager != address(0),
            "Module: invalid base contract address"
        );
        dealManager = IDealManager(_dealManager);
    }

    /**
      * @dev                Sends tokens from a DAO deposit manager to the module
      * @param _dealId      ID of the action this is related to
      * @param _daos        Array containing the DAOs that are involed in this action
      * @param _tokens      Array containing the tokens that are involed in this action
      * @param _path        Double nested array containing the amounts of tokens for each
                            token for each dao to be send
      * @return amountsIn   Array containing the total amounts sent per token
    */
    function _pullTokensIntoModule(
        uint32 _dealId,
        address[] memory _daos,
        address[] memory _tokens,
        uint256[][] memory _path
    ) internal returns (uint256[] memory amountsIn) {
        amountsIn = new uint256[](_tokens.length);
        require(_path.length == _tokens.length, "Module: length mismatch");
        for (uint256 i; i < _tokens.length; ++i) {
            require(_path[i].length == _daos.length, "Module: length mismatch");
            for (uint256 j; j < _path[i].length; ++j) {
                uint256 path = _path[i][j];
                if (path > 0) {
                    amountsIn[i] += path;
                    IDaoDepositManager(
                        dealManager.getDaoDepositManager(_daos[j])
                    ).sendToModule(_dealId, _tokens[i], path);
                }
            }
        }
    }

    /**
     * @dev            Calls the approval function of a token
     * @param _token   Address of the token
     * @param _to      Target of the approval
     * @param _amount  Amount to be approved
     */
    function _approveToken(
        address _token,
        address _to,
        uint256 _amount
    ) internal {
        require(IERC20(_token).approve(_to, _amount), "Module: approve failed");
    }

    /**
     * @dev            Calls the approval function of a token
                       for the deposit manager of a DAO
     * @param _token   Address of the token
     * @param _dao     DAO whose deposit manager is the target
     * @param _amount  Amount to be approved
     */
    function _approveDaoDepositManager(
        address _token,
        address _dao,
        uint256 _amount
    ) internal {
        _approveToken(_token, dealManager.getDaoDepositManager(_dao), _amount);
    }

    /**
     * @dev            Transfers an amount of tokens
     * @param _token   Address of the token
     * @param _to      Target of the transfer
     * @param _amount  Amount to be sent
     */
    function _transferToken(
        address _token,
        address _to,
        uint256 _amount
    ) internal {
        try IERC20(_token).transfer(_to, _amount) returns (bool success) {
            require(success, "Module: transfer was not successful");
        } catch {
            revert("Module: transfer failed");
        }
    }

    /**
     * @dev            Transfers an amount of tokens from an address
     * @param _token   Address of the token
     * @param _from    Source of the transfer
     * @param _to      Target of the transfer
     * @param _amount  Amount to be sent
     */
    function _transferFromToken(
        address _token,
        address _from,
        address _to,
        uint256 _amount
    ) internal {
        try IERC20(_token).transferFrom(_from, _to, _amount) returns (
            bool success
        ) {
            require(success, "Module: transferFrom was not successful");
        } catch {
            revert("Module: transferFrom failed");
        }
    }

    function hasDealExpired(uint32 _dealId)
        external
        view
        virtual
        returns (bool)
    {}
}
