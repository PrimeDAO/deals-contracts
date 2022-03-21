// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "../../interfaces/IGnosisSafe.sol";
import "../../interfaces/IBaseContract.sol";
import "../../interfaces/IWETH.sol";
import "../ModuleBase.sol";

/**
 * @title PrimeDeals Joint Venture Module
 * @dev   Smart contract to handle joint venture
 *        interactions for PrimeDeals
 */
contract JointVentureModule is ModuleBase {
    address public proxyFactory;
    address public masterCopy;

    JointVenture[] public jointVentures;

    struct JointVenture {
        // the participating DAOs
        address[] daos;
        // the members of the new safe
        address[] safeMembers;
        // the voting threshold of the
        // new safe
        uint256 safeThreshold;
        // the tokens involved in the action
        address[] tokens;
        // the token flow from the DAOs to the module
        uint256[][] pathFrom;
        // unix timestamp of the deadline
        uint256 deadline;
        // unix timestamp of the execution
        uint256 executionDate;
        // status of the deal
        Status status;
    }

    // pathFrom:
    // how much tokens does each dao send to the module
    // token -> dao -> amount
    // [[123, 0, 123], [0, 123, 0]]
    // token 1: dao 1 sends 123, dao 2 sends 0, dao 3 sends 123, etc.

    event JointVentureActionCreated(
        uint256 id,
        address[] _daos,
        address[] _safeMembers,
        uint256 _safeThreshold,
        address[] _tokens,
        uint256[][] _pathFrom,
        uint256 _deadline
    );

    event JointVentureActionCancelled(uint256 id);

    event JointVentureActionExecuted(uint256 id);

    constructor(
        address _baseContract,
        address _proxyFactory,
        address _masterCopy
    ) ModuleBase(_baseContract, "JOINT_VENTURE_MODULE") {
        require(
            _proxyFactory != address(0),
            "Module: invalid proxy factory address"
        );
        proxyFactory = _proxyFactory;
        require(
            _masterCopy != address(0),
            "Module: invalid master copy address"
        );
        masterCopy = _masterCopy;
    }

    /**
      * @dev                    Create a new joint venture action
      * @param _daos            Array containing the DAOs that are involed in this action
      * @param _safeMembers     Array containing the new safe members
      * @param _safeThreshold   Voting threshold of the new safe
      * @param _tokens          Array containing the tokens that are involed in this action
      * @param _pathFrom        Two-dimensional array containing the tokens flowing from the
                                DAOs into the module:
                                  - First array level is for each token
                                  - Second array level is for each dao
                                  - Contains absolute numbers of tokens
     
      * @param _deadline        Time until which this action can be executed (unix timestamp)
      * @return                 The ID of the new action
    */
    function createJointVentureAction(
        address[] calldata _daos,
        address[] calldata _safeMembers,
        uint256 _safeThreshold,
        address[] calldata _tokens,
        uint256[][] calldata _pathFrom,
        uint256 _deadline
    ) public returns (uint256) {
        require(_daos.length >= 2, "Module: at least 2 daos required");

        require(
            _safeMembers.length >= 1 && _tokens.length >= 1,
            "Module: invalid inputs"
        );

        require(
            _safeThreshold >= 1 && _safeThreshold <= _safeMembers.length,
            "Module: invalid safe threshold"
        );

        uint256 id = jointVentures.length + 1;
        JointVenture memory jv = JointVenture(
            _daos,
            _safeMembers,
            _safeThreshold,
            _tokens,
            _pathFrom,
            _deadline,
            0,
            Status.ACTIVE
        );
        jointVentures.push(jv);

        emit JointVentureActionCreated(
            id,
            _daos,
            _safeMembers,
            _safeThreshold,
            _tokens,
            _pathFrom,
            _deadline
        );

        return id;
    }

    /**
      * @dev                    Create a new joint venture action and automatically
                                creates Deposit Contracts for each DAO that does not have one
      * @param _daos            Array containing the DAOs that are involed in this action
      * @param _safeMembers     Array containing the new safe members
      * @param _safeThreshold   Voting threshold of the new safe
      * @param _tokens          Array containing the tokens that are involed in this action
      * @param _pathFrom        Two-dimensional array containing the tokens flowing from the
                                DAOs into the module:
                                  - First array level is for each token
                                  - Second array level is for each dao
                                  - Contains absolute numbers of tokens
     
      * @param _deadline        Time until which this action can be executed (unix timestamp)
      * @return                 The ID of the new action
    */
    function createDepositContractsAndCreateJointVentureAction(
        address[] calldata _daos,
        address[] calldata _safeMembers,
        uint256 _safeThreshold,
        address[] calldata _tokens,
        uint256[][] calldata _pathFrom,
        uint256 _deadline
    ) external returns (uint256) {
        for (uint256 i = 0; i < _daos.length; i++) {
            if (!baseContract.hasDepositContract(_daos[i])) {
                baseContract.createDepositContract(_daos[i]);
            }
        }
        return
            createJointVentureAction(
                _daos,
                _safeMembers,
                _safeThreshold,
                _tokens,
                _pathFrom,
                _deadline
            );
    }

    /**
      * @dev            Checks whether a joint venture action can be executed
                        (which is the case if all DAOs have deposited)
      * @param _id      The ID of the action (position in the array)
      * @return         A bool flag indiciating whether the action can be executed
    */
    function checkExecutability(uint256 _id)
        external
        view
        validId(_id)
        returns (bool)
    {
        JointVenture storage jv = jointVentures[_id];

        if (jv.status != Status.ACTIVE) {
            return false;
        }

        if (jv.deadline < block.timestamp) {
            return false;
        }
        for (uint256 i = 0; i < jv.tokens.length; i++) {
            for (uint256 j = 0; j < jv.pathFrom[i].length; j++) {
                // for each token and each pathFrom entry for this
                // token, check whether the corresponding DAO
                // has deposited the corresponding amount into their
                // deposit contract
                if (
                    IDepositContract(
                        baseContract.getDepositContract(jv.daos[j])
                    ).getAvailableDealBalance(
                            address(this),
                            _id,
                            jv.tokens[i]
                        ) < jv.pathFrom[i][j]
                ) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @dev            Executes a joint venture action
     * @param _id      The ID of the action (position in the array)
     */
    function executeJointVentureAction(uint256 _id)
        external
        validId(_id)
        activeStatus(_id)
    {
        JointVenture memory jv = jointVentures[_id];

        require(jv.deadline >= block.timestamp, "Module: action expired");

        // collect tokens into the module
        uint256[] memory tokenAmountsIn = _pullTokensIntoModule(
            _id,
            jv.daos,
            jv.tokens,
            jv.pathFrom
        );

        // deploy the new gnosis safe with the parameters
        address payable safe = _deploySafe(jv.safeMembers, jv.safeThreshold);

        // send the collected funds to thew new safe
        _sendFundsToSafe(safe, jv.tokens, tokenAmountsIn);

        jv.status = Status.DONE;
        jv.executionDate = block.timestamp;
        emit JointVentureActionExecuted(_id);
    }

    /**
     * @dev                     Deploys the Gnosis Safe
     * @param _safeMembers      Array of the addresses owning the new safe
     * @param _safeThreshold    Voting Threshold of the new safe
     * @return                  The address of the newly deployed safe
     */
    function _deploySafe(address[] memory _safeMembers, uint256 _safeThreshold)
        internal
        returns (address payable)
    {
        bytes memory safeInitData = abi.encodeWithSelector(
            GnosisSafeSetup.setup.selector,
            _safeMembers, // safe owners
            _safeThreshold, // threshold
            address(0x0), // to (for callback)
            new bytes(0), // data (for callback)
            address(0x0), // handler (for callback)
            address(0x0), // payment token (for gasless creation)
            0, // payment amount (for gasless creation)
            address(0x0) // payment receiver (for gasless creation)
        );

        address payable safe = ProxyFactory(proxyFactory).createProxy(
            masterCopy,
            safeInitData
        );

        require(safe != address(0x0), "Module: safe deployment failed");
        return safe;
    }

    /**
     * @dev             Sends the collected funds to the new safe
     * @param _safe     Address of the new safe
     * @param _tokens   Array of token addresses
     * @param _amounts  Array of amounts for each token to be sent
     */
    function _sendFundsToSafe(
        address payable _safe,
        address[] memory _tokens,
        uint256[] memory _amounts
    ) internal {
        for (uint256 i = 0; i < _tokens.length; i++) {
            if (_tokens[i] != baseContract.weth()) {
                _transferToken(_tokens[i], _safe, _amounts[i]);
            } else {
                IWETH(baseContract.weth()).withdraw(_amounts[i]);
                (bool sent, ) = _safe.call{value: _amounts[i]}("");
                require(sent, "Module: failed to send ether to new safe");
            }
        }
    }

    modifier validId(uint256 _id) {
        require(_id <= jointVentures.length, "Module: id doesn't exist");
        _;
    }

    modifier activeStatus(uint256 _id) {
        require(
            jointVentures[_id].status == Status.ACTIVE,
            "Module: id not active"
        );
        _;
    }
}
