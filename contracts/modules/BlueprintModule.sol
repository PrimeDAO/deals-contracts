// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

import "./ModuleBase.sol";
import "../utils/interfaces/IDealManager.sol";

contract BlueprintModule is ModuleBase {
    Blueprint[] public blueprints;

    struct Blueprint {
        address[] daos;
        uint256 value1;
        address value2;
        string value3;
        uint256 executionDate;
        bool isExecuted;
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

    constructor(address _dealManager)
        ModuleBase(_dealManager)
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

        Blueprint memory newBlueprint = Blueprint(
            _daos,
            _value1,
            _value2,
            _value3,
            0,
            false
        );
        blueprints.push(newBlueprint);
        uint32 id = uint32(blueprints.length - 1);
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
        public
        view
        validId(_id)
        returns (bool)
    {
        Blueprint storage blueprint = blueprints[_id];
        if (blueprint.isExecuted) {
            return false;
        }

        return true;
    }

    function executeAction(uint256 _id)
        external
        validId(_id)
        isNotExecuted(_id)
    {
        Blueprint memory blueprint = blueprints[_id];

        require(
            checkExecutability(_id),
            "Module: execution conditions not met"
        );

        blueprint.isExecuted = true;
        blueprint.executionDate = block.timestamp;
        emit ActionExecuted(_id);
    }

    modifier validId(uint256 _id) {
        require(_id < blueprints.length, "Module: id doesn't exist");
        _;
    }

    modifier isNotExecuted(uint256 _id) {
        require(!blueprints[_id].isExecuted, "Module: has been executed");
        _;
    }
}
