import { ethers } from "hardhat";

async function main() {
  const sbPushAddress = process.env.SWITCHBOARD_PUSH_ADDRESS ?? "";

  if (!sbPushAddress) {
    throw new Error(
      "Please set the diamond address with: export SWITCHBOARD_PUSH_ADDRESS=..."
    );
  }

  const push = await ethers.getContractAt("Receiver", sbPushAddress);
  const p = await push.deployed();

  const feeds = await p.getAllFeeds();
  console.log(feeds);

  feeds.map((feed) => {
    const feedName = ethers.utils.parseBytes32String(feed.feedName);
    console.log(
      feedName,
      feed.feedId.toString(),
      feed.latestResult.value.toString()
    );
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
