// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "./ModuleBase.sol";
import "../interfaces/IDealManager.sol";

contract BlueprintModule is ModuleBase {
    Blueprint[] public blueprints;

    struct Blueprint {
        address[] daos;
        uint256 value1;
        address value2;
        string value3;
        uint256 executionDate;
        Status status;
    }

    event ActionCreated(
        uint256 id,
        address[] _daos,
        uint256 value1,
        address value2,
        string value3
    );

    event ActionCancelled(uint256 id);

    event ActionExecuted(uint256 id);

    constructor(address _dealmanager)
        ModuleBase(_dealmanager)
    // solhint-disable-next-line no-empty-blocks
    {

    }

    function createAction(
        address[] calldata _daos,
        uint256 _value1,
        address _value2,
        string calldata _value3
    ) public returns (uint256) {
        require(_daos.length >= 2, "Module: at least 2 daos required");

        require(
            _value1 > 0 && _value2 != address(0) && bytes(_value3).length > 0,
            "Module: invalid inputs"
        );

        uint256 id = blueprints.length + 1;
        Blueprint memory newBlueprint = Blueprint(
            _daos,
            _value1,
            _value2,
            _value3,
            0,
            Status.ACTIVE
        );
        blueprints.push(newBlueprint);
        emit ActionCreated(id, _daos, _value1, _value2, _value3);
        return id;
    }

    function createDepositContractsAndCreateAction(
        address[] calldata _daos,
        uint256 _value1,
        address _value2,
        string calldata _value3
    ) external returns (uint256) {
        uint256 newId = createAction(_daos, _value1, _value2, _value3);
        for (uint256 i; i < _daos.length; ++i) {
            if (!dealManager.hasDaoDepositManager(_daos[i])) {
                dealManager.createDaoDepositManager(_daos[i]);
            }
        }
        return newId;
    }

    function checkExecutability(uint256 _id)
        external
        view
        validId(_id)
        returns (bool)
    {
        Blueprint storage blueprint = blueprints[_id];
        if (blueprint.status != Status.ACTIVE) {
            return false;
        }

        if (
            blueprint.value1 > 0 &&
            blueprint.value2 != address(0) &&
            bytes(blueprint.value3).length > 0
        ) {
            return true;
        }

        return true;
    }

    function executeAction(uint256 _id)
        external
        validId(_id)
        activeStatus(_id)
    {
        Blueprint memory blueprint = blueprints[_id];

        require(
            blueprint.value1 > 0 &&
                blueprint.value2 != address(0) &&
                bytes(blueprint.value3).length > 0,
            "Module: execution conditions not met"
        );

        blueprint.status = Status.DONE;
        blueprint.executionDate = block.timestamp;
        emit ActionExecuted(_id);
    }

    modifier validId(uint256 _id) {
        require(_id <= blueprints.length, "Module: id doesn't exist");
        _;
    }

    modifier activeStatus(uint256 _id) {
        require(
            blueprints[_id].status == Status.ACTIVE,
            "Module: id not active"
        );
        _;
    }
}
