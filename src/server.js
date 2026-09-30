import express from "express";

import {
  getBTCMarkets,
  findBestBTCArbitrage
} from "./exchanges.js";

import {
  calculateNetArbitrage
} from "./fees.js";

import {
  getBTCOrderBooks,
  simulateOrderBookArbitrage
} from "./orderbooks.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==========================================
// ARBSCAN V2.2 — DEMO ONLY
// ==========================================

const CONFIG = Object.freeze({
  mode: "DEMO",
  realTradingEnabled: false,
  startingBalance: 10000,
  currency: "EUR",
  demoTradeAmount: 1000,
  minimumNetProfitPercent: 0.30
});

const portfolio = {
  startingBalance: CONFIG.startingBalance,
  balance: CONFIG.startingBalance,
  totalProfit: 0,
  simulatedTrades: 0,
  winningTrades: 0,
  losingTrades: 0
};

const trades = [];

function assertDemoMode() {
  if (
    CONFIG.mode !== "DEMO" ||
    CONFIG.realTradingEnabled !== false
  ) {
    throw new Error(
      "SECURITY LOCK: ArbScan is DEMO ONLY."
    );
  }
}

// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {
  res.json({
    app: "ArbScan V2",
    version: "0.2.2",
    status: "online",
    mode: CONFIG.mode,
    realTrading: false,
    demoBalance: portfolio.balance,
    currency: CONFIG.currency,
    demoTradeAmount: CONFIG.demoTradeAmount,

    features: {
      livePrices: true,
      estimatedFees: true,
      orderBooks: true,
      orderBookSlippage: true,
      liveTrading: false
    },

    endpoints: {
      status: "/api/status",
      portfolio: "/api/portfolio",
      btcScan: "/api/scan/btc",
      btcOrderBookScan: "/api/scan/btc/orderbooks",
      trades: "/api/trades"
    }
  });
});

// ==========================================
// STATUS
// ==========================================

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    version: "0.2.2",
    mode: CONFIG.mode,
    realTradingEnabled:
      CONFIG.realTradingEnabled,
    demoTradeAmount:
      CONFIG.demoTradeAmount,
    minimumNetProfitPercent:
      CONFIG.minimumNetProfitPercent
  });
});

// ==========================================
// PORTFOLIO
// ==========================================

app.get("/api/portfolio", (req, res) => {
  const performancePercent =
    (
      (
        portfolio.balance -
        portfolio.startingBalance
      ) /
      portfolio.startingBalance
    ) * 100;

  res.json({
    ...portfolio,
    performancePercent:
      Number(performancePercent.toFixed(4)),
    currency: CONFIG.currency
  });
});

// ==========================================
// TRADES
// ==========================================

app.get("/api/trades", (req, res) => {
  res.json({
    count: trades.length,
    trades
  });
});

// ==========================================
// V2.1 — SIMPLE BTC SCAN
// ==========================================

app.get("/api/scan/btc", async (req, res) => {
  try {
    assertDemoMode();

    const marketData =
      await getBTCMarkets();

    const bestOpportunity =
      findBestBTCArbitrage(
        marketData.markets
      );

    let netSimulation = null;

    if (bestOpportunity) {
      netSimulation =
        calculateNetArbitrage({
          buyExchange:
            bestOpportunity.buyExchange,

          sellExchange:
            bestOpportunity.sellExchange,

          buyPrice:
            bestOpportunity.buyPrice,

          sellPrice:
            bestOpportunity.sellPrice,

          amountEUR:
            CONFIG.demoTradeAmount
        });
    }

    const executeDemoTrade =
      netSimulation &&
      netSimulation.netProfitPercent >=
        CONFIG.minimumNetProfitPercent;

    res.json({
      scanner: "ArbScan V2",
      version: "0.2.2",
      mode: "DEMO",
      symbol: "BTC/EUR",
      timestamp: new Date().toISOString(),

      markets:
        marketData.markets,

      exchangeErrors:
        marketData.errors,

      bestGrossOpportunity:
        bestOpportunity,

      estimatedNetResult:
        netSimulation,

      decision: {
        executeDemoTrade:
          Boolean(executeDemoTrade),

        reason:
          executeDemoTrade
            ? "Estimated net profit above DEMO threshold."
            : "Estimated net profit below DEMO threshold."
      }
    });

  } catch (error) {
    res.status(500).json({
      scanner: "ArbScan V2",
      mode: "DEMO",
      error: error.message
    });
  }
});

// ==========================================
// V2.2 — ORDER BOOK SCANNER
// ==========================================

app.get(
  "/api/scan/btc/orderbooks",
  async (req, res) => {

    try {
      assertDemoMode();

      const orderBookData =
        await getBTCOrderBooks();

      const books =
        orderBookData.books;

      const routes = [];

      // ====================================
      // TEST EVERY EXCHANGE COMBINATION
      // ====================================

      for (const buyBook of books) {

        for (const sellBook of books) {

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
                CONFIG.demoTradeAmount
            });

          if (!simulation.executable) {
            routes.push({
              buyExchange:
                buyBook.exchange,

              sellExchange:
                sellBook.exchange,

              executable: false,

              simulation
            });

            continue;
          }

          // ==================================
          // APPLY DEMO TRADING FEES
          // ==================================

          const feeResult =
            calculateNetArbitrage({
              buyExchange:
                buyBook.exchange,

              sellExchange:
                sellBook.exchange,

              buyPrice:
                simulation.buy.averagePrice,

              sellPrice:
                simulation.sell.averagePrice,

              amountEUR:
                CONFIG.demoTradeAmount
            });

          routes.push({
            buyExchange:
              buyBook.exchange,

            sellExchange:
              sellBook.exchange,

            executable: true,

            orderBook: {
              buyAveragePrice:
                simulation.buy.averagePrice,

              sellAveragePrice:
                simulation.sell.averagePrice,

              buyLevelsUsed:
                simulation.buy.levelsUsed,

              sellLevelsUsed:
                simulation.sell.levelsUsed,

              buySlippagePercent:
                simulation.buy.slippagePercent,

              sellSlippagePercent:
                simulation.sell.slippagePercent
            },

            grossProfitEUR:
              simulation.grossProfitEUR,

            grossReturnPercent:
              simulation.grossReturnPercent,

            feesEUR:
              feeResult.totalFeesEUR,

            netProfitEUR:
              feeResult.netProfitEUR,

            netProfitPercent:
              feeResult.netProfitPercent
          });
        }
      }

      // ====================================
      // SORT BEST → WORST
      // ====================================

      const executableRoutes =
        routes
          .filter(route =>
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
        executableRoutes[0] || null;

      // ====================================
      // DECISION
      // ====================================

      const executeDemoTrade =
        Boolean(
          bestRoute &&
          bestRoute.netProfitPercent >=
            CONFIG.minimumNetProfitPercent
        );

      res.json({
        scanner:
          "ArbScan V2",

        version:
          "0.2.2",

        mode:
          "DEMO",

        symbol:
          "BTC/EUR",

        timestamp:
          new Date().toISOString(),

        demoTradeAmountEUR:
          CONFIG.demoTradeAmount,

        orderBooksAvailable:
          books.length,

        exchangeErrors:
          orderBookData.errors,

        routesTested:
          routes.length,

        routes,

        bestRoute,

        decision: {
          executeDemoTrade,

          minimumRequiredNetPercent:
            CONFIG.minimumNetProfitPercent,

          reason:
            !bestRoute
              ? "No executable route."
              : executeDemoTrade
                ? "Best route exceeds DEMO net-profit threshold."
                : "No route exceeds DEMO net-profit threshold."
        },

        limitations: [
          "Fee rates are DEMO assumptions.",
          "Order books are snapshots and exchanges are queried separately.",
          "Network latency can change prices before execution.",
          "Transfer costs are not included.",
          "Funds are not yet modeled as pre-positioned across exchanges.",
          "No real orders are executed."
        ]
      });

    } catch (error) {

      console.error(
        "Order-book scanner error:",
        error
      );

      res.status(500).json({
        scanner:
          "ArbScan V2",

        version:
          "0.2.2",

        mode:
          "DEMO",

        error:
          error.message
      });
    }
  }
);

// ==========================================
// LIVE TRADING HARD LOCK
// ==========================================

app.post(
  "/api/live/order",
  (req, res) => {

    res.status(403).json({
      executed: false,
      mode: "DEMO",
      error: "LIVE TRADING DISABLED"
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
    console.log("==============================");
    console.log("       ARBSCAN V2.2");
    console.log("==============================");
    console.log("Mode: DEMO");
    console.log(
      `Demo balance: €${portfolio.balance}`
    );
    console.log(
      `Simulation amount: €${CONFIG.demoTradeAmount}`
    );
    console.log(
      "Order-book engine: ENABLED"
    );
    console.log(
      "Real trading: DISABLED"
    );
    console.log(
      `Server port: ${PORT}`
    );
    console.log("==============================");
    console.log("");
  }
);