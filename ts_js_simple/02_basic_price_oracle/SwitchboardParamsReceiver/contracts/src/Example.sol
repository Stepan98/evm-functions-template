//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {FunctionsClient} from "./FunctionsClient.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ReceiverExample is FunctionsClient {
    // Events
    event OrderCreated(uint256 orderId, address callId, address sender);
    event OrderResolved(uint256 orderId, address callId, uint256 value);

    // Errors
    error InvalidValue(uint256 value);
    error InvalidOrder(uint256 orderId);
    error InvalidCallbackType();

    // Structs
    struct Order {
        address callId;
        address sender;
        uint256 value;
        bool filled;
    }

    // Constants
    uint256 public constant EXPECTED_FUNCTION_GAS_COST = 300_000;

    // State variables
    address functionId;
    uint256 nextOrderId;
    mapping(uint256 => Order) public orders;
    mapping(address => uint256) public callIdToOrderId;
    uint256 public latestValue;

    // Constructor - set the contract address
    constructor(
        address _switchboard // Switchboard contract address
    ) FunctionsClient(_switchboard) {}

    // Call the switchboard function with the order parameters
    // The function will call back into fillOrder with the value
    function createOrder() external payable {
        // make sure the value is correct - this will make it so the downstream users
        //  / order creators are the ones paying for the order execution
        if (msg.value < EXPECTED_FUNCTION_GAS_COST * tx.gasprice) {
            revert InvalidValue(msg.value);
        }

        // encode the order parameters
        string[] memory args = new string[](2);
        args[0] = Strings.toString(nextOrderId);
        args[1] = Strings.toHexString(uint160(msg.sender), 20);

        // call out to the swithcboard function, triggering an off-chain run
        address callId = initializeRequest(args);

        // store the order data
        orders[nextOrderId].sender = msg.sender;
        orders[nextOrderId].callId = callId;
        callIdToOrderId[callId] = nextOrderId;

        // emit an event
        emit OrderCreated(nextOrderId, callId, msg.sender);

        // increment nextOrderId
        nextOrderId++;
    }

    // Trigger callback logic
    function onCallback() internal override {
        // expecting a new Uint256
        if (latestCallbackType != CallbackType.CALLBACK_UINT256) {
            revert InvalidCallbackType();
        }
        fillOrder();
    }

    // Callback into contract with value computed off-chain
    function fillOrder() internal {
        address callId = latestCallbackCallId;
        uint256 value = latestValueUint256;
        uint256 orderId = callIdToOrderId[callId];

        // sanity check that the order has been registered
        if (orders[orderId].sender == address(0)) {
            revert InvalidOrder(orderId);
        }

        // fill order and mark it as filled
        orders[orderId].value = value;
        orders[orderId].filled = true;

        latestValue = value;

        // emit an event
        emit OrderResolved(orderId, msg.sender, value);
    }
}
