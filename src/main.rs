use std::{sync::Arc, vec};

use ethers::{
    prelude::{k256::ecdsa::SigningKey, SignerMiddleware},
    providers::{Http, Middleware, Provider},
    signers::{LocalWallet, Signer, Wallet},
    types::transaction::eip712::EIP712Domain,
};
pub use sb_evm_functions::sdk::EVMFunctionRunner;

#[tokio::main(worker_threads = 12)]
async fn main() {
    // set the env variables with the necessary information like verifier contract etc
    std::env::set_var("FUNCTION_KEY", "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852");
    std::env::set_var(
        "FUNCTION_REQUEST_KEY",
        "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852",
    );
    std::env::set_var("FUNCTION_VERSION", "1");
    std::env::set_var("CHAIN_ID", "1");
    std::env::set_var("FUNCTION_NAME", "Switchboard");
    std::env::set_var(
        "VERIFYING_CONTRACT",
        "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852",
    );

    // set the gas limit and expiration
    let gas_limit = 1000000;
    let expiration_time_seconds = 60;

    // create a client, wallet and middleware. This is just so we can create the contract instance and sign the txn.
    let client = Provider::<Http>::try_from("https://eth.llamarpc.com").unwrap();
    let wallet: Wallet<SigningKey> =
        "725fd1619b2653b7ff1806bf29ae11d0568606d83777afd5b1f2e649bd5132a9"
            .parse::<LocalWallet>()
            .unwrap()
            .with_chain_id(client.get_chainid().await.unwrap().as_u64());

    let contract_address = "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852"
        .parse::<ethers::types::Address>()
        .unwrap();

    let middleware: Arc<SignerMiddleware<Provider<Http>, Wallet<SigningKey>>> = Arc::new(
        SignerMiddleware::new_with_provider_chain(client.clone(), wallet.clone())
            .await
            .unwrap(),
    );
    let contract =
        sb_evm_functions::bindings::switchboard::Switchboard::new(contract_address, middleware);

    let txn = sb_evm_functions::bindings::switchboard::Transaction {
        expiration_time_seconds: expiration_time_seconds.into(),
        gas_limit: gas_limit.into(),
        value: 200.into(),
        to: "0x0000000000000000000000000000000000000000"
            .parse()
            .unwrap(),
        from: "0x0000000000000000000000000000000000000000"
            .parse()
            .unwrap(),
        data: "0x0000000000000000000000000000000000000000"
            .parse()
            .unwrap(),
    };
    // create a domain that contains information used to partial sign the transaction and allows for forwarding
    let domain = EIP712Domain {
        name: Some("Switchboard".into()),
        version: Some("1".into()),
        chain_id: Some(1.into()),
        verifying_contract: Some(
            "0x0000000000000000000000000000000000000000"
                .parse()
                .unwrap(),
        ),
        salt: None,
    };
    let eip_txn = sb_evm_functions::bindings::eip712::Transaction::from(&txn);

    // once the transaction is created we need to partial sign it
    let signature: ethers::types::Signature =
        sb_evm_functions::utils::sign_typed_data(wallet.clone(), &eip_txn, domain).unwrap();

    // create a vec of contract calls to pass to the function runner
    let calls = vec![contract.verify_function(
        0.into(),
        "0x0000000000000000000000000000000000000000"
            .parse()
            .unwrap(),
        "0x0000000000000000000000000000000000000000"
            .parse()
            .unwrap(),
        0.into(),
        0.into(),
        false,
        [0u8; 32],
        vec![txn],
        vec![signature.to_vec().into()],
    )];

    // First, initialize the runner instance with a freshly generated Gramine keypair
    let runner = EVMFunctionRunner::new("https://eth.llamarpc.com").unwrap();

    // Finally, emit the signed quote and partially signed transaction to the functionRunner oracle
    // The functionRunner oracle will use the last outputted word to stdout as the serialized result. This is what gets executed on-chain.
    runner
        .emit(
            contract,
            expiration_time_seconds.into(),
            gas_limit.into(),
            calls,
        )
        .unwrap();
}
