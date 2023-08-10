# Switchboard Params Receiver

<div align="center">
  <img src="https://github.com/switchboard-xyz/sbv2-core/raw/main/website/static/img/icons/switchboard/avatar.png" />

  <h1>Switchboard<br>EVM Functions Template</h1>

  <p>
    <a href="https://discord.gg/switchboardxyz">
      <img alt="Discord" src="https://img.shields.io/discord/841525135311634443?color=blueviolet&logo=discord&logoColor=white" />
    </a>
    <a href="https://twitter.com/switchboardxyz">
      <img alt="Twitter" src="https://img.shields.io/twitter/follow/switchboardxyz?label=Follow+Switchboard" />
    </a>
  </p>
</div>

## Table of Content

- [Prerequisites](#prerequisites)
  - [Installing Docker](#installing-docker)
  - [Docker Setup](#docker-setup)
  - [Build and Push](#build-and-push)
- [Components](#components)
  - [Contract](#contract)
  - [Switchboard Function](#switchboard-function)
  - [Publishing and Initialization](#publishing-and-initialization)
  - [Adding Funding to Function](#adding-funding-to-function)
  - [Printing Function Data](#printing-function-data)
- [Writing Switchboard Rust Functions](#writing-switchboard-rust-functions)
  - [Setup](#setup)
  - [Minimal Example](#minimal-switchboard-function)
  - [Deploying and maintenance](#deploying-and-maintenance)
- [Writing Receiver Contracts](#writing-receiver-contracts)
  - [Receiver Example](#receiver-example)

## Prerequisites

Before you can build and run the project, you'll need to have Docker installed on your system. Docker allows you to package and distribute applications as lightweight containers, making it easy to manage dependencies and ensure consistent behavior across different environments. Switchboard Functions are built and run within containers, so you'll need a docker daemon running to publish a new function.

### Installing Docker

If you don't have Docker installed, you can follow these steps to get it up and running:

1. **Linux**: Depending on your Linux distribution, you might need to use different package managers. For Ubuntu, you can use `apt`:

   ```bash
   sudo apt update
   sudo apt install docker.io
   ```

   For other distributions, consult your package manager's documentation.

2. **macOS**: You can install Docker Desktop for macOS by downloading the installer from the [Docker website](https://www.docker.com/products/docker-desktop) and following the installation instructions.

3. **Windows**: Similarly, you can install Docker Desktop for Windows from the [Docker website](https://www.docker.com/products/docker-desktop) and follow the provided instructions.

### Docker Setup

After installing Docker, make sure it's running by opening a terminal/command prompt and running:

```bash
docker --version
```

This should display the installed Docker version, confirming that Docker is installed and running properly.

You'll need to login to docker. If you don't yet have an account, you'll need one to publish images to dockerhub. You can sign up at [https://hub.docker.com](https://hub.docker.com).

```bash
docker login --username <your-username> --password <your-password>
```

## Components

### Contract

This SwitchboardParamsReceiver contract is a simple contract that receives a set of parameters from a switchboard function call. Thec contract calls switchboard to initialize a function run - which will call back into the receiver contract with data.

When you deploy this contract, it will await to be bound to a switchboard function calling into it.

#### Picking a network and setting up your environment

- navigate to the [Project README.md](../../README.md) and find the switchboard deployment address
- set the `SWITCHBOARD_ADDRESS` env variable to target whichever address is appropriate for the network you're targetting

To first deploy the contract, run:

```bash
# ex:
# pnpm deploy:coredaotestnet
# pnpm deploy:coredaomain
# pnpm deploy:arbitrumtestnet
pnpm deploy:${NETWORK_NAME}
```

More deploy commands are available in [package.json](./package.json) scripts.

You will see the last line of this script output

```bash
export SWITCHBOARD_PARAMS_ADDRESS=<RECEIVER_ADDRESS>
```

### Switchboard Function

Export the address to your environment and navigate to `./switchboard-function/`

The bulk of the function logic can be found in [./switchboard-function/src/main.rs](switchboard-function/src/main.rs).

Build functions from the `switchboard-function/` directory with

```bash
make build
```

### Publishing and Initialization

You'll also need to pick a container name that your switchboard function will use on dockerhub.

```bash
export CONTAINER_NAME=your_docker_username/switchboard-function
```

Here, set the name of your container to deploy and run `make build`

After this is published, you are free to make your function account to set the rate of run for the function.

### Initializing the function

See `scripts/create_function.ts` to create and deploy the function:

```bash
npx hardhat run scripts/create_function.ts  --network arbitrumTestnet --container switchboardlabs/test --schedule "30 * * * * *"
```

### Adding Funding to Function

Add funds to your function by doing the following:

```bash
npx hardhat run scripts/extend_function.ts --network arbitrumTestnet --functionId=$FUNCTION_ADDRESS --eth 0.1
```

### Printing Function Data

Now view your function config to endure it is to your liking:

```bash
npx hardhat run scripts/check_function.ts --network arbitrumTestnet --functionId=$FUNCTION_ADDRESS
```

## Writing Switchboard Rust Functions

In order to write a successfully running switchboard function, you'll need to import `switchboard-evm` to use the libraries which communicate the function results (which includes transactions to run) to the Switchboard Verifiers that execute these metatransactions.

### Setup

Cargo.toml

```toml
[package]
name = "function-name"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "function-name"
path = "src/main.rs"

[dependencies]
tokio = "^1"
futures = "0.3"

# at a minimum you'll need to include the following packages
ethers = { version = "2.0.7", features = ["legacy"] } # legacy is only for networks that do not support https://eips.ethereum.org/EIPS/eip-2718
switchboard-evm = "0.3.5"
```

### Minimal Switchboard Function

main.rs

```rust
use ethers::{
    prelude::{abigen, SignerMiddleware, ContractCall},
    providers::{Http, Provider},
    types::{U256},
};
use rand;
use std::sync::Arc;
use std::time::{SystemTime, Duration};
use switchboard_evm::{
    sdk::{EVMFunctionRunner, EVMMiddleware},
};


#[tokio::main(worker_threads = 12)]
async fn main() {

    // define the abi for the functions in the contract you'll be calling
    // -- here it's just a function named "callback", expecting a random u256
    abigen!(
        Receiver,
        r#"[
            function callback(uint256)
        ]"#,
    );

    // Generates a new enclave wallet, pulls in relevant environment variables
    let function_runner = EVMFunctionRunner::new().unwrap();

    // set the gas limit and expiration date
    let gas_limit = 1000000;
    let expiration_time_seconds = 60;
    let current_time = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or(Duration::ZERO)
            .as_secs() + 64;


    // create a client, wallet and middleware. This is just so we can create the contract instance and sign the txn.
    // @TODO: update the provider to whichever network you're using
    let provider = Provider::<Http>::try_from("https://rpc.test.btcs.network").unwrap();
    let client = Arc::new(
        SignerMiddleware::new_with_provider_chain(provider.clone(), function_runner.enclave_wallet.clone())
            .await
            .unwrap(),
    );

    // @TODO: your target contract address here
    // In the push receiver example this is set via environment variable
    let contract_address = "0x1cEA45f047FEa89887B79ce28723852f288eE09B"
        .parse::<ethers::types::Address>()
        .unwrap();
    let receiver_contract = Receiver::new(contract_address, client);

    // generate a random number U256
    let random: [u64; 4] = rand::random();
    let random = U256(random);

    // call function
    let contract_fn_call: ContractCall<EVMMiddleware<_>, _> =
        receiver_contract.callback(random);

    // create a vec of contract calls to pass to the function runner
    let calls = vec![contract_fn_call.clone()];

    // Emit the result
    // This will encode and sent the function data and run them as metatransactions
    // (in a single-tx) originating from the switchboard contract with the functionId encoded as the sender
    // https://eips.ethereum.org/EIPS/eip-2771
    function_runner.emit(
        contract_address,
        current_time.try_into().unwrap(),
        gas_limit.into(),
        calls,
    ).unwrap();
}
```

### Deploying and Maintenance

After you publish the function and create it on the blockchain, you must keep the function escrow account funded to cover gas fees. Revisions to the function can be made by deploying a new version and updating the function config on-chain.

## Writing Receiver Contracts

While Switchboard Functions can call back into any number of on-chain functions, it's useful to limit access to some privileged functions to just _your_ Switchboard Function.

In order to do this you'll need to know the switchboard address you're using, and which functionId will be calling into the function in question.

### Receiver Example

Recipient.sol

```sol
//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// EIP2771 Context
// Inherited by all contracts that are recipients of switchboard callbacks
contract Recipient {
  address immutable switchboard;

  constructor(address _switchboard) {
    switchboard = _switchboard;
  }

  // get the encoded sender if this message is coming from the switchboard contract
  // if things are working as intended, the sender will be the functionId

  function getMsgSender() internal view returns (address payable signer) {
    signer = payable(msg.sender);
    if (msg.data.length >= 20 && signer == switchboard) {
      assembly {
        signer := shr(96, calldataload(sub(calldatasize(), 20)))
      }
    }
  }
}
```

Example.sol

```sol
//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import { Recipient } from "./Recipient.sol";

contract ReceiverExample is Recipient {
  uint256 public randomValue;
  address functionId;

  event NewRandomValue(uint256 value);

  constructor(
    address _switchboard, // Switchboard contract address
    address _functionId // Function id corresponding to the randomness function oracle
  ) Recipient(_switchboard) {
    functionId = _functionId;
  }

  function callback(uint256 value) external {
    // extract the sender from the callback, this validates that the switchboard contract called this function
    address msgSender = getMsgSender();

    // make sure the encoded caller is our function id
    if (msgSender != functionId) {
      revert("Invalid sender");
    }

    // set the random value
    randomValue = value;

    // emit an event
    emit NewRandomValue(value);
  }
}
```
