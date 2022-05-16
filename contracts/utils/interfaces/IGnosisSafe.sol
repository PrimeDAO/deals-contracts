// SPDX-License-Identifier: Unlicense
pragma solidity >=0.6.2;

interface GnosisSafeSetup {
    function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;
}

interface ProxyFactory {
    function createProxy(address masterCopy, bytes calldata data)
        external
        returns (address payable proxy);
}
