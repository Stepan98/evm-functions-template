pub mod coinbase;
pub use coinbase::*;
pub mod binance;
pub use binance::*;
pub mod bitfinex;
pub use bitfinex::*;
pub mod kraken;
pub use kraken::*;
pub mod bittrex;
pub use bittrex::*;
pub mod gateio;
pub use gateio::*;
pub mod huobi;
pub use huobi::*;
pub mod kucoin;
pub use kucoin::*;
pub mod okx;
pub use okx::*;
pub mod bitstamp;
pub use bitstamp::*;
pub mod poloniex;
pub use poloniex::*;
pub mod pair;
pub use pair::*;

use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use switchboard_common;
use switchboard_evm::sdk::EVMFunctionRunner;
pub use switchboard_utils::reqwest;

use ethers::{
    prelude::{abigen, SignerMiddleware},
    providers::{Http, Provider},
    types::I256,
};
use rand;
use rand::seq::SliceRandom;
use rand::SeedableRng;
use serde_json::Value;
use std::hash::Hasher;

use std::sync::Arc;
use std::time::{Duration, SystemTime};

#[allow(non_snake_case)]
#[derive(Deserialize, Default, Clone, Debug)]
pub struct NormalizedTicker {
    pub price: Decimal,
}
#[allow(non_snake_case)]
#[derive(Deserialize, Default, Clone, Debug)]
pub struct NormalizedOrdersRow {
    price: Decimal,
    amount: Decimal,
}
#[allow(non_snake_case)]
#[derive(Deserialize, Default, Clone, Debug)]
pub struct NormalizedBook {
    pub bids: Vec<NormalizedOrdersRow>,
    pub asks: Vec<NormalizedOrdersRow>,
    pub price: Decimal,
}
#[derive(Debug, Clone)]
enum Sample {
    Binance(BinanceSpot),
    Bitfinex(BitfinexPair),
    Bitstamp(BitstampTicker),
    Bittrex(BittrexPair),
    // Coinbase(CoinbaseBook),
    GateIo(GateIoPair),
    Huobi(HuobiTicker),
    Kraken(KrakenTickerInfo),
    Kucoin(KucoinTicker),
    Okex(OkexTicker),
    Poloniex(PoloniexTicker),
    CoinbaseSpot(Decimal),
}

impl Into<NormalizedTicker> for Sample {
    fn into(self) -> NormalizedTicker {
        match self {
            Sample::Binance(t) => t.into(),
            Sample::Bitfinex(t) => t.into(),
            Sample::Bitstamp(t) => t.into(),
            Sample::Bittrex(t) => t.into(),
            Sample::GateIo(t) => t.into(),
            Sample::Huobi(t) => t.into(),
            Sample::Kraken(t) => t.into(),
            Sample::Kucoin(t) => t.into(),
            Sample::Okex(t) => t.into(),
            Sample::Poloniex(t) => t.into(),
            // Sample::Coinbase(t) => t.into(),
            Sample::CoinbaseSpot(t) => {
                let mut res = NormalizedTicker::default();
                res.price = t;
                res
            }
        }
    }
}

#[tokio::main(worker_threads = 12)]
async fn main() {
    // define the abi for the callback
    // -- here it's just a function named "callback", expecting the feed names, values, and timestamps
    // -- we also include a view function for getting all feeds
    // running `npx hardhat typechain` will create artifacts for the contract
    // this in particular is found at
    // SwitchboardPushReceiver/artifacts/contracts/src/SwitchboardPushReceiver/Receiver/Receiver.sol/Receiver.json
    abigen!(Receiver, "./src/abi/Receiver.json",);

    // Generates a new enclave wallet, pulls in relevant environment variables
    let function_runner = EVMFunctionRunner::new().unwrap();

    // set the gas limit and expiration date
    // -- this is the maximum amount of gas that can be used for the transaction (and it's a lot)
    let gas_limit = 5_500_000;
    let expiration_time_seconds = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
        + 64;

    // setup the provider + signer
    let provider = Provider::<Http>::try_from("https://rpc.test.btcs.network").unwrap();
    let client = Arc::new(
        SignerMiddleware::new_with_provider_chain(provider, function_runner.enclave_wallet.clone())
            .await
            .unwrap(),
    );

    let contract_address = env!("SWITCHBOARD_PUSH_ADDRESS")
        .parse::<ethers::types::Address>()
        .unwrap();

    let receiver_contract = Receiver::new(contract_address, client);

    // get all feeds
    let all_feeds = receiver_contract.get_all_feeds().call().await;

    // map all feeds into Feed type
    let feeds = all_feeds.unwrap_or(Vec::new());

    // take feed.feed_name and map it to feed.latest_result
    let mut feed_map = HashMap::<[u8; 32], I256>::new();
    for feed in feeds {
        feed_map.insert(feed.feed_name, feed.latest_result.value);
    }

    // get fresh feed data
    let mut feed_updates = get_feed_data().await;

    // check if we're still registering feeds (significantly more expensive in gas cost)
    // -- if so, only use the first 20 elements of the feed_updates
    // allow up to 1 registration alongside updates so we don't block updates for an entire run if a feed is added
    let registering_feeds: bool = feed_map.len() < feed_updates.len() - 1;

    // get list of feed names that weren't received in get_feed_data
    let mut missing_feeds = Vec::<[u8; 32]>::new();
    for key in feed_map.keys() {
        if !feed_updates.contains_key(key) {
            missing_feeds.push(*key);
        }
    }

    // delete all entries with a diff less than 0.1
    for (key, value) in feed_updates.clone() {
        if feed_map.contains_key(&key) {
            let diff = get_percentage_diff(*feed_map.get(&key).unwrap(), value);
            // %0.01 diff should triger an update
            if registering_feeds || diff < Decimal::from_str("0.1").unwrap() {
                feed_updates.remove(&key);
            }
        }

    }

    // get a vec of feed names and values remaining
    let mut feed_names = Vec::<[u8; 32]>::new();
    let mut feed_values = Vec::<I256>::new();

    // setup feeds for shuffling
    let mut randomness = [0; 32];
    switchboard_common::Gramine::read_rand(&mut randomness).unwrap();
    let mut rng = rand::rngs::StdRng::from_seed(randomness);
    let mut feed_updates: Vec<([u8; 32], I256)> = feed_updates.into_iter().collect();

    // only shuffle feeds if we're at the stage where we're submitting results
    if !registering_feeds {
        feed_updates.shuffle(&mut rng);
    }


    for (key, value) in feed_updates {
        // only use the first 30 elements of the feed_updates
        // -- this is to prevent the transaction from going over the gas limit
        if feed_names.len() >= 20 && registering_feeds {
            break;
        }
        if feed_names.len() >= 100 && !registering_feeds {
            break;
        }
        feed_names.push(key);
        feed_values.push(value);
    }

    // send the callback to the contract
    let callback = receiver_contract.callback(
        feed_names.clone(),
        feed_values.clone(),
        expiration_time_seconds.into(),
    );

    // get the calls from the output results
    let mut callbacks = vec![callback];

    // add the missing feeds to the callback to mark them as stale
    if !registering_feeds && missing_feeds.len() > 0 {
        let callback_missing_feeds = receiver_contract.failure_callback(
            missing_feeds.clone()
        );
        callbacks.push(callback_missing_feeds);
    }


    // Emit the result
    function_runner
        .emit(
            contract_address,
            expiration_time_seconds.try_into().unwrap(),
            gas_limit.into(),
            callbacks,
        )
        .unwrap();
}

// Get all feed data from various exchanges and return a hashmap of feed names and medianized values
async fn get_feed_data() -> HashMap<[u8; 32], I256> {
    use crate::Sample::*;
    let empty_vec: Vec<Sample> = Vec::new();
    let mut aggregates = HashMap::<Pair, Vec<Sample>>::new();
    let binance_spot: Vec<BinanceSpot> = reqwest::get("https://api.binance.us/api/v3/ticker/price")
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    // println!("Binance markets {:#?}", binance_spot);
    for p in binance_spot {
        let mut samples: Vec<_> = aggregates.get(&p.symbol).unwrap_or(&empty_vec).to_vec();
        samples.push(Binance(p.clone()));
        aggregates.insert(p.symbol, samples.clone());
    }

    let bitfinex_spot: Vec<Vec<Option<Value>>> =
        reqwest::get("https://api-pub.bitfinex.com/v2/tickers?symbols=ALL")
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
    let bitfinex_spot: Vec<BitfinexPair> = bitfinex_spot
        .iter()
        .map(|x| x.clone().into())
        .filter(|x: &BitfinexPair| x.symbol != Default::default())
        .collect();
    // println!("Bitfinex martkets {:#?}", bitfinex_spot);
    for p in bitfinex_spot {
        let mut samples = aggregates.get(&p.symbol).unwrap_or(&empty_vec).to_vec();
        samples.push(Bitfinex(p.clone()));
        aggregates.insert(p.symbol, samples.to_vec());
    }

    let bittrex_spot: Vec<BittrexPair> = reqwest::get("https://api.bittrex.com/v3/markets/tickers")
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    // println!("Bittrex markets {:#?}", bittrex_spot);
    for p in bittrex_spot {
        let mut samples = aggregates.get(&p.symbol).unwrap_or(&empty_vec).to_vec();
        samples.push(Bittrex(p.clone()));
        aggregates.insert(p.symbol, samples.to_vec());
    }

    let coinbase_spot: CoinbaseSpotResponse =
        reqwest::get("https://api.coinbase.com/v2/exchange-rates?currency=USD")
            .await
            .unwrap()
            .json()
            .await
            .unwrap();

    // println!("Coinbase markets {:#?}", coinbase_spot);
    // std::process::exit(1);

    // println!("Coinbase markets {:#?}", coinbase_spot.data.rates);
    for (k, v) in coinbase_spot.data.rates {
        let symbol = Pair {
            base: k.to_string(),
            quote: "USD".to_string(),
        };
        let mut samples = aggregates.get(&symbol).unwrap_or(&empty_vec).to_vec();
        samples.push(CoinbaseSpot(Decimal::from(1) / v.clone()));
        aggregates.insert(symbol, samples.to_vec());
    }

    let gateio_spot: Vec<GateIoPair> = reqwest::get("https://api.gateio.ws/api/v4/spot/tickers")
        .await
        .unwrap()
        .json()
        .await
        .unwrap();

    // println!("Gateio markets {:#?}", gateio_spot);
    for p in gateio_spot {
        let mut samples = aggregates
            .get(&p.currency_pair)
            .unwrap_or(&empty_vec)
            .to_vec();
        samples.push(GateIo(p.clone()));
        aggregates.insert(p.currency_pair, samples.to_vec());
    }

    let huobi_spot: HuobiTickerResponse = reqwest::get("https://api.huobi.pro/market/tickers")
        .await
        .unwrap()
        .json()
        .await
        .unwrap();

    //println!("Huobi markets {:#?}", huobi_spot.data);
    for p in huobi_spot.data {
        let mut samples = aggregates.get(&p.symbol).unwrap_or(&empty_vec).to_vec();
        samples.push(Huobi(p.clone()));
        aggregates.insert(p.symbol, samples.to_vec());
    }

    let kraken_spot: KrakenTickerResponse = reqwest::get("https://api.kraken.com/0/public/Ticker")
        .await
        .unwrap()
        .json()
        .await
        .unwrap();

    // println!("Kraken markets {:#?}", kraken_spot.result);
    for (k, v) in kraken_spot.result {
        let mut samples = aggregates.get(&k).unwrap_or(&empty_vec).to_vec();
        samples.push(Kraken(v.clone()));
        aggregates.insert(k, samples.to_vec());
    }

    let kucoin_spot: KucoinTickerResponse =
        reqwest::get("https://api.kucoin.com/api/v1/market/allTickers")
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
    // println!("Kucoin markets {:#?}", kucoin_spot.data.ticker);
    for p in kucoin_spot.data.ticker {
        let mut samples = aggregates.get(&p.symbol).unwrap_or(&empty_vec).to_vec();
        samples.push(Kucoin(p.clone()));
        aggregates.insert(p.symbol, samples.to_vec());
    }

    let okex_spot: OkexSpotResponse =
        reqwest::get("https://www.okx.com/api/v5/market/tickers?instType=SPOT")
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
    // println!("okex markets {:#?}", okex_spot.data);
    for p in okex_spot.data {
        let mut samples = aggregates.get(&p.instId).unwrap_or(&empty_vec).to_vec();
        samples.push(Okex(p.clone()));
        aggregates.insert(p.instId, samples.to_vec());
    }

    let bitstamp_spot: Vec<BitstampTicker> =
        reqwest::get("https://www.bitstamp.net/api/v2/ticker/")
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
    // println!("Bitstamp markets {:#?}", bitstamp_spot);
    for p in bitstamp_spot {
        let mut samples = aggregates.get(&p.pair).unwrap_or(&empty_vec).to_vec();
        samples.push(Bitstamp(p.clone()));
        aggregates.insert(p.pair, samples.to_vec());
    }

    let poloniex_spot: PoloniexResponse =
        reqwest::get("https://poloniex.com/public?command=returnTicker")
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
    // println!("Bitstamp markets {:#?}", bitstamp_spot);
    for (symbol, v) in poloniex_spot.into_inner() {
        let mut samples = aggregates.get(&symbol).unwrap_or(&empty_vec).to_vec();
        samples.push(Poloniex(v.clone()));
        aggregates.insert(symbol, samples.to_vec());
    }
    // Only retain more than 2 samples
    aggregates.retain(|k, v| v.len() > 2 && k.quote.contains("USD"));
    // println!("{:#?}", aggregates);
    // println!("{:#?}", aggregates.len());

    let mut feed_map = HashMap::<[u8; 32], I256>::new();

    // go through each pair and calculate the average
    for (k, v) in aggregates {
        let _sum = 0.0;

        // get the median price
        let mut prices: Vec<Decimal> = v
            .iter()
            .map(|x| {
                let normalized: NormalizedTicker = (*x).clone().into();
                normalized.price
            })
            .collect();
        prices.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let mut median: Decimal;

        // handle even and odd cases
        if prices.len() % 2 == 0 {
            let mid = prices.len() / 2;
            median = (prices[mid] + prices[mid - 1]) / Decimal::from(2);
        } else {
            median = prices[prices.len() / 2];
        }

        // get pair name as string
        let name = format!("{}/{}", k.base, k.quote);
        
        // get mean 
        let sum: Decimal = prices.iter().sum();
        let count = Decimal::from(prices.len() as i32);
        let mean = sum / count;

        // get variance 
        let squared_deviations: Decimal = prices
            .iter()
            .map(|&x| (x - mean).powi(2))
            .sum();
        let variance = squared_deviations / count;

        // get standard deviation
        let std_dev = variance.sqrt().unwrap();

        // filter out prices that are not within 1 std dev of the mean
        let prices = if prices.len() > 3 {
            prices
                .iter()
                .filter(|x| {
                    let lower_bound = median - std_dev;
                    let upper_bound = median + std_dev;
                    let x_is_in_range = x > &&lower_bound && x < &&upper_bound;
                    // for debugging:
                    // if !x_is_in_range {
                    //     // get index in prices
                    //     println!("Feed Name {},  {} is not in range {} - {}", name, x, lower_bound, upper_bound);
                    // }
                    x_is_in_range
                })
                .map(|x| *x)
                .collect()
        } else {
            prices
        };

        // recalculate median
        if prices.len() % 2 == 0 {
            let mid = prices.len() / 2;
            median = (prices[mid] + prices[mid - 1]) / Decimal::from(2);
        } else {
            median = prices[prices.len() / 2];
        }


        // add to vectors
        let mut bytes32 = [0u8; 32];
        bytes32[..name.as_bytes().len()].copy_from_slice(name.as_bytes());

        // get median with fixed decimals at 18 as I256
        median.rescale(18);
        let median = I256::from(median.mantissa());

        // add to map
        feed_map.insert(bytes32, median);
    }

    // return the medians and names
    feed_map
}

fn get_percentage_diff(a: I256, b: I256) -> Decimal {
    let a = Decimal::from(a.as_i128());
    let b = Decimal::from(b.as_i128());
    (Decimal::min(a, b) / Decimal::max(a, b)).abs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test() {
        let feed_map = get_feed_data().await;
        println!("{:#?}", feed_map);
    }
}
