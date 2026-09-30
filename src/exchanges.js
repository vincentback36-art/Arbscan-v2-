// ==========================================
// ARBSCAN V2 — PUBLIC MARKET DATA
// ==========================================
//
// Données publiques uniquement.
// Aucune clé API.
// Aucun ordre.
// Aucun accès aux fonds.
//
// Chaque fonction renvoie :
// {
//   exchange,
//   symbol,
//   bid,   // meilleur prix auquel on peut vendre
//   ask,   // meilleur prix auquel on peut acheter
//   timestamp
// }
//
// ==========================================

const REQUEST_TIMEOUT = 5000;

// ------------------------------------------
// Helper HTTP
// ------------------------------------------

async function fetchJSON(url) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "ArbScan-V2"
      }
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ------------------------------------------
// BINANCE
// ------------------------------------------

async function getBinanceBTC() {
  const data = await fetchJSON(
    "https://api.binance.com/api/v3/ticker/bookTicker?symbol=BTCEUR"
  );

  const bid = Number(data.bidPrice);
  const ask = Number(data.askPrice);

  if (!Number.isFinite(bid) || !Number.isFinite(ask)) {
    throw new Error("Invalid Binance market data");
  }

  return {
    exchange: "Binance",
    symbol: "BTC/EUR",
    bid,
    ask,
    timestamp: Date.now()
  };
}

// ------------------------------------------
// KRAKEN
// ------------------------------------------

async function getKrakenBTC() {
  const data = await fetchJSON(
    "https://api.kraken.com/0/public/Ticker?pair=BTCEUR"
  );

  if (data.error?.length) {
    throw new Error(
      `Kraken error: ${data.error.join(", ")}`
    );
  }

  const market = Object.values(data.result)[0];

  if (!market) {
    throw new Error("Kraken BTC/EUR market not found");
  }

  const ask = Number(market.a[0]);
  const bid = Number(market.b[0]);

  if (!Number.isFinite(bid) || !Number.isFinite(ask)) {
    throw new Error("Invalid Kraken market data");
  }

  return {
    exchange: "Kraken",
    symbol: "BTC/EUR",
    bid,
    ask,
    timestamp: Date.now()
  };
}

// ------------------------------------------
// COINBASE
// ------------------------------------------

async function getCoinbaseBTC() {
  const data = await fetchJSON(
    "https://api.exchange.coinbase.com/products/BTC-EUR/ticker"
  );

  const bid = Number(data.bid);
  const ask = Number(data.ask);

  if (!Number.isFinite(bid) || !Number.isFinite(ask)) {
    throw new Error("Invalid Coinbase market data");
  }

  return {
    exchange: "Coinbase",
    symbol: "BTC/EUR",
    bid,
    ask,
    timestamp: Date.now()
  };
}

// ------------------------------------------
// Récupération simultanée
// ------------------------------------------

export async function getBTCMarkets() {
  const requests = [
    {
      exchange: "Binance",
      request: getBinanceBTC()
    },
    {
      exchange: "Kraken",
      request: getKrakenBTC()
    },
    {
      exchange: "Coinbase",
      request: getCoinbaseBTC()
    }
  ];

  const results = await Promise.allSettled(
    requests.map((item) => item.request)
  );

  const markets = [];
  const errors = [];

  results.forEach((result, index) => {
    const exchange = requests[index].exchange;

    if (result.status === "fulfilled") {
      markets.push(result.value);
    } else {
      errors.push({
        exchange,
        error:
          result.reason?.message ||
          "Unknown exchange error"
      });
    }
  });

  return {
    symbol: "BTC/EUR",
    timestamp: Date.now(),
    markets,
    errors
  };
}

// ------------------------------------------
// Recherche du meilleur arbitrage brut
// ------------------------------------------

export function findBestBTCArbitrage(markets) {
  if (!Array.isArray(markets) || markets.length < 2) {
    return null;
  }

  let best = null;

  for (const buyMarket of markets) {
    for (const sellMarket of markets) {
      if (
        buyMarket.exchange === sellMarket.exchange
      ) {
        continue;
      }

      // On ACHÈTE au ASK.
      const buyPrice = buyMarket.ask;

      // On VEND au BID.
      const sellPrice = sellMarket.bid;

      const spread =
        sellPrice - buyPrice;

      const spreadPercent =
        (spread / buyPrice) * 100;

      const opportunity = {
        symbol: "BTC/EUR",

        buyExchange:
          buyMarket.exchange,

        sellExchange:
          sellMarket.exchange,

        buyPrice:
          Number(buyPrice.toFixed(2)),

        sellPrice:
          Number(sellPrice.toFixed(2)),

        grossSpread:
          Number(spread.toFixed(2)),

        grossSpreadPercent:
          Number(spreadPercent.toFixed(4)),

        profitableBeforeFees:
          spread > 0,

        timestamp: Date.now()
      };

      if (
        !best ||
        opportunity.grossSpreadPercent >
          best.grossSpreadPercent
      ) {
        best = opportunity;
      }
    }
  }

  return best;
}