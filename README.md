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

- [Switchboard Functions](#switchboard-functions)
- [Table of Content](#table-of-content)
- [Key Features](#key-features)
- [Creating Switchboard Functions](#creating-switchboard-functions)
- [Setup Example](#setup-example)
  - [Configure the function](#configure-the-function)
- [Build and Push](#build-and-push)

## Switchboard Functions

Switchboard Functions provide a powerful solution for blockchain developers seeking to seamlessly integrate secure and verifiable off-chain logic execution with on-chain transactions within Ethereum Virtual Machine (EVM) based blockchains. This tool empowers developers to execute complex computations, resolve user orders with up-to-date oracle prices, process customized metadata, and trigger custom function runs, all while maintaining the security and immutability of the blockchain.

## Key Features

- **Secure Off-Chain Logic Execution**: Switchboard Functions enable developers to perform intricate computations and data manipulation off-chain while preserving the security and permissionlessness of the user's code.

- **Verifiable Runs**: Transactions executed by Switchboard Functions are transparent and verifiable with data posted on the blockchain.

- **Customization**: Developers have the flexibility to customize Switchboard Functions to suit their specific use cases. Functions can be tailored to run on-demand, on a cron schedule, or both, allowing for precise control over execution timing.

- **Multiple Integration Approaches**: Switchboard Functions support multiple programming languages and approaches for function creation, including Typescript, Javascript, and Rust. This accommodates a wide range of developer preferences and skill levels.

## Creating Switchboard Functions

### 1. Typescript

Developers familiar with Typescript can harness the full potential of Switchboard Functions by creating highly customizable and intricate logic executions. This method allows for the handling of individual end-user triggered orders, interaction with on-chain functions, and complex computations. Although it offers greater control, it requires manual handling of function calls and ABI definition.

**Examples**:

- [Scheduled Randomness](link_to_example_code)
- [Custom Callback Example](link_to_example_code)

### 2. Typescript/Javascript Simplified

For developers seeking a more streamlined process, the Typescript/Javascript Simplified Approach offers an accessible solution. Create straightforward functions that utilize user-friendly configuration inputs and produce desired outputs. Utility functions facilitate HTTP requests and output creation, leading to efficient integration with receiver contracts. This approach is also compatible with alternative oracles.

**Example**:

- [Simple Function Template](link_to_template)
- [Simple Callback Template](link_to_template)
- [Link to Interface](link_to_interface)

### 3. Rust

Developers with proficiency in Rust can leverage its lightweight yet robust capabilities to create fully customizable Switchboard Functions. The Rust Approach offers similar features to the Typescript version but with reduced overhead, allowing for longer function runtimes. Extend existing implementations, such as the price oracle, to enrich on-chain exchange data with additional details.

**Example**:

- [Link to Price Oracle Implementation](./rust/01_price_oracle/SwitchboardPushReceiver)
- [Link to Rust Template](link_to_rust_template)

## Setup Example

- Setup Docker
- Setup tooling for build

### Configure the function

First create a json file that stores the ABI in `src/<file-path>.json`.
Then set the enviroment variables in `main.rs`.

You'll need to set the target contract as the address of your contract. The verifying contract and chain id would need to be set as per the chain. The below
values are for arbitrum goerli testnet.

```rs
std::env::set_var("CHAIN_ID", "421613");
std::env::set_var(
        "VERIFYING_CONTRACT",
        "0x8b8F944F8506db8A91f85A31A956b165259C617F",
    );
std::env::set_var(
        "TARGET_CONTRACT",
        "<address-of-your-contract>",
    );
```

Then add your wallet private key and fund it with the gas token.

```rs
let wallet: Wallet<SigningKey> =
        "your-private-key"
            .parse::<LocalWallet>()
            .unwrap()
            .with_chain_id(client.get_chainid().await.unwrap().as_u64());
```

Then load the contract and create the function call.

```rs
  abigen!(CONTRACT_NAME, "src/<file-path>.json");

  let contract_address = env::var("TARGET_CONTRACT")
        .unwrap()
        .parse::<ethers::types::Address>()
        .unwrap();

   let my_contract = ERC20::new(contract_address, middleware);
   let contract_fn_call: ContractCall<EVMMiddleware<_>, _> =
        my_contract.mint(recipient, 100.into()); // im calling mint but you can add any contract call here
   let calls = vec![contract_fn_call.clone()];
```

That's it, just pass these to the runner as already done in `main.rs`.

## Build and Push

Now build the image using:

```bash
docker build -t org-name/image-name:tag .
```

and push it to your registry using:

```bash
docker push org-name/image-name:tag
```

Pass the uploaded image url to the function manager and it should handle calling the functions.
