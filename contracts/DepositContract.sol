// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBaseContract.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IModuleBase.sol";

contract DepositContract {
    address public dao;
    IBaseContract public baseContract;

    // token address => balance
    mapping(address => uint256) public tokenBalances;
    // token address => deal module address => deal module id => balance
    mapping(address => mapping(address => mapping(uint256 => uint256)))
        public availableDealBalances;
    // token address => balance
    mapping(address => uint256) public vestedBalances;

    // deal module address => deal id => deposits array
    mapping(address => mapping(uint256 => Deposit[])) public deposits;

    Vesting[] public vestings;
    address[] public vestedTokenAddresses;
    // token address => amount
    mapping(address => uint256) public vestedTokenAmounts;
    // deal module address => deal id => token counter
    mapping(address => mapping(uint256 => uint256)) public tokensPerDeal;

    struct Deposit {
        address sender;
        address token;
        uint256 amount;
        uint256 used;
        uint256 time;
    }

    struct Vesting {
        address dealModule;
        uint256 dealId;
        address token;
        uint256 totalVested;
        uint256 totalClaimed;
        uint256 startTime;
        uint256 cliff;
        uint256 duration;
    }

    event Deposited(
        address dealModule,
        uint256 dealID,
        uint256 depositID,
        address token,
        uint256 amount,
        address sender
    );

    event Withdrawn(
        address dealModule,
        uint256 dealID,
        uint256 depositID,
        address to,
        address token,
        uint256 amount
    );

    event VestingStarted(
        address dealModule,
        uint256 dealID,
        address token,
        uint256 amount,
        uint256 vestingStart,
        uint256 vestingCliff,
        uint256 vestingDuration
    );

    event VestingClaimed(
        address dealModule,
        uint256 dealID,
        address token,
        uint256 claimed,
        address dao
    );

    /**
     * @dev                     Initialize the DaoDepositManager
     * @param _dao              The DAO address to which this contract belongs
     */
    function initialize(address _dao) external {
        require(dao == address(0), "D2D-DEPOSIT-ALREADY-INITIALIZED");
        require(_dao != address(0), "D2D-DEPOSIT-INVALID-DAO-ADDRESS");
        dao = _dao;
        baseContract = IBaseContract(msg.sender);
    }

    /**
     * @dev                     Sets a new address for the BaseContract implementation
     * @param _newBaseContract  The address of the new BaseContract
     */
    function setBaseContractImplementation(address _newBaseContract)
        external
        onlyBaseContract
    {
        baseContract = IBaseContract(_newBaseContract);
    }

    /**
     * @dev                     Transfers the token amount to the DaoDepositManager and
     *                          stores the parameters in a Deposit structure
     * @param _processID        The address of the new BaseContract
     * @param _token            The address of the token that is deposited
     * @param _amount           The amount that is deposited
     */
    function deposit(
        address _dealModule,
        uint256 _dealId,
        address _token,
        uint256 _amount
    ) public payable {
        require(
            (_token != address(0) && _amount > 0) ||
                (_token == address(0) && msg.value > 0),
            "D2D-DEPOSIT-INVALID-TOKEN-AMOUNT"
        );
        if (_token != address(0)) {
            _transferTokenFrom(_token, msg.sender, address(this), _amount);
        } else {
            _amount = msg.value;
            _token = baseContract.weth();
            IWETH(_token).deposit{value: _amount}();
        }

        tokenBalances[_token] += _amount;
        availableDealBalances[_token][_dealModule][_dealId] += _amount;
        verifyBalance(_token);
        // solhint-disable-next-line not-rely-on-time
        deposits[_dealModule][_dealId].push(
            Deposit(msg.sender, _token, _amount, 0, block.timestamp)
        );

        emit Deposited(
            _dealModule,
            _dealId,
            deposits[_dealModule][_dealId].length - 1,
            _token,
            _amount,
            msg.sender
        );
    }

    function multipleDeposits(
        address _dealModule,
        uint256 _dealId,
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external payable {
        // solhint-disable-next-line reason-string
        require(
            _tokens.length == _amounts.length,
            "D2D-DEPOSIT-ARRAY-LENGTH-MISMATCH"
        );
        for (uint256 i = 0; i < _tokens.length; i++) {
            deposit(_dealModule, _dealId, _tokens[i], _amounts[i]);
        }
    }

    function registerDeposit(
        address _dealModule,
        uint256 _dealId,
        address _token
    ) public {
        uint256 currentBalance = 0;
        if (_token != address(0)) {
            currentBalance = IERC20(_token).balanceOf(address(this));
        } else {
            _token = baseContract.weth();
            currentBalance = address(this).balance;
        }
        if (currentBalance > tokenBalances[_token]) {
            uint256 amount = currentBalance - tokenBalances[_token];
            tokenBalances[_token] = currentBalance;
            if (_token == address(0)) {
                IWETH(_token).deposit{value: amount}();
            }
            availableDealBalances[_token][_dealModule][_dealId] += amount;
            deposits[_dealModule][_dealId].push(
                Deposit(dao, _token, amount, 0, block.timestamp)
            );
            emit Deposited(
                _dealModule,
                _dealId,
                deposits[_dealModule][_dealId].length - 1,
                _token,
                amount,
                dao
            );
        }
        verifyBalance(_token);
    }

    function registerDeposits(
        address _dealModule,
        uint256 _dealId,
        address[] calldata _tokens
    ) external {
        for (uint256 i = 0; i < _tokens.length; i++) {
            registerDeposit(_dealModule, _dealId, _tokens[i]);
        }
    }

    function withdraw(
        address _dealModule,
        uint256 _dealId,
        uint256 _depositID
    )
        external
        returns (
            address,
            address,
            uint256
        )
    {
        require(
            deposits[_dealModule][_dealId].length > _depositID,
            "D2D-DEPOSIT-INVALID-DEPOSIT-ID"
        );
        Deposit storage d = deposits[_dealModule][_dealId][_depositID];

        // Either the caller did the deposit or it's a dao deposit
        // and the caller facilitates the withdraw for the dao
        // (which is only possible after the deal expired)

        require(
            d.sender == msg.sender ||
                (d.sender == dao &&
                    IModuleBase(_dealModule).hasDealExpired(_dealId)),
            "D2D-WITHDRAW-NOT-AUTHORIZED"
        );

        uint256 freeAmount = d.amount - d.used;
        // Deposit can't be used by a module or withdrawn already
        require(freeAmount > 0, "D2D-DEPOSIT-NOT-WITHDRAWABLE");
        d.used = d.amount;
        availableDealBalances[d.token][_dealModule][_dealId] -= freeAmount;
        tokenBalances[d.token] -= freeAmount;

        // If it's a token
        if (d.token != baseContract.weth()) {
            _transferToken(d.token, d.sender, freeAmount);
            // Else if it's Ether
        } else {
            IWETH(baseContract.weth()).withdraw(freeAmount);
            require(
                address(this).balance >= freeAmount,
                "D2D-DEPOSIT-INVALID-AMOUNT"
            );
            (bool sent, ) = d.sender.call{value: freeAmount}("");
            require(sent, "D2D-DEPOSIT-FAILED-TO-SEND-ETHER");
        }

        emit Withdrawn(
            _dealModule,
            _dealId,
            _depositID,
            d.sender,
            d.token,
            freeAmount
        );
        return (d.sender, d.token, freeAmount);
    }

    function sendToModule(
        uint256 _dealId,
        address _token,
        uint256 _amount
    ) external onlyModule returns (bool) {
        uint256 amountLeft = _amount;
        for (uint256 i = 0; i < deposits[msg.sender][_dealId].length; i++) {
            if (deposits[msg.sender][_dealId][i].token == _token) {
                uint256 freeAmount = deposits[msg.sender][_dealId][i].amount -
                    deposits[msg.sender][_dealId][i].used;
                if (freeAmount > amountLeft) {
                    freeAmount = amountLeft;
                }
                amountLeft -= freeAmount;
                deposits[msg.sender][_dealId][i].used += freeAmount;
                if (amountLeft == 0) {
                    if (_token == address(0)) {
                        IWETH(baseContract.weth()).withdraw(_amount);
                        (bool sent, ) = msg.sender.call{value: _amount}("");
                        require(sent, "D2D-DEPOSIT-FAILED-TO-SEND-ETHER");
                    } else {
                        _transferToken(_token, msg.sender, _amount);
                        tokenBalances[_token] -= _amount;
                    }
                    availableDealBalances[_token][msg.sender][
                        _dealId
                    ] -= _amount;
                    return true;
                }
            }
        }
        return false;
    }

    function startVesting(
        uint256 _dealId,
        address _token,
        uint256 _amount,
        uint256 _vestingCliff,
        uint256 _vestingDuration
    ) external onlyModule {
        // solhint-disable-next-line reason-string
        require(
            _token != address(0),
            "D2D-DEPOSIT-VESTING-INVALID-TOKEN-ADDRESS"
        );
        // solhint-disable-next-line reason-string
        require(_amount > 0, "D2D-DEPOSIT-VESTING-INVALID-AMOUNT");
        // solhint-disable-next-line reason-string
        require(
            _vestingCliff < _vestingDuration,
            "D2D-DEPOSIT-VESTINGCLIFF-BIGGER-THAN-DURATION"
        );

        _transferTokenFrom(_token, msg.sender, address(this), _amount);
        vestedBalances[_token] += _amount;

        vestings.push(
            Vesting(
                msg.sender,
                _dealId,
                _token,
                _amount,
                0,
                block.timestamp,
                _vestingCliff,
                _vestingDuration
            )
        );

        if (vestedTokenAmounts[_token] == 0) {
            vestedTokenAddresses.push(_token);
        }

        vestedTokenAmounts[_token] += _amount;

        // Outside of the if-clause above to catch the
        // unlikely edge-case of multiple vestings of the
        // same token for one deal. This is necessary
        // for deal-based vesting claims to work.
        tokensPerDeal[msg.sender][_dealId]++;

        emit VestingStarted(
            msg.sender,
            _dealId,
            _token,
            _amount,
            block.timestamp,
            _vestingCliff,
            _vestingDuration
        );
    }

    function claimVestings()
        external
        returns (address[] memory tokens, uint256[] memory amounts)
    {
        uint256 vestingCount = vestedTokenAddresses.length;
        tokens = new address[](vestingCount);
        amounts = new uint256[](vestingCount);

        // Copy storage array to memory, since the "original"
        // array might change during sendReleasableClaim() if
        // the amount of a token reaches zero
        for (uint256 i = 0; i < vestingCount; i++) {
            tokens[i] = vestedTokenAddresses[i];
        }

        for (uint256 i = 0; i < vestings.length; i++) {
            (address token, uint256 amount) = sendReleasableClaim(vestings[i]);
            for (uint256 j = 0; j < vestingCount; j++) {
                if (token == tokens[j]) {
                    amounts[j] += amount;
                }
            }
        }
        return (tokens, amounts);
    }

    function claimDealVestings(address _dealModule, uint256 _dealId)
        external
        returns (address[] memory tokens, uint256[] memory amounts)
    {
        uint256 amountOfTokens = tokensPerDeal[_dealModule][_dealId];
        tokens = new address[](amountOfTokens);
        amounts = new uint256[](amountOfTokens);
        uint256 counter = 0;
        for (uint256 i = 0; i < vestings.length; i++) {
            if (
                vestings[i].dealModule == _dealModule &&
                vestings[i].dealId == _dealId
            ) {
                (tokens[counter], amounts[counter]) = sendReleasableClaim(
                    vestings[i]
                );
                counter++;
            }
        }
    }

    function sendReleasableClaim(Vesting memory vesting)
        private
        returns (address token, uint256 amount)
    {
        if (vesting.totalClaimed < vesting.totalVested) {
            // Check cliff was reached
            uint256 elapsedSeconds = block.timestamp - vesting.startTime;

            if (elapsedSeconds < vesting.cliff) {
                return (address(0), 0);
            }
            if (elapsedSeconds >= vesting.duration) {
                amount = vesting.totalVested - vesting.totalClaimed;
                vesting.totalClaimed = vesting.totalVested;
                tokensPerDeal[vesting.dealModule][vesting.dealId]--;
            } else {
                amount =
                    (vesting.totalVested * elapsedSeconds) /
                    vesting.duration;
                vesting.totalClaimed += amount;
            }

            token = vesting.token;
            vestedTokenAmounts[token] -= amount;

            // if the corresponding token doesn't have any
            // vested amounts in any vesting anymore,
            // we remove it from the array
            if (vestedTokenAmounts[token] == 0) {
                uint256 arrLen = vestedTokenAddresses.length;
                for (uint256 i = 0; i < arrLen; i++) {
                    if (vestedTokenAddresses[i] == token) {
                        // if it's not the last element
                        // move the last to the current slot
                        if (i != arrLen - 1) {
                            vestedTokenAddresses[i] = vestedTokenAddresses[
                                arrLen - 1
                            ];
                        }
                        // remove the last entry
                        vestedTokenAddresses.pop();
                    }
                }
            }

            // solhint-disable-next-line reason-string
            require(
                vesting.totalClaimed <= vesting.totalVested,
                "D2D-VESTING-CLAIM-AMOUNT-MISMATCH"
            );
            vestedBalances[token] -= amount;
            if (token != baseContract.weth()) {
                _transferToken(token, dao, amount);
            } else {
                IWETH(baseContract.weth()).withdraw(amount);
                (bool sent, ) = dao.call{value: amount}("");
                require(sent, "D2D-DEPOSIT-FAILED-TO-SEND-ETHER");
            }

            emit VestingClaimed(
                vesting.dealModule,
                vesting.dealId,
                token,
                amount,
                dao
            );
        }
    }

    function verifyBalance(address _token) public view {
        if (_token == address(0)) {
            _token = baseContract.weth();
        }

        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(
            balance >= tokenBalances[_token] + vestedBalances[_token],
            "D2D-DEPOSIT-BALANCE-INVALID"
        );
    }

    function getDeposit(
        address _dealModule,
        uint256 _dealId,
        uint256 _depositID
    )
        public
        view
        returns (
            address,
            address,
            uint256,
            uint256,
            uint256
        )
    {
        Deposit memory d = deposits[_dealModule][_dealId][_depositID];
        return (
            d.sender,
            d.token == baseContract.weth() ? address(0) : d.token,
            d.amount,
            d.used,
            d.time
        );
    }

    function getDepositRange(
        address _dealModule,
        uint256 _dealId,
        uint256 _fromDepositID,
        uint256 _toDepositID
    )
        external
        view
        returns (
            address[] memory senders,
            address[] memory tokens,
            uint256[] memory amounts,
            uint256[] memory usedAmounts,
            uint256[] memory times
        )
    {
        uint256 range = 2 + _toDepositID - _fromDepositID; // inclusive range
        senders = new address[](range);
        tokens = new address[](range);
        amounts = new uint256[](range);
        usedAmounts = new uint256[](range);
        times = new uint256[](range);
        for (uint256 i = _toDepositID; i <= _fromDepositID; i++) {
            (
                senders[i],
                tokens[i],
                amounts[i],
                usedAmounts[i],
                times[i]
            ) = getDeposit(_dealModule, _dealId, i);
        }
        return (senders, tokens, amounts, usedAmounts, times);
    }

    function getAvailableDealBalance(
        address _dealModule,
        uint256 _dealId,
        address _token
    ) external view returns (uint256) {
        return availableDealBalances[_token][_dealModule][_dealId];
    }

    function getTotalDepositCount(address _dealModule, uint256 _dealId)
        external
        view
        returns (uint256)
    {
        return deposits[_dealModule][_dealId].length;
    }

    function getWithdrawableAmountOfUser(
        address _dealModule,
        uint256 _dealId,
        address _user,
        address _token
    ) external view returns (uint256) {
        uint256 freeAmount = 0;
        for (uint256 i = 0; i < deposits[_dealModule][_dealId].length; i++) {
            if (
                deposits[_dealModule][_dealId][i].sender == _user &&
                deposits[_dealModule][_dealId][i].token == _token
            ) {
                freeAmount += (deposits[_dealModule][_dealId][i].amount -
                    deposits[_dealModule][_dealId][i].used);
            }
        }
        return freeAmount;
    }

    function getBalance(address _token) external view returns (uint256) {
        if (_token == address(0)) {
            return address(this).balance;
        }
        return tokenBalances[_token];
    }

    function getVestedBalance(address _token) external view returns (uint256) {
        return vestedBalances[_token];
    }

    function _transferToken(
        address _token,
        address _to,
        uint256 _amount
    ) internal {
        require(
            IERC20(_token).transfer(_to, _amount),
            "D2D-TOKEN-TRANSFER-FAILED"
        );
    }

    function _transferTokenFrom(
        address _token,
        address _from,
        address _to,
        uint256 _amount
    ) internal {
        require(
            IERC20(_token).transferFrom(_from, _to, _amount),
            "D2D-TOKEN-TRANSFER-FAILED"
        );
    }

    modifier onlyBaseContract() {
        // solhint-disable-next-line reason-string
        require(
            msg.sender == address(baseContract),
            "D2D-DEPOSIT-ONLY-BASE-CONTRACT-CAN-ACCESS"
        );
        _;
    }

    modifier onlyModule() {
        require(baseContract.addressIsModule(msg.sender), "D2D-NOT-MODULE");
        _;
    }
}
