// ==========================================
// ARBSCAN V2.2 — ORDER BOOK ENGINE
// READ-ONLY / DEMO ONLY
// ==========================================

const REQUEST_TIMEOUT = 5000;

async function fetchJSON(url) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

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

// ==========================================
// NORMALIZATION
// ==========================================

function normalizeLevels(levels) {
  return levels
    .map(level => ({
      price: Number(level[0]),
      quantity: Number(level[1])
    }))
    .filter(level =>
      Number.isFinite(level.price) &&
      Number.isFinite(level.quantity) &&
      level.price > 0 &&
      level.quantity > 0
    );
}

// ==========================================
// BINANCE
// ==========================================

async function getBinanceBook() {
  const data = await fetchJSON(
    "https://api.binance.com/api/v3/depth?symbol=BTCEUR&limit=100"
  );

  return {
    exchange: "Binance",
    symbol: "BTC/EUR",

    bids: normalizeLevels(data.bids),
    asks: normalizeLevels(data.asks),

    timestamp: Date.now()
  };
}

// ==========================================
// KRAKEN
// ==========================================

async function getKrakenBook() {
  const data = await fetchJSON(
    "https://api.kraken.com/0/public/Depth?pair=BTCEUR&count=100"
  );

  if (data.error?.length) {
    throw new Error(
      `Kraken error: ${data.error.join(", ")}`
    );
  }

  const book =
    Object.values(data.result)[0];

  if (!book) {
    throw new Error(
      "Kraken BTC/EUR order book unavailable"
    );
  }

  return {
    exchange: "Kraken",
    symbol: "BTC/EUR",

    bids: normalizeLevels(book.bids),
    asks: normalizeLevels(book.asks),

    timestamp: Date.now()
  };
}

// ==========================================
// COINBASE
// ==========================================

async function getCoinbaseBook() {
  const data = await fetchJSON(
    "https://api.exchange.coinbase.com/products/BTC-EUR/book?level=2"
  );

  return {
    exchange: "Coinbase",
    symbol: "BTC/EUR",

    bids: normalizeLevels(data.bids),
    asks: normalizeLevels(data.asks),

    timestamp: Date.now()
  };
}

// ==========================================
// GET ALL BOOKS
// ==========================================

export async function getBTCOrderBooks() {

  const requests = [
    {
      exchange: "Binance",
      request: getBinanceBook()
    },
    {
      exchange: "Kraken",
      request: getKrakenBook()
    },
    {
      exchange: "Coinbase",
      request: getCoinbaseBook()
    }
  ];

  const results =
    await Promise.allSettled(
      requests.map(item => item.request)
    );

  const books = [];
  const errors = [];

  results.forEach(
    (result, index) => {

      const exchange =
        requests[index].exchange;

      if (
        result.status === "fulfilled"
      ) {
        books.push(result.value);

      } else {
        errors.push({
          exchange,

          error:
            result.reason?.message ||
            "Unknown order-book error"
        });
      }
    }
  );

  return {
    symbol: "BTC/EUR",
    timestamp: Date.now(),
    books,
    errors
  };
}

// ==========================================
// SIMULATE BUY
// ==========================================
//
// Simule l'achat de BTC avec un montant EUR.
// On traverse réellement plusieurs niveaux
// ASK si nécessaire.
//
// ==========================================

export function simulateBuy(
  asks,
  amountEUR
) {

  let remainingEUR = amountEUR;

  let btcBought = 0;
  let eurSpent = 0;

  let levelsUsed = 0;

  for (const level of asks) {

    if (remainingEUR <= 0) {
      break;
    }

    const levelValueEUR =
      level.price * level.quantity;

    const eurToUse =
      Math.min(
        remainingEUR,
        levelValueEUR
      );

    const btcAtLevel =
      eurToUse / level.price;

    btcBought += btcAtLevel;
    eurSpent += eurToUse;

    remainingEUR -= eurToUse;

    levelsUsed++;
  }

  if (remainingEUR > 0.01) {
    return {
      filled: false,
      reason:
        "Insufficient ASK liquidity"
    };
  }

  const averagePrice =
    eurSpent / btcBought;

  const bestAsk =
    asks[0]?.price;

  const slippagePercent =
    bestAsk
      ? (
          (
            averagePrice -
            bestAsk
          ) /
          bestAsk
        ) * 100
      : null;

  return {
    filled: true,

    btcAmount:
      Number(
        btcBought.toFixed(8)
      ),

    eurSpent:
      Number(
        eurSpent.toFixed(2)
      ),

    averagePrice:
      Number(
        averagePrice.toFixed(2)
      ),

    bestAsk,

    levelsUsed,

    slippagePercent:
      Number(
        slippagePercent.toFixed(6)
      )
  };
}

// ==========================================
// SIMULATE SELL
// ==========================================
//
// Simule la vente du BTC acheté.
// On traverse plusieurs niveaux BID.
//
// ==========================================

export function simulateSell(
  bids,
  btcAmount
) {

  let remainingBTC = btcAmount;

  let eurReceived = 0;
  let btcSold = 0;

  let levelsUsed = 0;

  for (const level of bids) {

    if (remainingBTC <= 0) {
      break;
    }

    const btcToSell =
      Math.min(
        remainingBTC,
        level.quantity
      );

    eurReceived +=
      btcToSell * level.price;

    btcSold += btcToSell;

    remainingBTC -= btcToSell;

    levelsUsed++;
  }

  if (remainingBTC > 0.00000001) {
    return {
      filled: false,
      reason:
        "Insufficient BID liquidity"
    };
  }

  const averagePrice =
    eurReceived / btcSold;

  const bestBid =
    bids[0]?.price;

  const slippagePercent =
    bestBid
      ? (
          (
            bestBid -
            averagePrice
          ) /
          bestBid
        ) * 100
      : null;

  return {
    filled: true,

    btcAmount:
      Number(
        btcSold.toFixed(8)
      ),

    eurReceived:
      Number(
        eurReceived.toFixed(2)
      ),

    averagePrice:
      Number(
        averagePrice.toFixed(2)
      ),

    bestBid,

    levelsUsed,

    slippagePercent:
      Number(
        slippagePercent.toFixed(6)
      )
  };
}

// ==========================================
// COMPLETE ORDER-BOOK ARBITRAGE
// ==========================================

export function simulateOrderBookArbitrage({
  buyBook,
  sellBook,
  amountEUR
}) {

  const buy =
    simulateBuy(
      buyBook.asks,
      amountEUR
    );

  if (!buy.filled) {
    return {
      executable: false,
      stage: "BUY",
      buy
    };
  }

  const sell =
    simulateSell(
      sellBook.bids,
      buy.btcAmount
    );

  if (!sell.filled) {
    return {
      executable: false,
      stage: "SELL",
      buy,
      sell
    };
  }

  const grossProfitEUR =
    sell.eurReceived -
    buy.eurSpent;

  const grossReturnPercent =
    (
      grossProfitEUR /
      amountEUR
    ) * 100;

  return {
    executable: true,

    buyExchange:
      buyBook.exchange,

    sellExchange:
      sellBook.exchange,

    amountEUR,

    btcAmount:
      buy.btcAmount,

    buy,

    sell,

    grossProfitEUR:
      Number(
        grossProfitEUR.toFixed(2)
      ),

    grossReturnPercent:
      Number(
        grossReturnPercent.toFixed(6)
      )
  };
}