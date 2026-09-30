import express from "express";

import {
  CONFIG,
  assertDemoMode,
  getTakerFee,
  validateConfig
} from "./config.js";

import {
  getBTCOrderBooks,
  simulateOrderBookArbitrage
} from "./orderbooks.js";

import {
  initializePortfolio,
  getPortfolio,
  getPortfolioValue,
  canExecuteArbitrage,
  getTradeHistory
} from "./portfolio.js";

const app = express();

app.use(express.json());

const PORT =
  process.env.PORT || 3000;


// ==========================================
// ARBSCAN V2.3
// PAPER TRADING / DEMO ONLY
// ==========================================

validateConfig();
assertDemoMode();


// ==========================================
// HELPERS
// ==========================================

function getReferenceBTCPrice(books) {

  const prices = [];

  for (const book of books) {

    const bestBid =
      book.bids?.[0]?.price;

    const bestAsk =
      book.asks?.[0]?.price;

    if (
      Number.isFinite(bestBid) &&
      Number.isFinite(bestAsk)
    ) {

      prices.push(
        (bestBid + bestAsk) / 2
      );
    }
  }

  if (prices.length === 0) {
    throw new Error(
      "Unable to calculate BTC reference price."
    );
  }

  return (
    prices.reduce(
      (sum, price) =>
        sum + price,
      0
    ) /
    prices.length
  );
}


function calculateRouteFees({
  buyExchange,
  sellExchange,
  buyCostEUR,
  sellRevenueEUR
}) {

  const buyFeePercent =
    getTakerFee(
      buyExchange
    );

  const sellFeePercent =
    getTakerFee(
      sellExchange
    );

  const buyFeeEUR =
    buyCostEUR *
    (
      buyFeePercent /
      100
    );

  const sellFeeEUR =
    sellRevenueEUR *
    (
      sellFeePercent /
      100
    );

  return {

    buyFeePercent,

    sellFeePercent,

    buyFeeEUR:
      Number(
        buyFeeEUR.toFixed(4)
      ),

    sellFeeEUR:
      Number(
        sellFeeEUR.toFixed(4)
      ),

    totalFeesEUR:
      Number(
        (
          buyFeeEUR +
          sellFeeEUR
        ).toFixed(4)
      )
  };
}


// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {

  res.json({

    app:
      "ArbScan V2",

    version:
      "0.2.3",

    status:
      "online",

    mode:
      CONFIG.mode,

    realTrading:
      false,

    startingBalanceEUR:
      CONFIG.startingBalanceEUR,

    demoTradeAmountEUR:
      CONFIG.demoTradeAmountEUR,

    minimumNetProfitPercent:
      CONFIG.minimumNetProfitPercent,

    features: {

      livePrices:
        true,

      liveOrderBooks:
        true,

      orderBookSlippage:
        true,

      configurableFees:
        true,

      prePositionedBalances:
        true,

      paperPortfolio:
        true,

      automaticPaperTrading:
        false,

      liveTrading:
        false
    },

    endpoints: {

      status:
        "/api/status",

      scan:
        "/api/scan/btc/orderbooks",

      portfolio:
        "/api/portfolio",

      trades:
        "/api/trades"
    }
  });
});


// ==========================================
// STATUS
// ==========================================

app.get(
  "/api/status",
  (req, res) => {

    res.json({

      status:
        "online",

      version:
        "0.2.3",

      mode:
        CONFIG.mode,

      realTradingEnabled:
        CONFIG.realTradingEnabled,

      automaticPaperTrading:
        false,

      demoTradeAmountEUR:
        CONFIG.demoTradeAmountEUR,

      minimumNetProfitPercent:
        CONFIG.minimumNetProfitPercent,

      fees:
        CONFIG.fees,

      risk:
        CONFIG.risk
    });
  }
);


// ==========================================
// PORTFOLIO
// ==========================================

app.get(
  "/api/portfolio",
  async (req, res) => {

    try {

      assertDemoMode();

      const orderBookData =
        await getBTCOrderBooks();

      if (
        orderBookData.books.length === 0
      ) {
        throw new Error(
          "No order books available."
        );
      }

      const btcReferencePrice =
        getReferenceBTCPrice(
          orderBookData.books
        );

      initializePortfolio(
        btcReferencePrice
      );

      const portfolio =
        getPortfolioValue(
          btcReferencePrice
        );

      res.json({

        mode:
          "DEMO",

        version:
          "0.2.3",

        btcReferencePriceEUR:
          Number(
            btcReferencePrice.toFixed(2)
          ),

        portfolio,

        tradeHistoryCount:
          getTradeHistory().length
      });

    } catch (error) {

      res.status(500).json({

        mode:
          "DEMO",

        error:
          error.message
      });
    }
  }
);


// ==========================================
// TRADE HISTORY
// ==========================================

app.get(
  "/api/trades",
  (req, res) => {

    res.json({

      mode:
        "DEMO",

      automaticTrading:
        false,

      count:
        getTradeHistory().length,

      trades:
        getTradeHistory()
    });
  }
);


// ==========================================
// BTC ORDER BOOK SCANNER
// ==========================================

app.get(
  "/api/scan/btc/orderbooks",
  async (req, res) => {

    try {

      assertDemoMode();

      // ------------------------------------
      // FETCH LIVE BOOKS
      // ------------------------------------

      const orderBookData =
        await getBTCOrderBooks();

      const books =
        orderBookData.books;

      if (books.length < 2) {

        throw new Error(
          "At least two order books are required."
        );
      }

      // ------------------------------------
      // BTC REFERENCE PRICE
      // ------------------------------------

      const btcReferencePrice =
        getReferenceBTCPrice(
          books
        );

      // ------------------------------------
      // INITIALIZE PAPER PORTFOLIO
      // ------------------------------------

      initializePortfolio(
        btcReferencePrice
      );

      // ------------------------------------
      // TEST ALL ROUTES
      // ------------------------------------

      const routes = [];

      for (
        const buyBook of books
      ) {

        for (
          const sellBook of books
        ) {

          if (
            buyBook.exchange ===
            sellBook.exchange
          ) {
            continue;
          }

          const simulation =
            simulateOrderBookArbitrage({

              buyBook,

              sellBook,

              amountEUR:
                CONFIG.demoTradeAmountEUR
            });


          // --------------------------------
          // LIQUIDITY FAILURE
          // --------------------------------

          if (
            !simulation.executable
          ) {

            routes.push({

              buyExchange:
                buyBook.exchange,

              sellExchange:
                sellBook.exchange,

              executable:
                false,

              reason:
                "Insufficient order-book liquidity.",

              simulation
            });

            continue;
          }


          // --------------------------------
          // FEES
          // --------------------------------

          const fees =
            calculateRouteFees({

              buyExchange:
                buyBook.exchange,

              sellExchange:
                sellBook.exchange,

              buyCostEUR:
                simulation.buy.eurSpent,

              sellRevenueEUR:
                simulation.sell.eurReceived
            });


          // --------------------------------
          // NET PROFIT
          // --------------------------------

          const netProfitEUR =
            simulation.sell.eurReceived -
            fees.sellFeeEUR -
            simulation.buy.eurSpent -
            fees.buyFeeEUR;

          const netProfitPercent =
            (
              netProfitEUR /
              simulation.buy.eurSpent
            ) * 100;


          // --------------------------------
          // SLIPPAGE CHECK
          // --------------------------------

          const buySlippage =
            simulation.buy
              .slippagePercent;

          const sellSlippage =
            simulation.sell
              .slippagePercent;

          const slippageAllowed =
            buySlippage <=
              CONFIG.risk
                .maxSlippagePercent &&
            sellSlippage <=
              CONFIG.risk
                .maxSlippagePercent;


          // --------------------------------
          // BALANCE CHECK
          // --------------------------------

          const balanceCheck =
            canExecuteArbitrage({

              buyExchange:
                buyBook.exchange,

              sellExchange:
                sellBook.exchange,

              amountEUR:
                simulation.buy.eurSpent +
                fees.buyFeeEUR,

              btcAmount:
                simulation.buy.btcAmount
            });


          // --------------------------------
          // PROFIT CHECK
          // --------------------------------

          const profitableEnough =
            netProfitPercent >=
            CONFIG
              .minimumNetProfitPercent;


          // --------------------------------
          // FINAL ROUTE ELIGIBILITY
          // --------------------------------

          const paperTradeEligible =
            balanceCheck.allowed &&
            slippageAllowed &&
            profitableEnough;


          routes.push({

            buyExchange:
              buyBook.exchange,

            sellExchange:
              sellBook.exchange,

            executable:
              true,

            orderBook: {

              buyAveragePrice:
                simulation.buy
                  .averagePrice,

              sellAveragePrice:
                simulation.sell
                  .averagePrice,

              buyLevelsUsed:
                simulation.buy
                  .levelsUsed,

              sellLevelsUsed:
                simulation.sell
                  .levelsUsed,

              buySlippagePercent:
                buySlippage,

              sellSlippagePercent:
                sellSlippage
            },

            grossProfitEUR:
              simulation
                .grossProfitEUR,

            grossReturnPercent:
              simulation
                .grossReturnPercent,

            fees,

            netProfitEUR:
              Number(
                netProfitEUR.toFixed(4)
              ),

            netProfitPercent:
              Number(
                netProfitPercent.toFixed(6)
              ),

            checks: {

              sufficientBalances:
                balanceCheck.allowed,

              balanceCheck,

              slippageAllowed,

              profitableEnough
            },

            paperTradeEligible,

            paperTradeExecuted:
              false
          });
        }
      }


      // ====================================
      // SORT BEST → WORST
      // ====================================

      const executableRoutes =
        routes
          .filter(
            route =>
              route.executable &&
              Number.isFinite(
                route.netProfitPercent
              )
          )
          .sort(
            (a, b) =>
              b.netProfitPercent -
              a.netProfitPercent
          );


      const bestRoute =
        executableRoutes[0] ||
        null;


      const bestEligibleRoute =
        executableRoutes.find(
          route =>
            route.paperTradeEligible
        ) || null;


      // ====================================
      // PORTFOLIO VALUATION
      // ====================================

      const portfolio =
        getPortfolioValue(
          btcReferencePrice
        );


      // ====================================
      // RESPONSE
      // ====================================

      res.json({

        scanner:
          "ArbScan V2",

        version:
          "0.2.3",

        mode:
          "DEMO",

        symbol:
          "BTC/EUR",

        timestamp:
          new Date().toISOString(),

        btcReferencePriceEUR:
          Number(
            btcReferencePrice.toFixed(2)
          ),

        demoTradeAmountEUR:
          CONFIG.demoTradeAmountEUR,

        minimumNetProfitPercent:
          CONFIG.minimumNetProfitPercent,

        orderBooksAvailable:
          books.length,

        exchangeErrors:
          orderBookData.errors,

        routesTested:
          routes.length,

        routes,

        bestRoute,

        bestEligibleRoute,

        decision: {

          paperTradeWouldExecute:
            Boolean(
              bestEligibleRoute
            ),

          paperTradeActuallyExecuted:
            false,

          reason:
            bestEligibleRoute
              ? "Eligible paper-trade opportunity detected, but automatic execution is disabled in V2.3."
              : "No route currently satisfies all V2.3 conditions."
        },

        portfolio,

        limitations: [

          "Automatic paper trading is disabled.",

          "No real orders are executed.",

          "Order books are snapshots fetched separately.",

          "Network latency may change executable prices.",

          "Exchange fee tiers may vary by account and trading volume.",

          "Rebalancing costs are not yet modeled."
        ]
      });

    } catch (error) {

      console.error(
        "V2.3 scanner error:",
        error
      );

      res.status(500).json({

        scanner:
          "ArbScan V2",

        version:
          "0.2.3",

        mode:
          "DEMO",

        error:
          error.message
      });
    }
  }
);


// ==========================================
// REAL TRADING — HARD LOCK
// ==========================================

app.post(
  "/api/live/order",
  (req, res) => {

    res.status(403).json({

      executed:
        false,

      mode:
        "DEMO",

      error:
        "LIVE TRADING DISABLED"
    });
  }
);


// ==========================================
// SERVER
// ==========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log("");
    console.log(
      "=============================="
    );

    console.log(
      "       ARBSCAN V2.3"
    );

    console.log(
      "=============================="
    );

    console.log(
      "Mode: DEMO"
    );

    console.log(
      `Starting capital: €${CONFIG.startingBalanceEUR}`
    );

    console.log(
      `Max simulated trade: €${CONFIG.demoTradeAmountEUR}`
    );

    console.log(
      "Pre-positioned balances: ENABLED"
    );

    console.log(
      "Automatic paper trading: DISABLED"
    );

    console.log(
      "Real trading: DISABLED"
    );

    console.log(
      `Server port: ${PORT}`
    );

    console.log(
      "=============================="
    );

    console.log("");
  }
);