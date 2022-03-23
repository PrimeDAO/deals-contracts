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
    mapping(bytes32 => uint32) public metadataToDealId;

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

    struct TokenSwap {
        // The participating DAOs
        address[] daos;
        // The tokens involved in the swap
        address[] tokens;
        // the token flow from the DAOs to the module
        uint256[][] pathFrom;
        // the token flow from the module to the DAO
        uint256[][] pathTo;
        // unix timestamp of the deadline
        uint32 deadline;
        // unix timestamp of the execution
        uint32 executionDate;
        // hash of the deal information.
        bytes32 metadata;
        // status of the deal
        Status status;
    }

    event TokenSwapCreated(
        address indexed module,
        uint32 indexed dealId,
        bytes32 indexed metadata,
        address[] daos,
        address[] tokens,
        uint256[][] pathFrom,
        uint256[][] pathTo,
        uint32 deadline
    );

    event TokenSwapExecuted(address indexed module, uint32 indexed dealId);

    constructor(address _dealManager) ModuleBaseWithFee(_dealManager) {}

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
      *@param _metadata     Unique ID that is generated throught the Prime Deals frontend
      * @param _deadline    Time until which this action can be executed (unix timestamp)
      * @return             The dealId of the new action
    */
    function _createSwap(
        address[] memory _daos,
        address[] memory _tokens,
        uint256[][] memory _pathFrom,
        uint256[][] memory _pathTo,
        bytes32 _metadata,
        uint32 _deadline
    ) internal returns (uint32) {
        if (tokenSwaps.length >= 1) {
            require(
                _metadataDoesNotExist(_metadata),
                "Module: metadata already exists"
            );
        }
        require(_daos.length >= 2, "Module: at least 2 daos required");
        require(_tokens.length != 0, "Module: at least 1 token required");

        // Check outer arrays
        uint256 pathFromLen = _pathFrom.length;
        require(
            _tokens.length == pathFromLen && pathFromLen == _pathTo.length,
            "Module: invalid outer array lengths"
        );

        // Check inner arrays
        uint256 daosLen = _daos.length;
        for (uint256 i; i < pathFromLen; ++i) {
            require(
                _pathFrom[i].length == daosLen &&
                    _pathTo[i].length >> 2 == daosLen,
                "Module: invalid inner array lengths"
            );
        }

        require(_deadline > block.timestamp, "Module: invalid deadline");

        TokenSwap memory ts = TokenSwap(
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _deadline,
            0,
            _metadata,
            Status.ACTIVE
        );
        tokenSwaps.push(ts);

        uint32 dealId = uint32(tokenSwaps.length - 1);

        metadataToDealId[_metadata] = dealId;

        emit TokenSwapCreated(
            address(this),
            dealId,
            ts.metadata,
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _deadline
        );
        return dealId;
    }

    /**
      * @dev                Create a new token swap action and automatically
                            creates Dao Deposit Manager for each DAO that does not have one
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
      *@param _metadata     Unique ID that is generated throught the Prime Deals frontend
      * @param _deadline    Time until which this action can be executed (unix timestamp)
    */
    function createSwap(
        address[] calldata _daos,
        address[] calldata _tokens,
        uint256[][] calldata _pathFrom,
        uint256[][] calldata _pathTo,
        bytes32 _metadata,
        uint32 _deadline
    ) external returns (uint32) {
        for (uint256 i; i < _daos.length; ++i) {
            address dao = _daos[i];
            if (!dealManager.hasDaoDepositManager(dao)) {
                dealManager.createDaoDepositManager(dao);
            }
        }
        return (
            _createSwap(
                _daos,
                _tokens,
                _pathFrom,
                _pathTo,
                _metadata,
                _deadline
            )
        );
    }

    /**
      * @dev            Checks whether a token swap action can be executed
                        (which is the case if all DAOs have deposited)
      * @param _dealId  The dealId of the action (position in the array)
      * @return         A bool flag indiciating whether the action can be executed
    */
    function checkExecutability(uint32 _dealId)
        public
        view
        validDealId(_dealId)
        returns (bool)
    {
        TokenSwap memory ts = tokenSwaps[_dealId];
        if (ts.status != Status.ACTIVE) {
            return false;
        }
        if (ts.deadline < uint32(block.timestamp)) {
            return false;
        }

        address[] memory t = ts.tokens;
        for (uint256 i; i < t.length; ++i) {
            uint256[] memory p = ts.pathFrom[i];
            for (uint256 j; j < p.length; ++j) {
                // for each token and each pathFrom entry for this
                // token, check whether the corresponding DAO
                // has deposited the corresponding amount into their
                // deposit contract
                uint256 bal = IDaoDepositManager(
                    dealManager.getDaoDepositManager(ts.daos[j])
                ).getAvailableDealBalance(address(this), _dealId, t[i]);
                if (bal < p[j]) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * @dev            Executes a token swap action
     * @param _dealId  The dealId of the action (position in the array)
     */
    function executeSwap(uint32 _dealId)
        external
        validDealId(_dealId)
        activeStatus(_dealId)
    {
        TokenSwap storage ts = tokenSwaps[_dealId];

        require(ts.deadline >= uint32(block.timestamp), "Module: swap expired");
        require(checkExecutability(_dealId), "Module: swap not executable");

        // transfer the tokens from the deposit manager of the DAOs
        // into this module
        uint256[] memory amountsIn = _pullTokensIntoModule(
            _dealId,
            ts.daos,
            ts.tokens,
            ts.pathFrom
        );

        // distribute the tokens from this module to the DAOs
        // and (if applicable) and their vesting contracts
        uint256[] memory amountsOut = _distributeTokens(ts, _dealId);

        // verify whether the amounts being pulled and pushed match
        for (uint256 i; i < ts.tokens.length; ++i) {
            require(amountsIn[i] == amountsOut[i], "Module: amount mismatch");
        }

        ts.status = Status.DONE;
        ts.executionDate = uint32(block.timestamp);
        emit TokenSwapExecuted(address(this), _dealId);
    }

    /**
      * @dev                Distributes the tokens based on the supplied
                            information to the DAOs or their vesting contracts
      * @param _ts          TokenSwap object containing all the information
                            of the action
      * @param _dealId      The dealId of the action (position in the array)
      * @return amountsOut  The two min values for the token amounts _ts
    */
    function _distributeTokens(TokenSwap memory _ts, uint32 _dealId)
        internal
        returns (uint256[] memory amountsOut)
    {
        amountsOut = new uint256[](_ts.tokens.length);
        // Distribute tokens from the module
        for (uint256 i; i < _ts.tokens.length; ++i) {
            uint256[] memory pt = _ts.pathTo[i];
            address token = _ts.tokens[i];
            for (uint256 k; k < pt.length >> 2; ++k) {
                // every 4 values, the values for a new dao start
                // value 0 = instant amount
                // value 1 = vested amount
                // value 2 = vesting cliff
                // value 3 = vesting duration
                uint256 instant = pt[k << 2];
                uint256 vested = pt[(k << 2) + 1];

                if (instant > 0) {
                    amountsOut[i] += instant;
                    _transferTokenWithFee(token, _ts.daos[k], instant);
                }

                if (vested > 0) {
                    amountsOut[i] += vested;
                    uint256 amount = _payFeeAndReturnRemainder(token, vested);
                    _approveDaoDepositManager(token, _ts.daos[k], amount);
                    IDaoDepositManager(
                        dealManager.getDaoDepositManager(_ts.daos[k])
                    ).startVesting(
                            _dealId,
                            token,
                            amount, // amount
                            uint32(pt[(k << 2) + 2]), // start
                            uint32(pt[(k << 2) + 3]) // end
                        );
                }
            }
        }
    }

    function getTokenswapFromMetadata(bytes32 _metadata)
        public
        view
        validMetadata(_metadata)
        returns (TokenSwap memory swap)
    {
        return tokenSwaps[metadataToDealId[_metadata]];
    }

    function hasDealExpired(uint32 _dealId)
        external
        view
        override
        returns (bool)
    {
        return
            tokenSwaps[_dealId].status != Status.ACTIVE ||
            tokenSwaps[_dealId].deadline < uint32(block.timestamp);
    }

    function _metadataDoesNotExist(bytes32 _metadata)
        internal
        view
        returns (bool)
    {
        uint256 dealId = metadataToDealId[_metadata];
        return (dealId == 0 &&
            tokenSwaps[dealId].metadata != _metadata &&
            _metadata.length > 0);
    }

    modifier validMetadata(bytes32 _metadata) {
        uint256 dealId = metadataToDealId[_metadata];
        require(
            dealId != 0 || tokenSwaps[dealId].metadata == _metadata,
            "Module: metadata does not exist"
        );
        _;
    }

    modifier validDealId(uint32 _dealId) {
        require(_dealId < tokenSwaps.length, "Module: dealId doesn't exist");
        _;
    }

    modifier activeStatus(uint32 _dealId) {
        require(
            tokenSwaps[_dealId].status == Status.ACTIVE,
            "Module: dealId not active"
        );
        _;
    }
}
