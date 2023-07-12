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

## Switchboard Functions

Switchboards V3 architecture allows users to permissionlessly build and run any code you like and we attest the output is from your code.

## Table of Content

- [Switchboard Functions](#switchboard-functions)
- [Table of Content](#table-of-content)
- [Setup](#setup)
  - [Configure the function](#configure-the-function)
- [Build and Push](#build-and-push)

## Setup

- Get an sgx enabled machine, you can use [Azure cloud](https://learn.microsoft.com/en-us/azure/confidential-computing/quick-create-portal) to do this.
- SSH into the machine and install docker engine.

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
