// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "../../ModuleBaseWithFee.sol";
import "../../../interfaces/IBalancerV2.sol";

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
        // (1% = 10000)
        uint256 maxDiff;
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

    // pathFrom:
    // how much lp tokens does each dao receive
    // from the module, includes vesting.
    // since we do not know the amount of the LP tokens in any case
    // we use percentage values here in basis points, so
    // 100% = 1000000
    // token -> dao -> tuple(4)
    // [[instantAmount_dao1, vestedAmount_dao1, vestingStart_dao1,
    // vestingEnd_dao1, instantAmount_dao2, ...], [...]]

    event LiquidityActionCreated(
        uint256 id,
        address[] _daos,
        address[] _tokens,
        uint256[][] _pathFrom,
        uint256[] _pathTo,
        uint256 _maxDiff,
        uint256 _deadline
    );

    event LiquidityActionCancelled(uint256 id);

    event LiquidityActionDeadlineExtended(uint256 id, uint256 newDeadline);

    event LiquidityActionExecuted(uint256 id);

    constructor(address _baseContract, address _vault)
        ModuleBaseWithFee(_baseContract, "BALANCER_LIQUIDITY_MODULE")
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
                              - In Basis Points (1% = 10000) 
      * @param _maxDiff     The maximum difference between the ratio resulting from the 
                            pathFrom and the actual balance of the pool (if it already 
                            exists)
                              - In Basis Points (1% = 10000) 
      * @param _deadline    Time until which this action can be executed (unix timestamp)
      * @return             The ID of the new action
    */
    function createLiquidityAction(
        address[] calldata _daos,
        address[] calldata _tokens,
        uint256[][] calldata _pathFrom,
        uint256[] calldata _pathTo,
        uint256 _maxDiff,
        uint256 _deadline
    ) public returns (uint256) {
        require(
            baseContract.isDAOorOwnerFromArray(msg.sender, _daos),
            "Module: not authorized"
        );
        require(_daos.length >= 2, "Module: at least 2 daos required");

        require(
            _tokens.length >= 2,
            "Module: only at least two tokens supported"
        );

        require(_maxDiff <= 10000, "Module: maxDiff can't be more than 100%");

        require(
            _pathFrom.length == _pathTo.length &&
                _pathFrom[0].length == _daos.length &&
                _pathTo.length / 4 == _daos.length,
            "Module: invalid array lengths"
        );

        LiquidityAction memory la = LiquidityAction(
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _maxDiff,
            _deadline,
            0,
            Status.ACTIVE
        );
        liquidityActions.push(la);
        emit LiquidityActionCreated(
            liquidityActions.length - 1,
            _daos,
            _tokens,
            _pathFrom,
            _pathTo,
            _maxDiff,
            _deadline
        );
        return liquidityActions.length - 1;
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
                              - In Basis Points (1% = 10000) 
      * @param _maxDiff     The maximum difference between the ratio resulting from the 
                            pathFrom and the actual balance of the pool (if it already 
                            exists)
                              - In Basis Points (1% = 10000) 
      * @param _deadline    Time until which this action can be executed (unix timestamp)
      * @return             The ID of the new action
    */
    function createDepositContractsAndCreateLiquidityAction(
        address[] calldata _daos,
        address[] calldata _tokens,
        uint256[][] calldata _pathFrom,
        uint256[] calldata _pathTo,
        uint256 _maxDiff,
        uint256 _deadline
    ) external returns (uint256) {
        for (uint256 i = 0; i < _daos.length; i++) {
            if (!baseContract.hasDepositContract(_daos[i])) {
                baseContract.createDepositContract(_daos[i]);
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
     * @dev        Cancels a liquidity action
     * @param _id  The ID of the action (position in the array)
     */
    function cancelLiquidityAction(uint256 _id)
        external
        validId(_id)
        activeStatus(_id)
        authorized(_id)
    {
        liquidityActions[_id].status = Status.CANCELLED;
        emit LiquidityActionCancelled(_id);
    }

    /**
      * @dev            Cancels a liquidity action
      * @param _id      The ID of the action (position in the array)
      * @param _amount  Amount of seconds that the current deadline will be pushed
                        back by
    */
    function extendDeadline(uint256 _id, uint256 _amount)
        external
        validId(_id)
        authorized(_id)
        activeStatus(_id)
    {
        uint256 newDeadline = liquidityActions[_id].deadline + _amount;
        require(
            newDeadline > block.timestamp,
            "Module: new deadline is in the past"
        );

        liquidityActions[_id].deadline = newDeadline;

        emit LiquidityActionDeadlineExtended(_id, newDeadline);
    }

    /**
      * @dev            Checks whether a liquidity action can be executed
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
        LiquidityAction memory la = liquidityActions[_id];
        if (la.status != Status.ACTIVE) {
            return false;
        }

        if (la.deadline < block.timestamp) {
            return false;
        }
        for (uint256 i = 0; i < la.tokens.length; i++) {
            for (uint256 j = 0; j < la.pathFrom[i].length; j++) {
                if (
                    IDepositContract(
                        baseContract.getDepositContract(la.daos[j])
                    ).getAvailableProcessBalance(
                            keccak256(abi.encode(moduleIdentifierString, _id)),
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
     * @param _id      The ID of the action (position in the array)
     */
    function executeLiquidityAction(uint256 _id)
        external
        validId(_id)
        activeStatus(_id)
        authorized(_id)
    {
        LiquidityAction memory la = liquidityActions[_id];

        require(la.deadline >= block.timestamp, "Module: action expired");

        // Collect tokens into the module
        uint256[] memory tokenAmountsIn = _pullTokensIntoModule(
            _id,
            la.daos,
            la.tokens,
            la.pathFrom
        );

        // Set approval for tokens
        _approveToken(la.tokens[0], address(vault), tokenAmountsIn[0]);
        _approveToken(la.tokens[1], address(vault), tokenAmountsIn[1]);

        IAsset[] memory assets = new IAsset[](la.tokens.length);
        for (uint256 i = 0; i < la.tokens.length; i++) {
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

        la.status = Status.DONE;
        la.executionDate = block.timestamp;
        emit LiquidityActionExecuted(_id);
    }

    /**
      * @dev                Distributes the LP tokens as well as any leftover tokens
                            back to the DAOs based on their LP token shares
      * @param _id          The ID of the action (position in the array)
      * @param _la          The LiquidityPool object containg the information
      * @param _lpToken     Address of the lp token
      * @param _amount      Amount of lp tokens
      * @return _daoShares  The percentage share of each DAO for the lp tokens
                            in basis points (1% = 10000)
    */
    function _distributeLPTokens(
        uint256 _id,
        LiquidityAction memory _la,
        address _lpToken,
        uint256 _amount
    ) internal returns (uint256[] memory _daoShares) {
        uint256 amountsTo = 0;
        uint256 tokensLeft = _amount;
        _daoShares = new uint256[](_la.daos.length);

        for (uint256 k = 0; k < _la.pathTo.length / 4; k++) {
            uint256 share = 0;
            // every 4 values, the values for a new dao start
            // value 0 = instant amount
            // value 1 = vested amount
            // value 2 = vesting start
            // value 3 = vesting end

            // sending the vested amount first
            if (_la.pathTo[k * 4 + 1] > 0) {
                share += _la.pathTo[k * 4 + 1];
                uint256 payout = (_amount * _la.pathTo[k * 4 + 1]) / 10000;
                amountsTo += payout;
                tokensLeft -= payout;
                payout = _payFeeAndReturnRemainder(_lpToken, payout);
                _approveDepositContract(_lpToken, _la.daos[k], payout);
                IDepositContract(baseContract.getDepositContract(_la.daos[k]))
                    .startVesting(
                        keccak256(abi.encode(moduleIdentifierString, _id)),
                        _lpToken,
                        payout, // amount
                        _la.pathTo[k * 4 + 2], // start
                        _la.pathTo[k * 4 + 3] // end
                    );
            }

            // sending the instant amount
            if (_la.pathTo[k * 4] > 0) {
                share += _la.pathTo[k * 4];
                uint256 payout = (_amount * _la.pathTo[k * 4]) / 10000;
                amountsTo += payout;
                tokensLeft -= payout;
                // If we are at the last one, make sure that
                // no dust is left behind
                if (k == _la.daos.length - 1 && tokensLeft > 0) {
                    payout += tokensLeft;
                }
                _transferTokenWithFee(_lpToken, _la.daos[k], payout);
            }
            _daoShares[k] = share;
        }
        require(amountsTo == _amount, "Module: amount mismatch");
    }

    /**
      * @dev                    Distributes any leftover tokens back to the DAOs based on 
                                their LP token shares
      * @param _id              The ID of the action (position in the array)
      * @param _daoShares       Array of the percentage shares of each DAO for LP tokens
                                  - In Basis Points (1% = 10000) 
      * @param _amounts         Array of the amounts left for each input token
    */
    function _distributeLeftoverTokens(
        uint256 _id,
        uint256[] memory _daoShares,
        uint256[] memory _amounts
    ) internal {
        require(
            _daoShares.length == _amounts.length,
            "Module: array length mismatch"
        );
        uint256[] memory left = _amounts;
        for (uint256 i = 0; i < _daoShares.length; i++) {
            for (uint256 j = 0; j < _amounts.length; j++) {
                if (_amounts[j] > 0) {
                    uint256 payout = (_amounts[j] * _daoShares[i]) / 10000;
                    left[j] -= payout;
                    // If we are at the last one, make sure that
                    // no dust is left behind
                    if (i == _daoShares.length - 1 && left[j] > 0) {
                        payout += left[j];
                    }
                    _transferToken(
                        liquidityActions[_id].tokens[j],
                        liquidityActions[_id].daos[i],
                        payout
                    );
                }
            }
        }
    }

    modifier validId(uint256 _id) {
        require(_id <= liquidityActions.length, "Module: id doesn't exist");
        _;
    }

    modifier activeStatus(uint256 _id) {
        require(
            liquidityActions[_id].status == Status.ACTIVE,
            "Module: id not active"
        );
        _;
    }

    modifier authorized(uint256 _id) {
        require(
            baseContract.isDAOorOwnerFromArray(
                msg.sender,
                liquidityActions[_id].daos
            ),
            "Module: not authorized"
        );
        _;
    }
}
