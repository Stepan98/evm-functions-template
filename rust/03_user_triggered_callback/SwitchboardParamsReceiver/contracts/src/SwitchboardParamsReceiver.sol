//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Get the Switchboard Library - this is the Core Mainnet Deployment, you can swap this for one of the networks below
import {ISwitchboard} from "@switchboard-xyz/evm.js/contracts/ISwitchboard.sol";

// An example of a contract where we pass some parameters to the callback function so we can
// handle individual orders in a batch.
contract SwitchboardParamsReceiver {
    // Events
    event OrderCreated(uint256 orderId, address callId, address sender);
    event OrderResolved(uint256 orderId, address callId, uint256 value);

    // Errors
    error InvalidValue(uint256 value);
    error InvalidSender(address expected, address actual);
    error InvalidOrder(uint256 orderId);
    error MissingEncodedFunctionId();
    error AlreadyInitialized(address functionId);

    // Structs
    struct Order {
        address callId;
        address sender;
        uint256 value;
        bool filled;
    }

    // Switchboard Function Parameters
    // This struct will be defined here, but also in the Switchboard Function itself
    // We will abi.decode it off-chain to get the parameters
    struct OrderParams {
        uint256 orderId;
        address sender;
    }

    // Constants
    uint256 public constant EXPECTED_FUNCTION_GAS_COST = 300_000;

    // State variables
    address switchboardAddress;
    address functionId;
    uint256 nextOrderId;
    mapping(uint256 => Order) public orders;
    uint256 public latestValue;

    constructor(address _switchboard) {
        switchboardAddress = _switchboard;
        nextOrderId = 1;
    }

    // Call the switchboard function with the order parameters
    // The function will call back into fillOrder with the value
    function createOrder() external payable {
        // make sure the value is correct - this will make it so the downstream users
        //  / order creators are the ones paying for the order execution
        if (msg.value < EXPECTED_FUNCTION_GAS_COST * tx.gasprice) {
            revert InvalidValue(msg.value);
        }

        // encode the order parameters
        bytes memory encodedOrder = abi.encode(
            OrderParams({orderId: nextOrderId, sender: msg.sender})
        );

        // call out to the swithcboard function, triggering an off-chain run
        address callId = ISwitchboard(switchboardAddress).callFunction{
            value: msg.value
        }(functionId, encodedOrder);

        // store the order data
        orders[nextOrderId].sender = msg.sender;
        orders[nextOrderId].callId = callId;

        // emit an event
        emit OrderCreated(nextOrderId, callId, msg.sender);

        // increment nextOrderId
        nextOrderId++;
    }

    // Callback into contract with value computed off-chain
    function fillOrder(uint256 orderId, uint256 value) external {
        // make sure that sender is the switchboard contract
        address signer = msg.sender;
        if (signer != switchboardAddress) {
            revert InvalidSender(switchboardAddress, signer);
        }

        // get encoded function id
        address encodedFunctionId = address(0);
        if (msg.data.length >= 20) {
            assembly {
                encodedFunctionId := shr(
                    96,
                    calldataload(sub(calldatasize(), 20))
                )
            }
        } else {
            revert MissingEncodedFunctionId();
        }

        // if callback hasn't been hit, set it on first function run
        // @NOTE: do not do this in production, this is just for ease of testing
        if (functionId == address(0)) {
            functionId = encodedFunctionId;
        }

        // make sure the encoded caller is our function id
        if (encodedFunctionId != functionId) {
            revert InvalidSender(functionId, encodedFunctionId);
        }

        // sanity check that the order has been registered
        if (orders[orderId].sender == address(0)) {
            revert InvalidOrder(orderId);
        }

        // fill order and mark it as filled
        orders[orderId].value = value;
        orders[orderId].filled = true;

        latestValue = value;

        // emit an event
        emit OrderResolved(orderId, encodedFunctionId, value);
    }

    // initialize the contract with the switchboard function id - can only be called once!
    function initialize(address _functionId) external {
        if (functionId != address(0)) {
            revert AlreadyInitialized(functionId);
        }
        functionId = _functionId;
    }

    function isInitialized() external view returns (bool) {
        return functionId != address(0);
    }
}
