import { BigNumber, ethers, utils, Contract } from "ethers";
import { FunctionRunner } from "@switchboard-xyz/evm.js";

// Generate a random number and call into "callback"
async function main() {
  // Create a FunctionRunner
  const runner = new FunctionRunner();

  // get contract - we only need the one callback function in the abi
  const iface = new ethers.utils.Interface(["function callback(uint256)"]);
  const contract = new Contract(
    "0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41",
    iface,
    runner.enclaveWallet
  );

  // get random uint256
  const randomBytes = utils.randomBytes(32);
  const bn = BigNumber.from(Array.from(randomBytes));

  // get txn
  const txn = await contract.populateTransaction.callback(bn);

  // emit txn
  await runner.emit([txn]);
}

// run switchboard function
main();
