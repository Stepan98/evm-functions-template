import { ethers } from "hardhat";
import { SwitchboardProgram, FunctionAccount } from "@switchboard-xyz/evm.js";
import { task } from "hardhat/config";

import * as yargs from "yargs/yargs";

const argv = yargs(process.argv).options({
  schedule: {
    type: "string",
    describe:
      "Cron style schedule including seconds or set to null for no schedule",
    demand: false,
    default: null,
  },
  queueAddress: {
    type: "string",
    describe: "QUEUE_ADDRESS",
    demand: false,
    default: "0x0618db2e61e4854d14de315d0eada8e2bc670590",
  },
  container: {
    type: "string",
    describe: "container",
    demand: true,
  },
}).argv;

async function main() {
  const [deployer] = await ethers.getSigners();
  const diamondAddress = process.env.SWITCHBOARD_ADDRESS ?? "";
  if (!diamondAddress) {
    throw new Error(
      "Please set the diamond address with: export SWITCHBOARD_ADDRESS=..."
    );
  }

  console.log("Account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  const switchboardProgram = await SwitchboardProgram.load(
    deployer,
    diamondAddress
  );

  const functionId = ethers.Wallet.createRandom().address;
  const [func, tx] = await FunctionAccount.create(
    switchboardProgram,
    {
      functionId: functionId,
      authority: deployer.address!,
      attestationQueue: argv.queueAddress!,
      name: "",
      containerRegistry: "dockerhub",
      container: argv.container!,
      schedule: argv.schedule!,
      version: "latest",
    },
    { value: ethers.utils.parseEther("0.1") }
  );

  const receipt = await tx.wait();
  console.log(`Function create signature: ${receipt.logs[0].transactionHash}`);
  console.log(`Function address: ${func.address}`);
  console.log(`Please run: export FUNCTION_ADDRESS=${func.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
