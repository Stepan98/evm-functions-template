import { ethers } from "hardhat";
import { SwitchboardProgram, FunctionAccount } from "@switchboard-xyz/evm.js";

async function main() {
  const [deployer] = await ethers.getSigners();
  const sbPushAddress = process.env.SWITCHBOARD_PUSH_ADDRESS ?? "";
  const diamondAddress = process.env.SWITCHBOARD_ADDRESS ?? "";
  const newFunctionId = process.env.FUNCTION_ID ?? "";

  if (!sbPushAddress) {
    throw new Error(
      "Please set the switchboard push address with: export SWITCHBOARD_PUSH_ADDRESS=..."
    );
  }

  if (!diamondAddress) {
    throw new Error(
      "Please set the switchboard address with: export SWITCHBOARD_ADDRESS=..."
    );
  }

  if (!newFunctionId) {
    throw new Error("Please set the function ID with: export FUNCTION_ID=...");
  }

  const push = await ethers.getContractAt("Admin", sbPushAddress);
  const p = await push.deployed();

  // SET NEW SWITCHBOARD ADDRESS
  const tx1 = await p.setSwitchboard(diamondAddress);
  await tx1.wait();

  // SET NEW FUNCTION ID
  const tx2 = await p.setFunctionId(newFunctionId);
  await tx2.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
