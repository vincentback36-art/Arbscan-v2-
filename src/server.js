import express from "express";

import {
  getBTCMarkets,
  findBestBTCArbitrage
} from "./exchanges.js";

import {
  calculateNetArbitrage
} from "./fees.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==========================================
// ARBSCAN V2.1 — DEMO ONLY
// ==========================================

const CONFIG = Object.freeze({
  mode: "DEMO",
  realTradingEnabled: false,

  startingBalance: 10000,
  currency: "EUR",

  // Montant utilisé pour chaque calcul DEMO.
  demoTradeAmount: 1000,

  // Profit NET minimum exigé.
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

// ==========================================
// SECURITY
// ==========================================

function assertDemoMode() {
  if (
    CONFIG.mode !== "DEMO" ||
    CONFIG.realTradingEnabled !== false
  ) {
    throw new Error(
      "SECURITY LOCK: ArbScan V2 is DEMO ONLY."
    );
  }
}

// ==========================================
// HOME
// ==========================================

app.get("/", (req, res) => {
  res.json({
    app: "ArbScan V2",
    version: "0.2.1",

    status: "online",

    mode: CONFIG.mode,
    realTrading: false,

    demoBalance:
      portfolio.balance,

    currency:
      CONFIG.currency,

    demoTradeAmount:
      CONFIG.demoTradeAmount,

    endpoints: {
      status: "/api/status",
      portfolio: "/api/portfolio",
      btcScan: "/api/scan/btc",
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

    version: "0.2.1",

    mode:
      CONFIG.mode,

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
      Number(
        performancePercent.toFixed(4)
      ),

    currency:
      CONFIG.currency
  });
});

// ==========================================
// TRADE HISTORY
// ==========================================

app.get("/api/trades", (req, res) => {
  res.json({
    count:
      trades.length,

    trades
  });
});

// ==========================================
// BTC/EUR LIVE MARKET SCAN
// ==========================================

app.get(
  "/api/scan/btc",
  async (req, res) => {

    try {
      assertDemoMode();

      // -------------------------------
      // 1. LIVE MARKET DATA
      // -------------------------------

      const marketData =
        await getBTCMarkets();

      // -------------------------------
      // 2. BEST GROSS OPPORTUNITY
      // -------------------------------

      const bestOpportunity =
        findBestBTCArbitrage(
          marketData.markets
        );

      let netSimulation = null;

      let decision = {
        executeDemoTrade: false,
        reason:
          "Not enough market data."
      };

      // -------------------------------
      // 3. NET PROFIT SIMULATION
      // -------------------------------

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

        // -----------------------------
        // 4. DECISION ENGINE
        // -----------------------------

        if (
          netSimulation.netProfitPercent >=
          CONFIG.minimumNetProfitPercent
        ) {
          decision = {
            executeDemoTrade: true,

            reason:
              "Estimated net profit is above DEMO threshold."
          };
        } else {
          decision = {
            executeDemoTrade: false,

            reason:
              "Estimated net profit is below DEMO threshold."
          };
        }
      }

      // -------------------------------
      // RESPONSE
      // -------------------------------

      res.json({
        scanner:
          "ArbScan V2",

        version:
          "0.2.1",

        mode:
          "DEMO",

        symbol:
          "BTC/EUR",

        timestamp:
          new Date().toISOString(),

        demoTradeAmountEUR:
          CONFIG.demoTradeAmount,

        exchangesAvailable:
          marketData.markets.length,

        markets:
          marketData.markets,

        exchangeErrors:
          marketData.errors,

        bestGrossOpportunity:
          bestOpportunity,

        estimatedNetResult:
          netSimulation,

        decision,

        limitations: [
          "Fee rates are DEMO assumptions.",
          "Order-book depth is not yet included.",
          "Slippage is not yet calculated from order books.",
          "Transfer costs are not yet included.",
          "No real orders are executed."
        ]
      });

    } catch (error) {

      console.error(
        "BTC scanner error:",
        error
      );

      res.status(500).json({
        scanner:
          "ArbScan V2",

        mode:
          "DEMO",

        error:
          error.message
      });
    }
  }
);

// ==========================================
// LIVE TRADING — HARD LOCK
// ==========================================

app.post(
  "/api/live/order",
  (req, res) => {

    res.status(403).json({
      executed: false,

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
      "       ARBSCAN V2.1"
    );

    console.log(
      "=============================="
    );

    console.log(
      "Mode: DEMO"
    );

    console.log(
      `Demo balance: €${portfolio.balance}`
    );

    console.log(
      `Simulation amount: €${CONFIG.demoTradeAmount}`
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