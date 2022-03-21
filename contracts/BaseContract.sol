// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IDepositContract.sol";
import "./interfaces/IModuleBase.sol";

/**
 * @title PrimeDeals Deal Manager
 * @dev   Smart contract to serve as the manager
          for the PrimeDeals architecture
 */
contract BaseContract is Ownable {
    // Address of the current implementation of the
    // deposit contract
    address public depositContractImplementation;

    // Address of the ETH wrapping contract
    address public weth;

    // Maaddress DAO => address deposit contract of the DAO
    mapping(address => address) public depositContract;

    // the module identifier (bytes32) is e.g.
    // keccak256(abi.encode(TOKEN_SWAP_MODULE))
    mapping(bytes32 => address[]) public modules;

    // module address => true/false
    mapping(address => bool) public isModule;

    event DepositContractCreated(address dao, address depositContract);

    // Sets a new address for the deposit contract implementation
    function setDepositContractImplementation(address _newImplementation)
        external
        onlyOwner
    {
        // solhint-disable-next-line reason-string
        require(
            _newImplementation != address(0),
            "BASECONTRACT-INVALID-IMPLEMENTATION-ADDRESS"
        );
        depositContractImplementation = _newImplementation;
    }

    // Sets a new address for the deposit contract implementation
    function setWETHAddress(address _newWETH) external onlyOwner {
        // solhint-disable-next-line reason-string
        require(_newWETH != address(0), "BASECONTRACT-INVALID-WETH-ADDRESS");
        weth = _newWETH;
    }

    // Registers a new module
    function registerModule(address _moduleAddress) external onlyOwner {
        // solhint-disable-next-line reason-string
        require(
            _moduleAddress != address(0),
            "BASECONTRACT-INVALID-MODULE-ADDRESS"
        );
        // solhint-disable-next-line reason-string
        require(
            IModuleBase(_moduleAddress).baseContract() == address(this),
            "BASECONTRACT-MODULE-SETUP-INVALID"
        );

        modules[IModuleBase(_moduleAddress).moduleIdentifier()].push(
            _moduleAddress
        );

        isModule[_moduleAddress] = true;
    }

    // Deactivates a module
    function deactivateModule(address _moduleAddress) external onlyOwner {
        // solhint-disable-next-line reason-string
        require(
            _moduleAddress != address(0),
            "BASECONTRACT-INVALID-MODULE-ADDRESS"
        );

        isModule[_moduleAddress] = false;
    }

    // Retrieves the address of the latest module by its identifier
    function getLatestModule(string calldata _module)
        external
        view
        returns (address)
    {
        return
            modules[keccak256(abi.encode(_module))][
                modules[keccak256(abi.encode(_module))].length - 1
            ];
    }

    // Creates a deposit contract for a DAO
    function createDepositContract(address _dao) public {
        require(_dao != address(0), "BASECONTRACT-INVALID-DAO-ADDRESS");
        // solhint-disable-next-line reason-string
        require(
            depositContract[_dao] == address(0),
            "BASECONTRACT-DEPOSIT-CONTRACT-ALREADY-EXISTS"
        );
        // solhint-disable-next-line reason-string
        require(
            depositContractImplementation != address(0),
            "BASECONTRACT-DEPOSIT-CONTRACT-IMPLEMENTATION-IS-NOT-SET"
        );
        address newContract = Clones.clone(depositContractImplementation);
        IDepositContract(newContract).initialize(_dao);
        depositContract[_dao] = newContract;
        emit DepositContractCreated(_dao, newContract);
    }

    // Returns whether a DAO already has a deposit contract
    function hasDepositContract(address _dao) public view returns (bool) {
        return getDepositContract(_dao) != address(0) ? true : false;
    }

    // Returns the deposit contract of a DAO
    function getDepositContract(address _dao) public view returns (address) {
        return depositContract[_dao];
    }

    function addressIsModule(address _address) public view returns (bool) {
        return isModule[_address];
    }

    modifier onlyModule() {
        // solhint-disable-next-line reason-string
        require(
            addressIsModule(msg.sender),
            "BASECONTRACT-CAN-ONLY-BE-CALLED-BY-MODULE"
        );
        _;
    }
}
