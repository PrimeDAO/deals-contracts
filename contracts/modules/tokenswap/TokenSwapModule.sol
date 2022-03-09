// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "../ModuleBaseWithFee.sol";

/**
 * @title PrimeDeals Token Swap Module
 * @dev   Smart contract to handle token swap
 *        interactions for PrimeDeals
 */
contract TokenSwapModule is ModuleBaseWithFee {
    TokenSwap[] public tokenSwaps;

    struct TokenSwap {
        // the participating DAOs
        address[] daos;
        // the tokens involved in the swap
        address[] tokens;
        // the token flow from the DAOs to the module
        uint256[][] pathFrom;
        // the token flow from the module to the DAO
        uint256[][] pathTo;
        // unix timestamp of the deadline
        uint256 deadline;
        // unix timestamp of the execution
        uint256 executionDate;
        // status of the deal
        Status status;
    }

    /**
     * @dev
     * pathFrom Description:
     * Used to storing how many tokens does each DAO send to the module
     *
     * Example on how the values are stored:
     * token -> DAO -> amount
     * [[123, 0, 123], [0, 123, 0]]
     * token 1: DAO 1 sends 123, DAO 2 sends 0, DAO 3 sends 123, etc.
     */

    /**
     * @dev
     * pathTo:
     * Used for storing how many tokens does each DAO receive from the module
     * includes vesting. For each DAO there is a tuple of four values:
     * instant amount, vested amount, vesting cliff, vesting duration.
     * The start time will be the block.timestamp when executing the deal.
     * This timestamp + vestingDuration can be used to calculate the vesting end.
     *
     * Example on how the values are stored:
     * token -> DAO -> tuple(4)
     * [[instantAmount_dao1, vestedAmount_dao1, vestingCliff_dao1,
     * vestingDuration_dao1, instantAmount_dao2, ...], [...]]
     */

    event TokenSwapCreated(
        uint256 indexed id,
        address[] daos,
        address[] tokens,
        uint256[][] pathFrom,
        uint256[][] pathTo,
        uint256 deadline
    );

    event TokenSwapExecuted(uint256 indexed id);

    constructor(address _baseContract)
        ModuleBaseWithFee(_baseContract, "TOKEN_SWAP_MODULE")
    {}

    /**
      * @dev                Create a new token swap action
      * @param _daos        Array containing the DAOs that are involed in this action
      * @param _tokens      Array containing the tokens that are involed in this action
      * @param _pathFrom    Two-dimensional array containing the tokens flowing from the
                            DAOs into the module:
                              - First array level is for each token
                              - Second array level is for each dao
                              - Contains absolute numbers of tokens
      * @param _pathTo      Two-dimensional array containing the tokens flowing from the
                            module to the DAOs:
                              - First array level is for each token
                              - Second array level is for each dao
                              - Contains a tuple(4) consisting of instant amount, vested 
                                amount, vesting start, vesting end which then makes this 
                                array look like:
                                [[instantAmount_dao1, vestedAmount_dao1, vestingStart_dao1,
                                vestingEnd_dao1, instantAmount_dao2, ...], [...]]
      * @param _deadline    Time until which this action can be executed (unix timestamp)
      * @return             The ID of the new action
    */
    function _createSwap(
        address[] calldata _daos,
        address[] calldata _tokens,
        uint256[][] calldata _pathFrom,
        uint256[][] calldata _pathTo,
        uint256 _deadline
    ) internal returns (uint256) {
        require(_daos.length >= 2, "Module: at least 2 daos required");
        require(_tokens.length >= 1, "Module: at least 1 token required");
        require(
            _tokens.length == _pathFrom.length &&
                _pathFrom.length == _pathTo.length &&
                _pathFrom[0].length == _daos.length &&
                _pathTo[0].length / 4 == _daos.length,
            "Module: invalid array lengths"
        );

        TokenSwap memory ts = TokenSwap(
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _deadline,
            0,
            Status.ACTIVE
        );
        tokenSwaps.push(ts);

        emit TokenSwapCreated(
            tokenSwaps.length - 1,
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _deadline
        );

        return tokenSwaps.length - 1;
    }

    /**
      * @dev                Create a new token swap action and automatically
                            creates Deposit Contracts for each DAO that does not have one
      * @param _daos        Array containing the DAOs that are involed in this action
      * @param _tokens      Array containing the tokens that are involed in this action
      * @param _pathFrom    Two-dimensional array containing the tokens flowing from the
                            DAOs into the module:
                              - First array level is for each token
                              - Second array level is for each dao
                              - Contains absolute numbers of tokens
      * @param _pathTo      Two-dimensional array containing the tokens flowing from the
                            module to the DAOs:
                              - First array level is for each token
                              - Second array level is for each dao
                              - Contains a tuple(4) consisting of instant amount, vested 
                                amount, vesting start, vesting end which then makes this 
                                array look like:
                                [[instantAmount_dao1, vestedAmount_dao1, vestingStart_dao1,
                                vestingEnd_dao1, instantAmount_dao2, ...], [...]]
      * @param _deadline    Time until which this action can be executed (unix timestamp)
      * @return             The ID of the new action
    */
    function createSwap(
        address[] calldata _daos,
        address[] calldata _tokens,
        uint256[][] calldata _pathFrom,
        uint256[][] calldata _pathTo,
        uint256 _deadline
    ) external returns (uint256) {
        for (uint256 i = 0; i < _daos.length; i++) {
            if (!baseContract.hasDepositContract(_daos[i])) {
                baseContract.createDepositContract(_daos[i]);
            }
        }

        return _createSwap(_daos, _tokens, _pathFrom, _pathTo, _deadline);
    }

    /**
      * @dev            Checks whether a token swap action can be executed
                        (which is the case if all DAOs have deposited)
      * @param _id      The ID of the action (position in the array)
      * @return         A bool flag indiciating whether the action can be executed
    */
    function checkExecutability(uint256 _id)
        public
        view
        validId(_id)
        returns (bool)
    {
        TokenSwap memory ts = tokenSwaps[_id];
        if (ts.status != Status.ACTIVE) {
            return false;
        }
        if (ts.deadline < block.timestamp) {
            return false;
        }
        for (uint256 i = 0; i < ts.tokens.length; i++) {
            for (uint256 j = 0; j < ts.pathFrom[i].length; j++) {
                // for each token and each pathFrom entry for this
                // token, check whether the corresponding DAO
                // has deposited the corresponding amount into their
                // deposit contract
                if (
                    IDepositContract(
                        baseContract.getDepositContract(ts.daos[j])
                    ).getAvailableProcessBalance(
                            keccak256(abi.encode(moduleIdentifierString, _id)),
                            ts.tokens[i]
                        ) < ts.pathFrom[i][j]
                ) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * @dev            Executes a token swap action
     * @param _id      The ID of the action (position in the array)
     */
    function executeSwap(uint256 _id) external validId(_id) activeStatus(_id) {
        TokenSwap memory ts = tokenSwaps[_id];

        require(ts.deadline >= block.timestamp, "Module: swap expired");
        require(checkExecutability(_id), "Module: swap not executable");

        // transfer the tokens from the deposit contract of the DAOs
        // into this module
        uint256[] memory amountsIn = _pullTokensIntoModule(
            _id,
            ts.daos,
            ts.tokens,
            ts.pathFrom
        );

        // distribute the tokens from this module to the DAOs
        // and (if applicable) and their vesting contracts
        uint256[] memory amountsOut = _distributeTokens(ts, _id);

        // verify whether the amounts being pulled and pushed match
        for (uint256 i = 0; i < ts.tokens.length; i++) {
            require(amountsIn[i] == amountsOut[i], "Module: amount mismatch");
        }

        ts.status = Status.DONE;
        ts.executionDate = block.timestamp;
        emit TokenSwapExecuted(_id);
    }

    /**
      * @dev                Distributes the tokens based on the supplied
                            information to the DAOs or their vesting contracts
      * @param _ts          TokenSwap object containing all the information
                            of the action
      * @param _id          The ID of the action (position in the array)
      * @return amountsOut  The two min values for the token amounts _ts
    */
    function _distributeTokens(TokenSwap memory _ts, uint256 _id)
        internal
        returns (uint256[] memory amountsOut)
    {
        amountsOut = new uint256[](_ts.tokens.length);
        // Distribute tokens from the module
        for (uint256 i = 0; i < _ts.tokens.length; i++) {
            for (uint256 k = 0; k < _ts.pathTo[i].length / 4; k++) {
                // every 4 values, the values for a new dao start
                // value 0 = instant amount
                // value 1 = vested amount
                // value 2 = vesting cliff
                // value 3 = vesting duration
                if (_ts.pathTo[i][k * 4] > 0) {
                    amountsOut[i] += _ts.pathTo[i][k * 4];
                    _transferTokenWithFee(
                        _ts.tokens[i],
                        _ts.daos[k],
                        _ts.pathTo[i][k * 4]
                    );
                }
                if (_ts.pathTo[i][k * 4 + 1] > 0) {
                    amountsOut[i] += _ts.pathTo[i][k * 4 + 1];
                    uint256 amount = _payFeeAndReturnRemainder(
                        _ts.tokens[i],
                        _ts.pathTo[i][k * 4 + 1]
                    );
                    _approveDepositContract(_ts.tokens[i], _ts.daos[k], amount);
                    IDepositContract(
                        baseContract.getDepositContract(_ts.daos[k])
                    ).startVesting(
                            keccak256(abi.encode(moduleIdentifierString, _id)),
                            _ts.tokens[i],
                            amount, // amount
                            _ts.pathTo[i][k * 4 + 2], // start
                            _ts.pathTo[i][k * 4 + 3] // end
                        );
                }
            }
        }
    }

    modifier validId(uint256 _id) {
        require(_id <= tokenSwaps.length, "Module: id doesn't exist");
        _;
    }

    modifier activeStatus(uint256 _id) {
        require(
            tokenSwaps[_id].status == Status.ACTIVE,
            "Module: id not active"
        );
        _;
    }
}
