import { ethers } from "hardhat";
import { SwitchboardProgram, FunctionAccount } from "@switchboard-xyz/evm.js";
import * as yargs from "yargs/yargs";

const argv = yargs(process.argv).options({
  functionId: {
    type: "string",
    describe: "Function Address",
    demand: false,
    default: null,
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

  const functionId = argv.functionId!;

  console.log("Account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  const switchboardProgram = await SwitchboardProgram.load(
    deployer,
    diamondAddress
  );

  const func = await switchboardProgram.sb.funcs(functionId);
  console.log(func);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
