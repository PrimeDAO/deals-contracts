// SPDX-License-Identifier: Unlicense
pragma solidity >=0.6.2;

interface IAsset {
    // solhint-disable-previous-line no-empty-blocks
}

interface IBalancerV2 {
    function joinPool(
        bytes32 poolId,
        address sender,
        address recipient,
        JoinPoolRequest memory request
    ) external payable;

    struct JoinPoolRequest {
        IAsset[] assets;
        uint256[] maxAmountsIn;
        bytes userData;
        bool fromInternalBalance;
    }
}
