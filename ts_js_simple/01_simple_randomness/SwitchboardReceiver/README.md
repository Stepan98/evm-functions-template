# Switchboard Receiver

<div align="center">
  <img src="https://github.com/switchboard-xyz/sbv2-core/raw/main/website/static/img/icons/switchboard/avatar.png" />

  <h1>Switchboard<br>TS Functions Template</h1>

  <p>
    <a href="https://discord.gg/switchboardxyz">
      <img alt="Discord" src="https://img.shields.io/discord/841525135311634443?color=blueviolet&logo=discord&logoColor=white" />
    </a>
    <a href="https://twitter.com/switchboardxyz">
      <img alt="Twitter" src="https://img.shields.io/twitter/follow/switchboardxyz?label=Follow+Switchboard" />
    </a>
  </p>
</div>

## Table of Contents

- [Switchboard Receiver](#switchboard-receiver)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
    - [Node.js and Npm](#nodejs-and-npm)
    - [Installing Docker](#installing-docker)
    - [Docker Setup](#docker-setup)
  - [Components](#components)
    - [Contract](#contract)
      - [Picking a network and setting up your environment](#picking-a-network-and-setting-up-your-environment)
    - [Switchboard Function](#switchboard-function)
    - [Publishing and Initialization](#publishing-and-initialization)
    - [Initializing the function](#initializing-the-function)
    - [Adding Funding to Function](#adding-funding-to-function)
    - [Printing Function Data](#printing-function-data)
  - [Writing Switchboard TS Functions](#writing-switchboard-ts-functions)
    - [Setup](#setup)
    - [Minimal Switchboard Function](#minimal-switchboard-function)
    - [Testing your function](#testing-your-function)
    - [Deploying and Maintenance](#deploying-and-maintenance)
  - [Writing Receiver Contracts](#writing-receiver-contracts)
    - [Receiver Example](#receiver-example)

## Prerequisites

Before you can build and run the project, you'll need to have Node.js and npm installed on your system. You'll also need to have Docker installed on your system. Docker allows you to package and distribute applications as lightweight containers, making it easy to manage dependencies and ensure consistent behavior across different environments. Switchboard Functions are built and run within containers, so you'll need a docker daemon running to publish a new function.

### Node.js and Npm

If you don't have Node.js and npm installed, you can download and install them from the official Node.js website: [https://nodejs.org/](https://nodejs.org/)

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

This SwitchboardReceiver contract is a minimal example of a contract producing randomness in a callback function at a scheduled interval.

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
export SWITCHBOARD_RECEIVER_ADDRESS=<RECEIVER_ADDRESS>
```

### Switchboard Function

Export the address to your environment and navigate to `switchboard-function/`

The bulk of the function logic can be found in [./switchboard-function/src/index.ts](switchboard-function/src/index.ts).

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

You'll need the queue id and switchboard contract address from the [Project README.md](../../README.md) for the network you're targetting.

See `scripts/create_function.ts` to create and deploy the function:

```bash
export QUEUE_ID=0x392a3217624aC36b1EC1Cf95905D49594A4DCF64 # placeholder
export SCHEDULE="30 * * * * *" # 30 seconds
export CONTAINER_NAME=switchboardlabs/test
export PERMITTED_CALLERS=$SWITCHBOARD_RECEIVER_ADDRESS
pnpm exec hardhat run scripts/create_function.ts  --network arbitrumTestnet # or coredaoTestnet
```

### Adding Funding to Function

Add funds to your function by doing the following:

```bash
export FUNCTION_ID=0x96cE076e3Dda35679316b12F2b5F7b4A92C9a294
export ETH_VALUE="0.1"
pnpm exec hardhat run scripts/extend_function.ts  --network arbitrumTestnet
```

### Printing Function Data

Now view your function config to ensure it is to your liking:

```bash
export FUNCTION_ID=0x96cE076e3Dda35679316b12F2b5F7b4A92C9a294
pnpm exec hardhat run scripts/check_function.ts  --network arbitrumTestnet
```

## Writing Switchboard TS Functions

In order to write a successfully running switchboard function, you'll need to import `@switchboard-xyz/evm.js` to use the libraries which communicate the function results (which includes transactions to run) to the Switchboard Verifiers that execute these metatransactions.

### Setup

To get started, you'll need to install the all the dependencies.

```bash
pnpm i
```

### Minimal Switchboard Function

config.js

```javascript
const fs = require("fs");
const path = require("path");

const Location = {
  Inline: 0,
  Remote: 1,
};

const CodeLanguage = {
  JavaScript: 0,
  Typescript: 1,
};

const ReturnType = {
  uint: "uint256",
  uint256: "uint256",
  int: "int256",
  int256: "int256",
  string: "string",
  bytes: "Buffer",
  Buffer: "Buffer",
};

// Configure the request by setting the fields below
const requestConfig = {
  codeLocation: Location.Inline,
  codeLanguage: CodeLanguage.Typescript,
  walletPrivateKey: process.env.PRIVATE_KEY,
  secretsURLs: [],
  source: fs.readFileSync(path.join(__dirname, "./main.js")).toString(),
  args: ["1", "0x1"], // arguments passed to the function
  expectedReturnType: ReturnType.uint256,
  secrets: {},
  perNodeSecrets: [],
};

module.exports = requestConfig;
```

main.js

```javascript
const val = crypto.randomBytes(32);
const bn = BigInt(`0x${val.toString("hex")}`);

// Supply a random value
Functions.encodeUint256(bn);
```

### Testing your function

We can't guarantee that the function will run on the blockchain, but we can test that it compiles and runs locally.

Run the following to test your function:

```bash
export CHAIN_ID=12345 # can be any integer
export VERIFYING_CONTRACT=$SWITCHBOARD_ADDRESS # can be any valid address
export FUNCTION_KEY=$FUNCTION_ID # can be any valid address
pnpm build
pnpm test # Note: this will include a warning about a missing quote which can be safely ignored.
```

Successful output:

```bash
WARNING: Error generating quote. Function will not be able to be transmitted correctly.
FN_OUT: 7b2276657273696f6e223a312c2271756f7465223a5b5d2c22666e5f6b6579223a5b3134342c32332c3233322c34342c39382c32302c39372c3232392c3138392c33302c3235322c3133362c37362c332c3136382c3130362c3138322c34352c3137352c3137325d2c227369676e6572223a5b3135382c32332c3137302c3133322c3230302c3130322c35302c38352c31302c3134382c3235322c35372c3132362c372c31372c32352c37322c3131342c38322c3134365d2c22666e5f726571756573745f6b6579223a5b5d2c22666e5f726571756573745f68617368223a5b5d2c22636861696e5f726573756c745f696e666f223a7b2245766d223a7b22747873223a5b7b2265787069726174696f6e5f74696d655f7365636f6e6473223a313639313633383836332c226761735f6c696d6974223a2235353030303030222c2276616c7565223a2230222c22746f223a5b38332c3130372c3135352c35382c39382c3132382c37332c3233392c3134382c3133332c3133342c33392c3131382c31362c34382c3235302c3130372c3133382c3234382c3135375d2c2266726f6d223a5b3135382c32332c3137302c3133322c3230302c3130322c35302c38352c31302c3134382c3235322c35372c3132362c372c31372c32352c37322c3131342c38322c3134365d2c2264617461223a5b3136302c3232332c3131392c3130362...
```

### Deploying and Maintenance

After you publish the function and create it on the blockchain, you must keep the function escrow account funded to cover gas fees. Revisions to the function can be made by deploying a new version and updating the function config on-chain.

## Writing Receiver Contracts

Using the [FunctionsClient](./contracts/src/FunctionsClient.sol) contract you can receive functions data with very few additions. All you have to do is inherit from the FunctionsClient contract and implement the `onCallback` function. This function will be triggered when the callback is received and the data is set.

You can trigger the return type in the configuration file for the function. The return type can be `uint256`, `int256`, `string`, or `bytes`. The return type will be encoded in the callback data.

### Receiver Example

Example.sol

```solidity
//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {FunctionsClient} from "./FunctionsClient.sol";

contract ReceiverExample is FunctionsClient {
    uint256 public randomValue;

    event NewRandomValue(uint256 value);
    error InvalidCallbackType();

    constructor(
        address _switchboard // Switchboard contract address
    ) FunctionsClient(_switchboard) {}

    function onCallback() internal override {
        // expecting a new Uint256
        if (latestCallbackType != CallbackType.CALLBACK_UINT256) {
            revert InvalidCallbackType();
        }

        // expecting a new Uint256
        randomValue = latestValueUint256;
        emit NewRandomValue(randomValue);
    }
}
```
