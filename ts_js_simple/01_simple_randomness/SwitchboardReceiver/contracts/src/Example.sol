//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {FunctionsClient} from "./FunctionsClient.sol";

contract ReceiverExample is FunctionsClient {
    uint256 public randomValue;

    event NewRandomValue(uint256 value);
    error InvalidCallbackType();

    constructor(
        address _switchboard // Switchboard contract address
    ) FunctionsClient(_switchboard) {}

    function onCallback() internal override {
        // expecting a new Uint256
        if (latestCallbackType != CallbackType.CALLBACK_UINT256) {
            revert InvalidCallbackType();
        }

        // expecting a new Uint256
        randomValue = latestValueUint256;
        emit NewRandomValue(randomValue);
    }
}