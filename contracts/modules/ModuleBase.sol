// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IDepositContract.sol";
import "../interfaces/IBaseContract.sol";

/**
 * @title PrimeDeals Module Base
 * @dev   Smart contract to serve as the
          basis for each module
 */
contract ModuleBase {
    // String of the unique module identifier
    // e.g. TOKEN_SWAP_MODULE
    string public moduleIdentifierString;

    // keccak256 of the identifier string
    bytes32 public moduleIdentifier;

    IBaseContract public baseContract;

    enum Status {
        NULL,
        ACTIVE,
        CANCELLED,
        DONE
    }

    constructor(address _baseContract, string memory _moduleIdentifier) {
        require(
            _baseContract != address(0),
            "Module: invalid base contract address"
        );
        baseContract = IBaseContract(_baseContract);
        require(
            bytes(_moduleIdentifier).length > 0,
            "Module: module identifier invalid"
        );
        moduleIdentifierString = _moduleIdentifier;
        moduleIdentifier = keccak256(abi.encode(moduleIdentifierString));
    }

    /**
      * @dev                Sends tokens from a deposit contract to the module
      * @param _id          ID of the action this is related to
      * @param _daos        Array containing the DAOs that are involed in this action
      * @param _tokens      Array containing the tokens that are involed in this action
      * @param _path        Double nested array containing the amounts of tokens for each
                            token for each dao to be send
      * @return amountsIn   Array containing the total amounts sent per token
    */
    function _pullTokensIntoModule(
        uint256 _id,
        address[] memory _daos,
        address[] memory _tokens,
        uint256[][] memory _path
    ) internal returns (uint256[] memory amountsIn) {
        amountsIn = new uint256[](_tokens.length);

        for (uint256 i = 0; i < _tokens.length; i++) {
            require(_path[i].length == _daos.length, "Module: length mismatch");
            for (uint256 j = 0; j < _path[i].length; j++) {
                if (_path[i][j] > 0) {
                    amountsIn[i] += _path[i][j];
                    IDepositContract(baseContract.getDepositContract(_daos[j]))
                        .sendToModule(_id, _tokens[i], _path[i][j]);
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
                       for the deposit contract of a DAO
     * @param _token   Address of the token
     * @param _dao     DAO whose deposit contract is the target
     * @param _amount  Amount to be approved
     */
    function _approveDepositContract(
        address _token,
        address _dao,
        uint256 _amount
    ) internal {
        _approveToken(_token, baseContract.getDepositContract(_dao), _amount);
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
        require(
            IERC20(_token).transfer(_to, _amount),
            "Module: transfer failed"
        );
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
        require(
            IERC20(_token).transferFrom(_from, _to, _amount),
            "Module: transfer from failed"
        );
    }

    function hasDealExpired(uint256 _id) external view virtual returns (bool) {}
}
