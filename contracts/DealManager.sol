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
    address public immutable weth;

    // Address DAO => address dao deposit manager of the DAO
    mapping(address => address) public daoDepositManager;

    // module address => true/false
    mapping(address => bool) public isModule;

    event DaoDepositManagerCreated(
        address indexed dao,
        address indexed daoDepositManager
    );

    constructor(address _daoDepositManager, address _weth) {
        require(
            _daoDepositManager != address(0) &&
                _daoDepositManager != address(this),
            "DealManager: Error 100"
        );
        require(
            _weth != address(0) && _weth != address(this),
            "DealManager: Error 100"
        );
        daoDepositManagerImplementation = _daoDepositManager;
        weth = _weth;
    }

    // Sets a new address for the deposit contract implementation
    function setDaoDepositManagerImplementation(address _newImplementation)
        external
        onlyOwner
    {
        // solhint-disable-next-line reason-string
        require(
            _newImplementation != address(0) &&
                _newImplementation != address(this),
            "DealManager: Error 100"
        );
        daoDepositManagerImplementation = _newImplementation;
    }

    // Registers a new module
    function activateModule(address _moduleAddress) external onlyOwner {
        require(
            _moduleAddress != address(0) && _moduleAddress != address(this),
            "DealManager: Error 100"
        );
        require(
            IModuleBase(_moduleAddress).dealManager() == address(this),
            "DealManager: Error 260"
        );

        isModule[_moduleAddress] = true;
    }

    // Deactivates a module
    function deactivateModule(address _moduleAddress) external onlyOwner {
        require(
            _moduleAddress != address(0) && _moduleAddress != address(this),
            "DealManager: Error 100"
        );

        isModule[_moduleAddress] = false;
    }

    // Creates a deposit contract for a DAO
    function createDaoDepositManager(address _dao) public {
        require(
            _dao != address(0) && _dao != address(this),
            "DealManager: Error 100"
        );
        require(
            daoDepositManager[_dao] == address(0),
            "DealManager: Error 001"
        );
        require(
            daoDepositManagerImplementation != address(0),
            "DealManager: Error 261"
        );
        address newContract = Clones.clone(daoDepositManagerImplementation);
        IDaoDepositManager(newContract).initialize(_dao);
        require(
            IDaoDepositManager(newContract).dealManager() == address(this),
            "DealManager: Error 260"
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
