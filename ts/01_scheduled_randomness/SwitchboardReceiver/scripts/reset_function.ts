//setFunctionConfig
import { ethers } from "hardhat";
import { SwitchboardProgram, FunctionAccount } from "@switchboard-xyz/evm.js";

async function main() {
  const [deployer] = await ethers.getSigners();

  const diamondAddress =
    process.env.SWITCHBOARD_ADDRESS ?? process.env.DIAMOND_ADDRESS ?? "";

  if (!diamondAddress) {
    throw new Error(
      "Please set the diamond address with: export SWITCHBOARD_ADDRESS=..."
    );
  }

  const functionId = process.env.FUNCTION_ID ?? "";
  if (!functionId) {
    throw new Error("Please set the function ID with: export FUNCTION_ID=...");
  }

  const containerName = process.env.CONTAINER_NAME ?? "";
  if (!containerName) {
    throw new Error(
      "Please set the container name with: export CONTAINER_NAME=..."
    );
  }

  console.log(
    "Extending the function with account:",
    await deployer.getAddress()
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const switchboardProgram = await SwitchboardProgram.load(
    deployer,
    diamondAddress
  );

  // FUND FUNCTION
  const tx = await switchboardProgram.sb.setFunctionConfig(
    functionId,
    "try #4",
    deployer.address,
    "dockerhub",
    containerName,
    "latest",
    "* 1 * * * *",
    "",
    []
  );

  // WAIT FOR TX
  const receipt = await tx.wait();
  console.log(receipt);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
