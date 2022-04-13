// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "../../ModuleBaseWithFee.sol";
import "../../../interfaces/IBalancerV2.sol";
import "../../../interfaces/IWETH.sol";

/**
 * @title PrimeDeals Liquidity Module (Balancer V2)
 * @dev   Smart contract to handle liquidity pool
 *        interactions for PrimeDeals
 */
contract LiquidityModule_Balancer is ModuleBaseWithFee {
    IBalancerV2 public vault;

    LiquidityAction[] public liquidityActions;

    struct LiquidityAction {
        // the participating DAOs
        address[] daos;
        // the tokens involved in the action
        address[] tokens;
        // the token flow from the DAOs to the module
        uint256[][] pathFrom;
        // the lp token flow from the module to the DAO
        uint256[] pathTo;
        // the maximum difference between the
        // token ratio from pathFrom and the
        // actual ratio on-chain in basis points
        // (1% = 100)
        uint256 maxDiff;
        // unix timestamp of the deadline
        uint32 deadline;
        // unix timestamp of the execution
        uint32 executionDate;
        // status of the deal
        bool isExecuted;
    }

    // pathFrom:
    // how much tokens does each dao send to the module
    // token -> dao -> amount
    // [[123, 0, 123], [0, 123, 0]]
    // token 1: dao 1 sends 123, dao 2 sends 0, dao 3 sends 123, etc.

    // pathFrom:
    // how much lp tokens does each dao receive
    // from the module, includes vesting.
    // since we do not know the amount of the LP tokens in any case
    // we use percentage values here in basis points, so
    // 1% = 100
    // token -> dao -> tuple(4)
    // [[instantAmount_dao1, vestedAmount_dao1, vestingStart_dao1,
    // vestingEnd_dao1, instantAmount_dao2, ...], [...]]

    event LiquidityActionCreated(
        uint32 dealId,
        address[] _daos,
        address[] _tokens,
        uint256[][] _pathFrom,
        uint256[] _pathTo,
        uint256 _maxDiff,
        uint32 _deadline
    );

    event LiquidityActionCancelled(uint32 dealId);

    event LiquidityActionDeadlineExtended(uint32 dealId, uint32 newDeadline);

    event LiquidityActionExecuted(uint32 dealId);

    constructor(address _dealManager, address _vault)
        ModuleBaseWithFee(_dealManager)
    {
        require(_vault != address(0), "Module: invalid vault address");
        vault = IBalancerV2(_vault);
    }

    /**
      * @dev                Create a new liquidity pool related action
      * @param _daos        Array containing the DAOs that are involed in this action
      * @param _tokens      Array containing the tokens that are involed in this action
      * @param _pathFrom    Two-dimensional array containing the tokens flowing from the
                            DAOs into the module:
                              - First array level is for each token
                              - Second array level is for each dao
                              - Contains absolute numbers of tokens
      * @param _pathTo      Array containing the resulting LP tokens flowing to the DAOs
                              - Contains percentage numbers of tokens
                              - In Basis Points (1% = 100) 
      * @param _maxDiff     The maximum difference between the ratio resulting from the 
                            pathFrom and the actual balance of the pool (if it already 
                            exists)
                              - In Basis Points (1% = 100) 
      * @param _deadline    Time until which this action can be executed (unix timestamp)
      * @return             The ID of the new action
    */
    function createLiquidityAction(
        address[] calldata _daos,
        address[] calldata _tokens,
        uint256[][] calldata _pathFrom,
        uint256[] calldata _pathTo,
        uint256 _maxDiff,
        uint32 _deadline
    ) public returns (uint32) {
        require(_daos.length >= 2, "Module: at least 2 daos required");

        require(
            _tokens.length >= 2,
            "Module: only at least two tokens supported"
        );

        require(_maxDiff <= 10000, "Module: maxDiff can't be more than 100%");

        require(
            _pathFrom.length == _pathTo.length &&
                _pathFrom[0].length == _daos.length &&
                _pathTo.length >> 2 == _daos.length,
            "Module: invalid array lengths"
        );

        require(_deadline > block.timestamp, "Module: invalid deadline");

        LiquidityAction memory la = LiquidityAction(
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _maxDiff,
            _deadline,
            0,
            false
        );
        liquidityActions.push(la);
        uint32 dealId = uint32(liquidityActions.length - 1);

        emit LiquidityActionCreated(
            dealId,
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _maxDiff,
            _deadline
        );
        return dealId;
    }

    /**
      * @dev                Create a new liquidity pool related action and automatically
                            creates Deposit Contracts for each DAO that does not have one
      * @param _daos        Array containing the DAOs that are involed in this action
      * @param _tokens      Array containing the tokens that are involed in this action
      * @param _pathFrom    Two-dimensional array containing the tokens flowing from the
                            DAOs into the module:
                              - First array level is for each token
                              - Second array level is for each dao
                              - Contains absolute numbers of tokens
      * @param _pathTo      Array containing the resulting LP tokens flowing to the DAOs
                              - Contains percentage numbers of tokens
                              - In Basis Points (1% = 100) 
      * @param _maxDiff     The maximum difference between the ratio resulting from the 
                            pathFrom and the actual balance of the pool (if it already 
                            exists)
                              - In Basis Points (1% = 100) 
      * @param _deadline    Time until which this action can be executed (unix timestamp)
      * @return             The ID of the new action
    */
    function createDepositContractsAndCreateLiquidityAction(
        address[] calldata _daos,
        address[] calldata _tokens,
        uint256[][] calldata _pathFrom,
        uint256[] calldata _pathTo,
        uint256 _maxDiff,
        uint32 _deadline
    ) external returns (uint32) {
        for (uint256 i; i < _daos.length; ++i) {
            if (!dealManager.hasDaoDepositManager(_daos[i])) {
                dealManager.createDaoDepositManager(_daos[i]);
            }
        }

        return
            createLiquidityAction(
                _daos,
                _tokens,
                _pathFrom,
                _pathTo,
                _maxDiff,
                _deadline
            );
    }

    /**
      * @dev            Checks whether a liquidity action can be executed
                        (which is the case if all DAOs have deposited)
      * @param _dealId      The ID of the action (position in the array)
      * @return         A bool flag indiciating whether the action can be executed
    */
    function checkExecutability(uint32 _dealId)
        external
        view
        validId(_dealId)
        returns (bool)
    {
        LiquidityAction memory la = liquidityActions[_dealId];
        if (la.isExecuted) {
            return false;
        }

        if (la.deadline < uint32(block.timestamp)) {
            return false;
        }

        for (uint256 i; i < la.tokens.length; ++i) {
            for (uint256 j; j < la.pathFrom[i].length; ++j) {
                if (
                    IDaoDepositManager(
                        dealManager.getDaoDepositManager(la.daos[j])
                    ).getAvailableDealBalance(
                            address(this),
                            _dealId,
                            la.tokens[i]
                        ) < la.pathFrom[i][j]
                ) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * @dev            Executes a liquidity action
     * @param _dealId      The ID of the action (position in the array)
     */
    function executeLiquidityAction(uint32 _dealId)
        external
        validId(_dealId)
        isNotExecuted(_dealId)
    {
        LiquidityAction memory la = liquidityActions[_dealId];

        require(
            la.deadline >= uint32(block.timestamp),
            "Module: action expired"
        );

        // Collect tokens into the module
        uint256[] memory tokenAmountsIn = _pullTokensIntoModule(
            _dealId,
            la.daos,
            la.tokens,
            la.pathFrom
        );

        for (uint256 i; i < la.tokens.length; ++i) {
            if (la.tokens[i] == address(0)) {
                address weth = dealManager.weth();
                IWETH(weth).deposit{value: tokenAmountsIn[i]}();
                la.tokens[i] = weth;
            }
            _approveToken(la.tokens[i], address(vault), tokenAmountsIn[i]);
        }

        IAsset[] memory assets = new IAsset[](la.tokens.length);
        for (uint256 i; i < la.tokens.length; ++i) {
            assets[i] = IAsset(la.tokens[i]);
        }

        // find pool or create pool
        // get pool id
        IBalancerV2.JoinPoolRequest memory joinPoolRequest = IBalancerV2
            .JoinPoolRequest(
                assets,
                tokenAmountsIn,
                abi.encode(0, tokenAmountsIn),
                false
            );

        // IBalancerV2.joinPool(id, address(this), address(this), joinPoolRequest);

        // TODO: add logic for balancer v2

        la.isExecuted = true;
        la.executionDate = uint32(block.timestamp);
        emit LiquidityActionExecuted(_dealId);
    }

    /**
      * @dev                Distributes the LP tokens as well as any leftover tokens
                            back to the DAOs based on their LP token shares
      * @param _dealId          The ID of the action (position in the array)
      * @param _la          The LiquidityPool object containg the information
      * @param _lpToken     Address of the lp token
      * @param _amount      Amount of lp tokens
      * @return _daoShares  The percentage share of each DAO for the lp tokens
                            in basis points (1% = 100)
    */
    function _distributeLPTokens(
        uint32 _dealId,
        LiquidityAction memory _la,
        address _lpToken,
        uint256 _amount
    ) internal returns (uint256[] memory _daoShares) {
        uint256 amountsTo;
        uint256 tokensLeft = _amount;
        _daoShares = new uint256[](_la.daos.length);

        for (uint256 k; k < _la.pathTo.length >> 2; ++k) {
            uint256 share;
            // every 4 values, the values for a new dao start
            // value 0 = instant amount
            // value 1 = vested amount
            // value 2 = vesting start
            // value 3 = vesting end

            // sending the vested amount first
            if (_la.pathTo[(k << 2) + 1] > 0) {
                share += _la.pathTo[(k << 2) + 1];
                uint256 payout = (_amount * _la.pathTo[(k << 2) + 1]) / 10000;
                amountsTo += payout;
                tokensLeft -= payout;
                payout = _payFeeAndReturnRemainder(_lpToken, payout);
                _approveDaoDepositManager(_lpToken, _la.daos[k], payout);
                IDaoDepositManager(
                    dealManager.getDaoDepositManager(_la.daos[k])
                ).startVesting(
                        _dealId,
                        _lpToken,
                        payout, // amount
                        uint32(_la.pathTo[(k << 2) + 2]), // start
                        uint32(_la.pathTo[(k << 2) + 3]) // end
                    );
            }

            // sending the instant amount
            if (_la.pathTo[(k << 2)] > 0) {
                share += _la.pathTo[(k << 2)];
                uint256 payout = (_amount * _la.pathTo[(k << 2)]) / 10000;
                amountsTo += payout;
                tokensLeft -= payout;
                // If we are at the last one, make sure that
                // no dust is left behind
                if (k == _la.daos.length - 1 && tokensLeft > 0) {
                    payout += tokensLeft;
                }
                _transferWithFee(_lpToken, _la.daos[k], payout);
            }
            _daoShares[k] = share;
        }
        require(amountsTo == _amount, "Module: amount mismatch");
    }

    /**
      * @dev                    Distributes any leftover tokens back to the DAOs based on 
                                their LP token shares
      * @param _dealId              The ID of the action (position in the array)
      * @param _daoShares       Array of the percentage shares of each DAO for LP tokens
                                  - In Basis Points (1% = 100) 
      * @param _amounts         Array of the amounts left for each input token
    */
    function _distributeLeftoverTokens(
        uint32 _dealId,
        uint256[] memory _daoShares,
        uint256[] memory _amounts
    ) internal {
        require(
            _daoShares.length == _amounts.length,
            "Module: array length mismatch"
        );
        uint256[] memory left = _amounts;
        for (uint256 i; i < _daoShares.length; ++i) {
            for (uint256 j; j < _amounts.length; ++j) {
                if (_amounts[j] > 0) {
                    uint256 payout = (_amounts[j] * _daoShares[i]) / 10000;
                    left[j] -= payout;
                    // If we are at the last one, make sure that
                    // no dust is left behind
                    if (i == _daoShares.length - 1 && left[j] > 0) {
                        payout += left[j];
                    }
                    _transfer(
                        liquidityActions[_dealId].tokens[j],
                        liquidityActions[_dealId].daos[i],
                        payout
                    );
                }
            }
        }
    }

    modifier validId(uint32 _dealId) {
        require(
            _dealId < uint32(liquidityActions.length),
            "Module: id doesn't exist"
        );
        _;
    }

    modifier isNotExecuted(uint32 _dealId) {
        require(
            !liquidityActions[_dealId].isExecuted,
            "Module: id has been executed"
        );
        _;
    }

    fallback() external payable {}

    receive() external payable {}
}
