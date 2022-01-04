// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IDepositContract.sol";
import "./interfaces/IModuleBase.sol";

/**
 * @title PrimeDeals Base Contract
 * @dev   Smart contract to serve as the base
          of the PrimeDeals architecture
 */
contract BaseContract is Ownable {
    // address of the current implementation of the
    // deposit contract
    address public depositContractImplementation;

    // address of the eth wrapping contract
    address public weth;

    // address DAO => address deposit contract of the DAO
    mapping(address => address) public depositContract;

    // address DAO => address representative => true/false
    mapping(address => mapping(address => bool)) public representative;

    // the module identifier (bytes32) is e.g.
    // keccak256(abi.encode(TOKEN_SWAP_MODULE))
    mapping(bytes32 => address[]) public modules;

    // module address => true/false
    mapping(address => bool) public isModule;

    event DepositContractCreated(address dao, address depositContract);

    event RepresentativeStatusChanged(
        address dao,
        address representative,
        bool status
    );

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

    // Marks an address as a representative of a dao
    function setRepresentative(
        address _dao,
        address _representative,
        bool _active
    ) public onlyDAOorOwner(_dao) {
        representative[_dao][_representative] = _active;
        emit RepresentativeStatusChanged(_dao, _representative, _active);
    }

    // Marks addresses as representatives of a dao
    function setRepresentatives(
        address _dao,
        address[] calldata _representatives,
        bool[] calldata _active
    ) external onlyDAOorOwner(_dao) {
        // solhint-disable-next-line reason-string
        require(
            _representatives.length == _active.length,
            "BASECONTRACT-INVALID-ARRAY-LENGTH"
        );
        for (uint256 i = 0; i < _representatives.length; i++) {
            setRepresentative(_dao, _representatives[i], _active[i]);
        }
    }

    // Creates a deposit contract for a DAO
    function createDepositContract(address _dao) external {
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

    // Returns whether the address is the DAO, a representative or
    // the contract owner
    function isDAOorOwner(address _caller, address _dao)
        public
        view
        returns (bool)
    {
        // If caller is the contract owner, or...
        if (_caller == owner()) {
            return true;
        }
        // If caller is the DAO, or..
        if (_caller == _dao && hasDepositContract(_dao)) {
            return true;
        }
        // If caller is a representative of the dao
        if (representative[_dao][_caller]) {
            return true;
        }
        // Rest: not DAO, DAOplomat or Owner -> false
        return false;
    }

    // Returns whether the address is the DAO or a representative of
    // a DAO from an array of DAOs or the contract owner.
    function isDAOorOwnerFromArray(
        address _caller,
        address[] memory _involvedDAOs
    ) public view returns (bool) {
        // If caller is the contract owner, or...
        if (_caller == owner()) {
            return true;
        }
        for (uint256 i = 0; i < _involvedDAOs.length; i++) {
            // If caller is one of the registered DAOs, or..
            if (
                _caller == _involvedDAOs[i] &&
                hasDepositContract(_involvedDAOs[i])
            ) {
                return true;
            }
            // If caller is a representative of one of the daos
            if (representative[_involvedDAOs[i]][_caller]) {
                return true;
            }
        }
        // Rest: not DAO, DAOplomat or Owner -> false
        return false;
    }

    modifier onlyDAOorOwner(address _dao) {
        require(isDAOorOwner(msg.sender, _dao), "BASECONTRACT-NOT-AUTHROIZED");
        _;
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
