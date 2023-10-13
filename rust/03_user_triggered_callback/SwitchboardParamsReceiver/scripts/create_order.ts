import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const receiver = process.env.SWITCHBOARD_RECEIVER_ADDRESS ?? "";
  const functionId = process.env.FUNCTION_ID ?? "";

  if (!functionId) {
    throw new Error("Please set the function id with: export FUNCTION_ID=...");
  }

  if (!receiver) {
    throw new Error(
      "Please set the diamond address with: export SWITCHBOARD_RECEIVER_ADDRESS=..."
    );
  }

  console.log("Account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const receiverContract = await ethers.getContractAt(
    "SwitchboardParamsReceiver",
    receiver
  );

  // check it it's initialized, initialize it if it's not
  if ((await receiverContract.isInitialized()) === false) {
    const tx = await receiverContract.initialize(functionId);
    await tx.wait();
  }

  // TODO: modify this number per network - must be Gas Price * 300_000 (300k gas)
  const resp = await receiverContract.createOrder({
    value: 9_000_000_000_000_000,
  });
  const tx = await resp.wait();
  console.log("Tx:", tx);

  // get the order id from the event `event OrderCreated(uint256 orderId, address callId, address sender);`
  const orderId = tx.events[2].args.orderId.toNumber();

  // await order to be filled
  console.log("AWAITING ORDERID", orderId);
  let order = await receiverContract.orders(orderId);
  while (order.filled === false) {
    console.log("AWAITING ORDERID");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    order = await receiverContract.orders(orderId);
  }

  // log that we're done
  console.log("ORDER FILLED", order);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
