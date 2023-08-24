//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Get the Switchboard Library - this is the Core Mainnet Deployment, you can swap this for one of the networks below
import {Switchboard} from "@switchboard-xyz/evm.js/contracts/core/testnet/Switchboard.sol";

// import {Switchboard} from "@switchboard-xyz/evm.js/contracts/core/Switchboard.sol";

/*
 * NOTE: replace with one of the following imports to use an actual network deployment
 * import {Switchboard} from "@switchboard-xyz/evm.js/contracts/core/testnet/Switchboard.sol";
 * import {Switchboard} from "@switchboard-xyz/evm.js/contracts/core/Switchboard.sol";
 * import {Switchboard} from "@switchboard-xyz/evm.js/contracts/arbitrum/testnet/Switchboard.sol";
 * import {Switchboard} from "@switchboard-xyz/evm.js/contracts/arbitrum/Switchboard.sol";
 * etc...
 */

contract SwitchboardReceiver {
    uint256 public randomValue;
    address functionId;

    event NewRandomValue(uint256 value);

    function callback(uint256 value) external {
        // extract the sender from the callback, this validates that the switchboard contract called this function
        address encodedFunctionId = Switchboard.getEncodedFunctionId();

        // set functionId to the sender if it's empty and the sender is the switchboard
        if (functionId == address(0)) {
            functionId = encodedFunctionId;
        }

        // make sure the encoded caller is our function id
        if (encodedFunctionId != functionId) {
            revert("Invalid sender");
        }

        // set the random value
        randomValue = value;

        // emit an event
        emit NewRandomValue(value);
    }
}
