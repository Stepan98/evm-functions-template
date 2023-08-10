// Note: Binance API requires a non-US IP address

use crate::*;

use serde::Deserialize;
pub use switchboard_utils::reqwest;

// https://api.gateio.ws/api/v4/spot/tickers
#[derive(Debug, Deserialize, Clone)]
pub struct GateIoPair {
    pub currency_pair: Pair,
    pub last: Decimal,
    pub lowest_ask: String,  // may be empty
    pub highest_bid: String, // may be empty
    pub change_percentage: Decimal,
    pub change_utc0: Decimal,
    pub change_utc8: Decimal,
    pub base_volume: Decimal,
    pub quote_volume: Decimal,
    pub high_24h: Decimal,
    pub low_24h: Decimal,
}

impl Into<NormalizedTicker> for GateIoPair {
    fn into(self) -> NormalizedTicker {
        let book = self;
        let mut res = NormalizedTicker::default();
        res.price = book.last;
        res
    }
}
