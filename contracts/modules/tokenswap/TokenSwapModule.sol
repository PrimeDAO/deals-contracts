/*

██████╗░██████╗░██╗███╗░░░███╗███████╗██████╗░░█████╗░░█████╗░
██╔══██╗██╔══██╗██║████╗░████║██╔════╝██╔══██╗██╔══██╗██╔══██╗
██████╔╝██████╔╝██║██╔████╔██║█████╗░░██║░░██║███████║██║░░██║
██╔═══╝░██╔══██╗██║██║╚██╔╝██║██╔══╝░░██║░░██║██╔══██║██║░░██║
██║░░░░░██║░░██║██║██║░╚═╝░██║███████╗██████╔╝██║░░██║╚█████╔╝
╚═╝░░░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝╚══════╝╚═════╝░╚═╝░░╚═╝░╚════╝░

*/
// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "../ModuleBaseWithFee.sol";
import "hardhat/console.sol";

/**
 * @title                   PrimeDeals Token Swap Module
 * @notice                  Smart contract to handle token swap
                            interactions for PrimeDeals
 */
contract TokenSwapModule is ModuleBaseWithFee {
    uint32 public lastDealId;
    // mapping of token swaps where the key is a dealId
    mapping(uint32 => TokenSwap) public tokenSwaps;
    /// Metadata => deal ID
    mapping(bytes32 => uint32) public metadataToDealId;
    /// Maximum DAOplomat reward (5%)
    // solhint-disable-next-line var-name-mixedcase
    uint256 public immutable MAX_REWARD = 500;
    /// Minimum DAOplomat reward (0.001%)
    // solhint-disable-next-line var-name-mixedcase
    uint256 public immutable MAX_DAOplomats = 8;

    /**
     * @dev
     * pathFrom Description:
     * Used to storing how many tokens does each DAO send to the module
     *
     * Example on how the values are stored:
     * token -> DAO -> amount
     * [[123, 0, 123], [0, 123, 0]]
     * token 1: DAO 1 sends 123, DAO 2 sends 0, DAO 3 sends 123, etc.
     *
     * pathTo Description:
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
        /// The participating DAOs
        address[] daos;
        /// The tokens involved in the swap
        address[] tokens;
        /// The token flow from the DAOs to the module, see above
        uint256[][] pathFrom;
        /// The token flow from the module to the DAO, see above
        uint256[][] pathTo;
        /// The DAOplomats who will receive a reward for facilitating the deal creation
        address[] daoplomats;
        /// The percentage of DAOplomat reward that each DAOplomat will receive
        uint256[][] rewardPathTo;
        /// Amount of time in seconds the token swap can be executed
        uint32 deadline;
        /// Unix timestamp of the execution
        uint32 executionDate;
        /// Hash of the deal information.
        bytes32 metadata;
        // boolean to check if the deal has been executed
        bool isExecuted;
    }

    /**
     * @notice              This event is emitted when a token swap is created
     * @param module        Address of this module
     * @param dealId        Deal id for the created token swap
     * @param metadata      Unique ID that is generated throught the Prime Deals frontend
     * @param daos          Array containing the DAOs that are involed in creating the token swap
     * @param tokens        Array containing the tokens that are involed in creating the token swap
     * @param pathFrom      Two-dimensional array containing the tokens flowing from the
                            DAOs into the module
     * @param pathTo        Two-dimensional array containing the tokens flowing from the
                            module to the DAOs
     * @param daoplomats    Array containing the DAOplomat address that will receive the
                                DAOplomat reward.
     * @param rewardPathTo  Array containing the amount of reward each DAOplomat receives.
     * @param deadline      The amount of time between the creation of the swap and the time when
                            it can no longer be executed, in seconds
     */
    event TokenSwapCreated(
        address indexed module,
        uint32 indexed dealId,
        bytes32 indexed metadata,
        address[] daos,
        address[] tokens,
        uint256[][] pathFrom,
        uint256[][] pathTo,
        address[] daoplomats,
        uint256[][] rewardPathTo,
        uint32 deadline
    );

    /**
     * @notice              This event is emitted when a token swap is executed
     * @param module        Address of this module
     * @param dealId        Deal id for the executed token swap
     * @param metadata      Unique ID that is generated throught the Prime Deals frontend
     */
    event TokenSwapExecuted(
        address indexed module,
        uint32 indexed dealId,
        bytes32 indexed metadata
    );

    // solhint-disable-next-line no-empty-blocks
    constructor(address _dealManager, uint32 _dealId)
        ModuleBaseWithFee(_dealManager)
    {
        lastDealId = _dealId;
    }

    /**
      * @notice                 Creates a new token swap action
      * @param _daos            Array containing the DAOs that are involed in this action
      * @param _tokens          Array containing the tokens that are involed in this action
      * @param _pathFrom        Two-dimensional array containing the tokens flowing from the
                                DAOs into the module:
                                    - First array level is for each token
                                    - Second array level is for each dao
                                    - Detailed overview on how to configure the array can be found at
                                        the TokenSwap struct description
      * @param _pathTo          Two-dimensional array containing the tokens flowing from the
                                module to the DAOs:
                                    - First array level is for each token
                                    - Second array level is for each dao
                                    - Detailed overview on how to configure the array can be found at
                                        the TokenSwap struct description
      * @param _daoplomats      Array containing the DAOplomat address that will receive the
                                    DAOplomat reward. The sorting should match the `_rewardPathTo`
                                    array
      * @param _rewardPathTo    Array containing the amount of reward each DAOplomat receives.
                                    The sorting should match the `_daoplomats` array
      * @param _metadata        Unique ID that is generated throught the Prime Deals frontend
      * @param _deadline        The amount of time between the creation of the swap and the time
                                    when it can no longer be executed, in seconds
      * @return uint32          The dealId of the new token swap
    */
    function _createSwap(
        address[] memory _daos,
        address[] memory _tokens,
        uint256[][] memory _pathFrom,
        uint256[][] memory _pathTo,
        address[] memory _daoplomats,
        uint256[][] memory _rewardPathTo,
        bytes32 _metadata,
        uint32 _deadline
    ) internal returns (uint32) {
        _validateCreateSwapInput(
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _daoplomats,
            _rewardPathTo,
            _metadata,
            _deadline
        );

        TokenSwap memory ts = TokenSwap(
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _daoplomats,
            _rewardPathTo,
            // solhint-disable-next-line not-rely-on-time
            uint32(block.timestamp) + _deadline,
            0,
            _metadata,
            false
        );

        ++lastDealId;

        tokenSwaps[lastDealId] = ts;

        metadataToDealId[_metadata] = lastDealId;

        emit TokenSwapCreated(
            address(this),
            lastDealId,
            _metadata,
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _daoplomats,
            _rewardPathTo,
            _deadline
        );
        return lastDealId;
    }

    function _validateCreateSwapInput(
        address[] memory _daos,
        address[] memory _tokens,
        uint256[][] memory _pathFrom,
        uint256[][] memory _pathTo,
        address[] memory _daoplomats,
        uint256[][] memory _rewardPathTo,
        bytes32 _metadata,
        uint32 _deadline
    ) internal view {
        require(_metadata != "", "TokenSwapModule: Error 101");
        require(_metadataDoesNotExist(_metadata), "TokenSwapModule: Error 203");
        require(_daos.length >= 2, "TokenSwapModule: Error 204");
        require(_tokens.length != 0, "TokenSwapModule: Error 205");
        require(_deadline != 0, "TokenSwapModule: Error 101");
        // Check outer arrays
        uint256 pathFromLen = _pathFrom.length;
        require(
            _tokens.length == pathFromLen && pathFromLen == _pathTo.length,
            "TokenSwapModule: Error 102"
        );
        // Check duplicate token addresses
        for (uint256 i; i < _tokens.length; ++i) {
            for (uint256 j = i + 1; j < _tokens.length; ++j)
                require(_tokens[i] != _tokens[j], "TokenSwapModule: Error 104");
        }
        // Check inner arrays
        uint256 daosLen = _daos.length;
        for (uint256 i; i < pathFromLen; ++i) {
            require(
                _pathFrom[i].length == daosLen &&
                    _pathTo[i].length == daosLen << 2,
                "TokenSwapModule: Error 102"
            );
        }
        uint256 daoplomatLen = _daoplomats.length;
        // If no DAOplomat reward is set
        if (daoplomatLen == 0 && _rewardPathTo[0][0] == 0) {
            require(_rewardPathTo[1].length == 0, "TokenSwapModule: Error 102");
        } else {
            // Max number of DAOplomats
            require(
                daoplomatLen <= MAX_DAOplomats,
                "TokenSwapModule: Error 267"
            );
            // Matching number of DAOplomats & reward
            require(
                _rewardPathTo[1].length == daoplomatLen,
                "TokenSwapModule: Error 102"
            );
            // Only 1 value absolut reward
            require(_rewardPathTo[0].length == 1, "TokenSwapModule: Error 105");
            // Check for max and min reward
            require(
                _rewardPathTo[0][0] > 0 && _rewardPathTo[0][0] <= MAX_REWARD,
                "TokenSwapModule: Error 268"
            );
            // Total relative reward add up to 100%
            uint256 totalReward;
            for (uint256 i; i < daoplomatLen; ++i) {
                totalReward += _rewardPathTo[1][i];
            }
            require(totalReward == BPS, "TokenSwapModule: Error 103");
        }
    }

    /**
      * @notice                 Create a new token swap action and automatically
                                creates Dao Deposit Manager for each DAO that does not have one
      * @param _daos            Array containing the DAOs that are involed in this action
      * @param _tokens          Array containing the tokens that are involed in this action
      * @param _pathFrom        Two-dimensional array containing the tokens flowing from the
                                DAOs into the module:
                                - First array level is for each token
                                - Second array level is for each dao
                                - Detailed overview on how to configure the array can be found at
                                    the TokenSwap struct description
      * @param _pathTo          Two-dimensional array containing the tokens flowing from the
                                module to the DAOs:
                                 - First array level is for each token
                                - Second array level is for each dao
                                - Detailed overview on how to configure the array can be found at
                                    the TokenSwap struct description
      * @param _daoplomats      Array containing the DAOplomat address that will receive the
                                    DAOplomat reward. The sorting should match the `_rewardPathTo`
                                    array
      * @param _rewardPathTo    Array containing the amount of reward each DAOplomat receives.
                                    The sorting should match the `_daoplomats` array
      * @param _metadata        Unique ID that is generated throught the Prime Deals frontend
      * @param _deadline        The amount of time between the creation of the swap and the time
                                    when it can no longer be executed, in seconds
      * @return uin32           The dealId of the new token swap
    */
    function createSwap(
        address[] calldata _daos,
        address[] calldata _tokens,
        uint256[][] calldata _pathFrom,
        uint256[][] calldata _pathTo,
        address[] memory _daoplomats,
        uint256[][] memory _rewardPathTo,
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
                _daoplomats,
                _rewardPathTo,
                _metadata,
                _deadline
            )
        );
    }

    /**
      * @notice             Checks whether a token swap action can be executed, which is the case
                            if all DAOs have deposited
      * @param _dealId      The dealId of the action (key to the mapping)
      * @return bool        A bool flag indiciating whether the action can be executed
    */
    function checkExecutability(uint32 _dealId)
        public
        view
        validDealId(_dealId)
        returns (bool)
    {
        TokenSwap memory ts = tokenSwaps[_dealId];
        if (hasDealExpired(_dealId)) {
            return false;
        }

        address[] memory t = ts.tokens;
        uint256 tokenArrayLength = t.length;
        for (uint256 i; i < tokenArrayLength; ++i) {
            uint256[] memory p = ts.pathFrom[i];
            uint256 pathArrayLength = p.length;
            for (uint256 j; j < pathArrayLength; ++j) {
                if (p[j] == 0) {
                    continue;
                }
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
     * @notice              Executes a token swap action
     * @param _dealId       The dealId of the action (key to the mapping)
     */
    function executeSwap(uint32 _dealId)
        external
        validDealId(_dealId)
        isNotExecuted(_dealId)
    {
        TokenSwap storage ts = tokenSwaps[_dealId];

        require(checkExecutability(_dealId), "TokenSwapModule: Error 265");

        // set to true directly before we touch any tokens
        // to prevent any reentrancies from happening
        ts.isExecuted = true;
        // solhint-disable-next-line not-rely-on-time
        ts.executionDate = uint32(block.timestamp);

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
        uint256 tokenArrayLength = ts.tokens.length;
        for (uint256 i; i < tokenArrayLength; ++i) {
            require(
                amountsIn[i] == amountsOut[i],
                "TokenSwapModule: Error 103"
            );
        }

        emit TokenSwapExecuted(address(this), _dealId, ts.metadata);
    }

    /**
      * @notice             Distributes the tokens based on the supplied information to the DAOs
                            or their vesting contracts
      * @param _ts          TokenSwap object containing all the information of the action
      * @param _dealId      The dealId of the action (key to the mapping)
      * @return amountsOut  The two min values for the token amounts _ts
    */
    function _distributeTokens(TokenSwap memory _ts, uint32 _dealId)
        internal
        returns (uint256[] memory amountsOut)
    {
        amountsOut = new uint256[](_ts.tokens.length);
        // Distribute tokens from the module
        uint256 tokenArrayLength = _ts.tokens.length;
        for (uint256 i; i < tokenArrayLength; ++i) {
            uint256[] memory pt = _ts.pathTo[i];
            uint256 pathArrayLength = pt.length >> 2;
            uint256 totalRewardForToken = 0;
            uint256 reward = 0;
            uint256 amount = 0;
            for (uint256 k; k < pathArrayLength; ++k) {
                // Distributes the instant and vested amount for the given token
                (amount, reward) = _distributeTokenToDAO(
                    _ts.tokens[i],
                    _ts.daos[k],
                    pt,
                    k,
                    _ts.rewardPathTo[0][0],
                    _dealId
                );
                amountsOut[i] += amount;
                totalRewardForToken += reward;
            }
            // Sends DAOplomat reward for the given token
            if (_ts.rewardPathTo[0][0] > 0) {
                amount = _payDaoplomatReward(
                    _ts.tokens[i],
                    totalRewardForToken,
                    _ts.daoplomats,
                    _ts.rewardPathTo[1]
                );
                amountsOut[i] += amount;
            }
        }
    }

    function _distributeTokenToDAO(
        address _token,
        address _dao,
        uint256[] memory _pathTo,
        uint256 _pathIndex,
        uint256 _totalPercentageReward,
        uint32 _dealId
    ) internal returns (uint256 amountsOut, uint256 daoplomatReward) {
        // every 4 values, the values for a new dao start
        // value 0 = instant amount
        // value 1 = vested amount
        // value 2 = vesting cliff
        // value 3 = vesting duration
        uint256 instantAmount = _pathTo[_pathIndex << 2];
        uint256 vestedAmount = _pathTo[(_pathIndex << 2) + 1];
        uint256 reward;
        uint256 amount;

        if (instantAmount > 0) {
            (amount, reward) = _distributeInstantToken(
                _token,
                _dao,
                instantAmount,
                _totalPercentageReward
            );
            amountsOut += amount;
            daoplomatReward += reward;
        }

        if (vestedAmount > 0) {
            (amount, reward) = _distributeVestedTokens(
                _token,
                _dao,
                _pathTo,
                _pathIndex,
                vestedAmount,
                _totalPercentageReward,
                _dealId
            );
            amountsOut += amount;
            daoplomatReward += reward;
        }
    }

    function _distributeInstantToken(
        address _token,
        address _dao,
        uint256 _instantAmount,
        uint256 _totalPercentageReward
    ) internal returns (uint256 amountsOut, uint256 instantDaoplomatReward) {
        instantDaoplomatReward += _transferWithFeeAndReturnReward(
            _token,
            _dao,
            _instantAmount,
            _totalPercentageReward
        );
        amountsOut = _instantAmount - instantDaoplomatReward;
    }

    function _distributeVestedTokens(
        address _token,
        address _dao,
        uint256[] memory _pathTo,
        uint256 _pathIndex,
        uint256 _vestedAmount,
        uint256 _totalPercentageReward,
        uint32 _dealId
    ) internal returns (uint256 amountsOut, uint256 vestedDaoplomatReward) {
        uint256 amount;
        (amount, vestedDaoplomatReward) = _payFeeAndReturnRemainderAndReward(
            _token,
            _vestedAmount,
            _totalPercentageReward
        );
        amountsOut = _vestedAmount - vestedDaoplomatReward;

        address daoDepositManager = dealManager.getDaoDepositManager(_dao);
        if (_token != address(0)) {
            _approveDaoDepositManager(_token, _dao, amount);
        }
        _startVesting(
            _token,
            daoDepositManager,
            amount,
            _pathTo,
            _pathIndex,
            _dealId
        );
    }

    function _startVesting(
        address _token,
        address _daoDepositManager,
        uint256 _amount,
        uint256[] memory _pathTo,
        uint256 _pathIndex,
        uint32 _dealId
    ) internal {
        uint256 callValue = _token == address(0) ? _amount : 0;
        IDaoDepositManager(_daoDepositManager).startVesting{value: callValue}(
            _dealId,
            _token,
            _amount, // amount
            uint32(_pathTo[(_pathIndex << 2) + 2]), // cliff
            uint32(_pathTo[(_pathIndex << 2) + 3]) // duration
        );
    }

    /**
     * @notice              Returns the TokenSwap struct associated with the metadata
     * @param _metadata     Unique ID that is generated throught the Prime Deals frontend
     * @return swap         Token swap struct associated with the metadata
     */
    function getTokenswapFromMetadata(bytes32 _metadata)
        public
        view
        returns (TokenSwap memory swap)
    {
        return tokenSwaps[metadataToDealId[_metadata]];
    }

    /**
     * @notice              Checks if the deal has been expired
     * @param _dealId       The dealId of the action (key to the mapping)
     * @return bool         A bool flag indiciating whether token swap has expired
     */
    function hasDealExpired(uint32 _dealId)
        public
        view
        override
        validDealId(_dealId)
        returns (bool)
    {
        TokenSwap memory swap = tokenSwaps[_dealId];
        return
            swap.isExecuted ||
            // solhint-disable-next-line not-rely-on-time
            swap.deadline < uint32(block.timestamp);
    }

    /**
     * @notice              Checks if the given metadata is Unique, and not already used
     * @param _metadata     Unique ID that is generated throught the Prime Deals frontend
     * @return bool         A bool flag indiciating whether the metadata is unique
     */
    function _metadataDoesNotExist(bytes32 _metadata)
        internal
        view
        returns (bool)
    {
        TokenSwap memory ts = getTokenswapFromMetadata(_metadata);
        return ts.metadata == 0;
    }

    /**
     * @notice              Modifier that validates if the given deal ID is valid
     * @param _dealId       The dealId of the action (key to the mapping)
     */
    modifier validDealId(uint32 _dealId) {
        require(
            tokenSwaps[_dealId].metadata != 0,
            "TokenSwapModule: Error 207"
        );
        _;
    }

    /**
     * @notice              Modifier that validates if token swap has not been executed
     * @param _dealId       The dealId of the action (key to the mapping)
     */
    modifier isNotExecuted(uint32 _dealId) {
        require(!tokenSwaps[_dealId].isExecuted, "TokenSwapModule: Error 266");
        _;
    }

    fallback() external payable {}

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
