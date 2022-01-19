// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IBaseContract.sol";
import "./interfaces/IWETH.sol";

contract DepositContract {
    address public dao;
    IBaseContract public baseContract;

    mapping(address => uint256) public tokenBalances;
    mapping(address => mapping(bytes32 => uint256))
        public availableModuleBalances;
    mapping(address => uint256) public vestedBalances;

    // Contains the module descriptor and the ID of the swap/action
    // so we can identify deposits for each individual interaction
    // e.g. keccak256(abi.encode("TOKEN_SWAP_MODULE", 42));
    // for a deposit for a token swap with the id 42
    mapping(bytes32 => Deposit[]) public deposits;

    Vesting[] public vestings;

    struct Deposit {
        address sender;
        address token;
        uint256 amount;
        uint256 used;
        uint256 time;
    }

    struct Vesting {
        bytes32 actionId;
        address token;
        uint256 amount;
        uint256 sent;
        uint256 start;
        uint256 end;
    }

    event Deposited(
        bytes32 processID,
        uint256 depositID,
        address token,
        uint256 amount,
        address sender
    );

    event Withdrawn(
        bytes32 processID,
        uint256 depositID,
        address to,
        address token,
        uint256 amount
    );

    event VestingStarted(
        bytes32 processID,
        address token,
        uint256 amount,
        uint256 vestingStart,
        uint256 vestingEnd
    );

    function initialize(address _dao) external {
        require(dao == address(0), "D2D-DEPOSIT-ALREADY-INITIALIZED");
        require(_dao != address(0), "D2D-DEPOSIT-INVALID-DAO-ADDRESS");
        dao = _dao;
        baseContract = IBaseContract(msg.sender);
    }

    function migrateBaseContract(address _newBaseContract)
        external
        onlyBaseContract
    {
        baseContract = IBaseContract(_newBaseContract);
    }

    function deposit(
        bytes32 _processID,
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
        availableModuleBalances[_token][_processID] += _amount;
        verifyBalance(_token);
        // solhint-disable-next-line not-rely-on-time
        deposits[_processID].push(
            Deposit(msg.sender, _token, _amount, 0, block.timestamp)
        );

        emit Deposited(
            _processID,
            deposits[_processID].length,
            _token,
            _amount,
            msg.sender
        );
    }

    function multipleDeposits(
        bytes32 _processID,
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external payable {
        // solhint-disable-next-line reason-string
        require(
            _tokens.length == _amounts.length,
            "D2D-DEPOSIT-ARRAY-LENGTH-MISMATCH"
        );
        for (uint256 i = 0; i < _tokens.length; i++) {
            deposit(_processID, _tokens[i], _amounts[i]);
        }
    }

    function registerDeposit(bytes32 _processID, address _token)
        public
        onlyAuthorized
    {
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
            availableModuleBalances[_token][_processID] += amount;
            deposits[_processID].push(
                Deposit(dao, _token, amount, 0, block.timestamp)
            );
            emit Deposited(
                _processID,
                deposits[_processID].length,
                _token,
                amount,
                dao
            );
        }
        verifyBalance(_token);
    }

    function registerDeposits(bytes32 _processID, address[] calldata _tokens)
        external
    {
        for (uint256 i = 0; i < _tokens.length; i++) {
            registerDeposit(_processID, _tokens[i]);
        }
    }

    function withdraw(bytes32 _processID, uint256 _depositID)
        external
        returns (
            address,
            address,
            uint256
        )
    {
        require(
            deposits[_processID].length >= _depositID,
            "D2D-DEPOSIT-INVALID-DEPOSIT-ID"
        );
        Deposit storage d = deposits[_processID][_depositID];
        // Either the caller did the deposit or it's a dao deposit
        // and the caller is the dao or a representative
        require(
            d.sender == msg.sender ||
                (d.sender == dao && baseContract.isDAOorOwner(msg.sender, dao)),
            "D2D-WITHDRAW-NOT-AUTHORIZED"
        );

        uint256 freeAmount = d.amount - d.used;
        // Deposit can't be used by a module or withdrawn already
        require(freeAmount > 0, "D2D-DEPOSIT-NOT-WITHDRAWABLE");
        d.used = d.amount;
        availableModuleBalances[d.token][_processID] -= freeAmount;
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

        emit Withdrawn(_processID, _depositID, d.sender, d.token, freeAmount);
        return (d.sender, d.token, freeAmount);
    }

    function sendToModule(
        bytes32 _processID,
        address _token,
        uint256 _amount
    ) external onlyModule returns (bool) {
        uint256 amountLeft = _amount;
        for (uint256 i = 0; i < deposits[_processID].length; i++) {
            if (deposits[_processID][i].token == _token) {
                uint256 freeAmount = deposits[_processID][i].amount -
                    deposits[_processID][i].used;
                if (freeAmount > amountLeft) {
                    freeAmount = amountLeft;
                }
                amountLeft -= freeAmount;
                deposits[_processID][i].used += freeAmount;
                if (amountLeft == 0) {
                    if (_token == address(0)) {
                        IWETH(baseContract.weth()).withdraw(_amount);
                        (bool sent, ) = msg.sender.call{value: _amount}("");
                        require(sent, "D2D-DEPOSIT-FAILED-TO-SEND-ETHER");
                    } else {
                        _transferToken(_token, msg.sender, _amount);
                        tokenBalances[_token] -= _amount;
                    }
                    availableModuleBalances[_token][_processID] -= _amount;
                    return true;
                }
            }
        }
        return false;
    }

    function startVesting(
        bytes32 _actionId,
        address _token,
        uint256 _amount,
        uint256 _start,
        uint256 _end
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
            _start < _end,
            "D2D-DEPOSIT-VESTING-INVALID-START-AND-END-TIMES"
        );

        _transferTokenFrom(_token, msg.sender, address(this), _amount);
        vestedBalances[_token] += _amount;
        vestings.push(Vesting(_actionId, _token, _amount, 0, _start, _end));
    }

    function claimVestings() external onlyAuthorized {
        for (uint256 i = 0; i < vestings.length; i++) {
            calculateReleasedClaim(vestings[i]);
        }
    }

    function calculateReleasedClaim(Vesting memory vesting) private {
        if (vesting.sent < vesting.amount) {
            if (block.timestamp < vesting.start) {
                return;
            }
            uint256 amount = 0;
            if (block.timestamp >= vesting.end) {
                amount = vesting.amount - vesting.sent;
                vesting.sent = vesting.amount;
            } else {
                uint256 fullDuration = vesting.end - vesting.start;
                uint256 elapsed = vesting.end - block.timestamp;
                amount = (vesting.amount * elapsed) / fullDuration;
                vesting.sent += amount;
            }
            // solhint-disable-next-line reason-string
            require(
                vesting.sent <= vesting.amount,
                "D2D-VESTING-CLAIM-AMOUNT-MISMATCH"
            );
            vestedBalances[vesting.token] -= amount;
            if (vesting.token != baseContract.weth()) {
                _transferToken(vesting.token, dao, amount);
            } else {
                IWETH(baseContract.weth()).withdraw(amount);
                (bool sent, ) = dao.call{value: amount}("");
                require(sent, "D2D-DEPOSIT-FAILED-TO-SEND-ETHER");
            }
        }
    }

    function claimDealVestings(bytes32 _id) external onlyAuthorized {
        for (uint256 i = 0; i < vestings.length; i++) {
            if (vestings[i].actionId == _id) {
                calculateReleasedClaim(vestings[i]);
            }
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

    function getDeposit(bytes32 _processID, uint256 _depositID)
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
        Deposit memory d = deposits[_processID][_depositID];
        return (
            d.sender,
            d.token == baseContract.weth() ? address(0) : d.token,
            d.amount,
            d.used,
            d.time
        );
    }

    function getDepositRange(
        bytes32 _processID,
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
            ) = getDeposit(_processID, i);
        }
        return (senders, tokens, amounts, usedAmounts, times);
    }

    function getAvailableProcessBalance(bytes32 _processID, address _token)
        external
        view
        returns (uint256)
    {
        return availableModuleBalances[_token][_processID];
    }

    function getTotalDepositCount(bytes32 _processID)
        external
        view
        returns (uint256)
    {
        return deposits[_processID].length;
    }

    function getWithdrawableAmountOfUser(
        bytes32 _processID,
        address _user,
        address _token
    ) external view returns (uint256) {
        uint256 freeAmount = 0;
        for (uint256 i = 0; i < deposits[_processID].length; i++) {
            if (
                deposits[_processID][i].sender == _user &&
                deposits[_processID][i].token == _token
            ) {
                freeAmount += (deposits[_processID][i].amount -
                    deposits[_processID][i].used);
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

    function getProcessID(string memory _module, uint256 _id)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(_module, _id));
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

    modifier onlyAuthorized() {
        require(
            baseContract.isDAOorOwner(msg.sender, dao),
            "D2D-NOT-AUTHORIZED"
        );
        _;
    }

    modifier onlyModule() {
        require(baseContract.addressIsModule(msg.sender), "D2D-NOT-MODULE");
        _;
    }
}
