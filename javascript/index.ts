import dotenv from "dotenv";

import { BigNumber, ethers, providers, PopulatedTransaction } from "ethers";
import { Interface, parseEther } from "ethers/lib/utils";
import { FunctionRunner } from "@switchboard-xyz/evm.js";

dotenv.config();

const constructTransaction = async (
  signer: ethers.Wallet,
  targetAddress: string,
  chainId: number
): Promise<PopulatedTransaction> => {
  let from_address = signer.address;

  let to_address = "0x6072257E80d54C5b739893358752d81E16c38E75";

  let amt = parseEther("0.0001");

  // let nonce = await signer.getTransactionCount();

  let gasPrice = 100000;

  let abi = ["function transfer(address to, uint amount)"];

  let gasLimit = 250000;

  let value = amt.toNumber() + gasLimit * gasPrice;

  let iface = new Interface(abi);
  let data = iface.encodeFunctionData("transfer", [to_address, amt]);
  const populatedTxn = {
    from: from_address,

    gasPrice: BigNumber.from(gasPrice),
    gasLimit: BigNumber.from(gasLimit),
    to: targetAddress,
    value: BigNumber.from(value),
    data: data,
    chainId: chainId,
  };

  return populatedTxn;
};

async function main() {
  const verifyingContract = process.env.VERIFYING_CONTRACT;
  const targetContract = process.env.TARGET_CONTRACT;
  const CHAIN_ID = process.env.CHAIN_ID;
  if (!verifyingContract || !targetContract || !CHAIN_ID)
    throw new Error("Missing env vars");
  const provider = new providers.JsonRpcProvider("https://eth.llamarpc.com");
  const enclaveWallet = ethers.Wallet.createRandom(provider);
  let fn_key = ethers.Wallet.createRandom(provider);
  const signer = new ethers.Wallet(
    ethers.Wallet.createRandom(provider).privateKey,
    provider
  );
  const runner = new FunctionRunner(
    verifyingContract,
    enclaveWallet,
    signer,
    Number(CHAIN_ID)
  );
  const txn = await constructTransaction(
    fn_key,
    targetContract,
    Number(CHAIN_ID)
  );
  let expirationTimeSeconds = 35;
  let gasLimit = 250000;
  await runner.emit([txn], expirationTimeSeconds, gasLimit.toString());
}

main();
