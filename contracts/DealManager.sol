// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IDaoDepositManager.sol";
import "./interfaces/IModuleBase.sol";

/**
 * @title PrimeDeals Deal Manager
 * @dev   Smart contract to serve as the manager
          for the PrimeDeals architecture
 */
contract DealManager is Ownable {
    // Address of the current implementation of the
    // deposit contract
    address public daoDepositManagerImplementation;

    // Address of the ETH wrapping contract
    address public weth;

    // Address DAO => address dao deposit manager of the DAO
    mapping(address => address) public daoDepositManager;

    // module address => true/false
    mapping(address => bool) public isModule;

    event DaoDepositManagerCreated(
        address indexed dao,
        address indexed daoDepositManager
    );

    // Sets a new address for the deposit contract implementation
    function setDaoDepositManagerImplementation(address _newImplementation)
        external
        onlyOwner
    {
        // solhint-disable-next-line reason-string
        require(
            _newImplementation != address(0),
            "BASECONTRACT-INVALID-IMPLEMENTATION-ADDRESS"
        );
        daoDepositManagerImplementation = _newImplementation;
    }

    // Sets a new address for the weth contract
    function setWETHAddress(address _newWETH) external onlyOwner {
        // solhint-disable-next-line reason-string
        require(_newWETH != address(0), "BASECONTRACT-INVALID-WETH-ADDRESS");
        weth = _newWETH;
    }

    // Registers a new module
    function activateModule(address _moduleAddress) external onlyOwner {
        // solhint-disable-next-line reason-string
        require(
            _moduleAddress != address(0),
            "BASECONTRACT-INVALID-MODULE-ADDRESS"
        );
        // solhint-disable-next-line reason-string
        require(
            IModuleBase(_moduleAddress).dealManager() == address(this),
            "BASECONTRACT-MODULE-SETUP-INVALID"
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

    // Creates a deposit contract for a DAO
    function createDaoDepositManager(address _dao) public {
        require(_dao != address(0), "BASECONTRACT-INVALID-DAO-ADDRESS");
        // solhint-disable-next-line reason-string
        require(
            daoDepositManager[_dao] == address(0),
            "BASECONTRACT-DEPOSIT-CONTRACT-ALREADY-EXISTS"
        );
        // solhint-disable-next-line reason-string
        require(
            daoDepositManagerImplementation != address(0),
            "BASECONTRACT-DEPOSIT-CONTRACT-IMPLEMENTATION-IS-NOT-SET"
        );
        address newContract = Clones.clone(daoDepositManagerImplementation);
        IDaoDepositManager(newContract).initialize(_dao);
        require(
            IDaoDepositManager(newContract).dealManager() == address(this),
            "BASECONTRACT-INVALID-INITALIZE"
        );
        daoDepositManager[_dao] = newContract;
        emit DaoDepositManagerCreated(_dao, newContract);
    }

    // Returns whether a DAO already has a deposit contract
    function hasDaoDepositManager(address _dao) external view returns (bool) {
        return getDaoDepositManager(_dao) != address(0) ? true : false;
    }

    // Returns the deposit contract of a DAO
    function getDaoDepositManager(address _dao) public view returns (address) {
        return daoDepositManager[_dao];
    }

    function addressIsModule(address _address) external view returns (bool) {
        return isModule[_address];
    }
}
