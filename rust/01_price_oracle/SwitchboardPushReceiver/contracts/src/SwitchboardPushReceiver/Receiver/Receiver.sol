//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {ReceiverLib} from "./ReceiverLib.sol";
import {Aggregator} from "./Aggregator.sol";
import {Recipient} from "../util/Recipient.sol";
import {ErrorLib} from "../error/ErrorLib.sol";
import {EventLib} from "../event/EventLib.sol";
import {AdminLib} from "../admin/AdminLib.sol";

// Main contract for Switchboard's Pull Model
contract Receiver is Recipient {
    // Switchboard Function will call this function with the feed ids and values
    function callback(
        bytes32[] memory _feedNames, // feed names
        int256[] memory values, // the value of the feed
        uint256 timestamp // data timestamp
    ) external {

        if (AdminLib.functionId() == address(0)) {
            AdminLib.setFunctionId(getMsgSender());
        }
        // Assert that the sender is switchboard & the correct function id is encoded
        verifySwitchboardFunction();

        // make sure the input lengths are correct
        if (_feedNames.length != values.length) {
            revert ErrorLib.IncorrectInputLength();
        }

        // Update each feed internally
        ReceiverLib.callback(_feedNames, values, timestamp);
    }

    // Deploy a Classic Push Model Adapter
    function deployFeedAdapter(
        address feedId,
        string memory name,
        string memory description
    ) external {
        // get feed hash
        bytes32 feedName = ReceiverLib.feedIdToName(feedId);

        // create the aggregator contract
        Aggregator aggregator = new Aggregator(
            AdminLib.switchboard(),
            feedId,
            feedName,
            name,
            description
        );

        // Turn on feed history to enable adapter APIs for this feed in particular
        ReceiverLib.toggleFeedHistory(feedId, true);

        emit EventLib.NewAdapter(feedName, address(aggregator), msg.sender);
    }

    // Get the latest result for a feed
    function getLatestResult(
        address feedId
    )
        external
        returns (
            int256 value,
            uint256 timestamp,
            uint256 updatedAt,
            uint80 intervalId
        )
    {
        bytes32 feedName = ReceiverLib.feedIdToName(feedId);
        ReceiverLib.Feed memory feed = ReceiverLib.feeds(feedName);
        value = feed.latestResult.value;
        timestamp = feed.latestResult.startedAt;
        updatedAt = feed.latestResult.updatedAt;
        intervalId = feed.latestIntervalId;
        if (intervalId == 0) {
            revert ErrorLib.FeedUninitialized(feedId);
        }
        emit EventLib.ReadEvent(feedId, msg.sender, value, timestamp);
    }

    // View functions
    // results - get a result for a feed and interval   @NOTE: can return empty values
    // feeds - get a feed                               @NOTE: will return default values if feed doesn't exist
    // feedNames - get all feed names
    // getAllFeeds - get all feeds

    function results(
        bytes32 feedName,
        uint80 intervalId
    ) external view returns (ReceiverLib.Result memory) {
        return ReceiverLib.results(feedName, intervalId);
    }

    function feeds(
        bytes32 feedName
    ) external view returns (ReceiverLib.Feed memory) {
        return ReceiverLib.feeds(feedName);
    }

    function feedNames() external view returns (bytes32[] memory) {
        return ReceiverLib.feedNames();
    }

    function getAllFeeds() external view returns (ReceiverLib.Feed[] memory) {
        return ReceiverLib.getAllFeeds();
    }
}
