import { BigNumber, ethers, utils, Contract } from "ethers";
import { FunctionRunner } from "@switchboard-xyz/evm.js";
import { Functions } from "./Functions";
import { Log } from "./Log";
import { getRequestConfig } from "./utils";
import * as config from "../config";
import * as vm from "node:vm";

// Run the switchboard function
async function main() {
  // Create a FunctionRunner
  const runner = new FunctionRunner();

  // Get config for the request
  const requestConfig = getRequestConfig(config);

  // Contract interface for FunctionsClient
  const iface = new ethers.utils.Interface([
    "callbackUint256(uint256 value)",
    "callbackInt256(int256 value)",
    "callbackBytes(bytes value)",
    "callbackString(string value)",
  ]);

  // Get the contract address
  const contract = new Contract(
    process.env.SWITCHBOARD_RECEIVER_ADDRESS,
    iface,
    runner.enclaveWallet
  );

  // Get params from the request
  const requests = runner.rawParams.length
    ? runner.params(["string[]"])
    : [{ callId: "", params: config.args as utils.Result }];

  // get idx of return type
  const returnTypeIdx = ["uint256", "int256", "string", "Buffer"].indexOf(
    config.expectedReturnType
  );

  // get callback function for return type
  const callback = [
    contract.populateTransaction.callbackUint256,
    contract.populateTransaction.callbackInt256,
    contract.populateTransaction.callbackString,
    contract.populateTransaction.callbackBytes,
  ][returnTypeIdx];

  // Handle all params in parallel
  const functionCalls = requests.map(async (request) => {
    // Get params from the request
    const { params: args } = request;

    // Function context
    const context = {
      Functions,
      Log,
      args: args && args.length ? args[0] : [],
    };

    // Result
    let result: BigNumber | Buffer | string;

    // Try evaluating the javascript function
    // this expects to only run safe/trusted (user-owned) code [equivalent to JS "eval"]
    try {
      result = await vm.runInContext(
        requestConfig.source,
        vm.createContext(context)
      );
      return await callback(result);
    } catch (err) {
      console.log(err);
      return undefined;
    }
  });

  // wait for all calls to populate, filter bad params
  const calls = (await Promise.all(functionCalls)).filter(
    (c) => c !== undefined
  );

  // emit txn
  await runner.emit(calls);
}

// run switchboard function
main();
