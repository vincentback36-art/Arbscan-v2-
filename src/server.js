import express from "express";
import {
  getBTCMarkets,
  findBestBTCArbitrage
} from "./exchanges.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==========================================
// ARBSCAN V2 — DEMO ONLY
// ==========================================

const CONFIG = Object.freeze({
  mode: "DEMO",
  realTradingEnabled: false,
  startingBalance: 10000,
  currency: "EUR",
  minimumNetProfitPercent: 0.30,
  maxTradePercent: 10
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
    version: "0.2.0",
    status: "online",
    mode: CONFIG.mode,
    realTrading: false,
    demoBalance: portfolio.balance,
    currency: CONFIG.currency,
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
    mode: CONFIG.mode,
    realTradingEnabled:
      CONFIG.realTradingEnabled,
    minimumNetProfitPercent:
      CONFIG.minimumNetProfitPercent
  });
});

// ==========================================
// PORTFOLIO
// ==========================================

app.get("/api/portfolio", (req, res) => {
  const performancePercent =
    ((portfolio.balance -
      portfolio.startingBalance) /
      portfolio.startingBalance) *
    100;

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
// REAL MARKET SCAN — BTC/EUR
// ==========================================
//
// IMPORTANT :
// vrais prix publics,
// mais AUCUN ordre réel.
//
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

    res.json({
      scanner: "ArbScan V2",
      mode: "DEMO",

      symbol: "BTC/EUR",

      timestamp:
        new Date().toISOString(),

      exchangesAvailable:
        marketData.markets.length,

      markets:
        marketData.markets,

      errors:
        marketData.errors,

      bestOpportunity,

      warning:
        "Gross opportunity only. Trading fees, order-book depth and slippage are not yet included."
    });

  } catch (error) {
    console.error(
      "BTC scanner error:",
      error
    );

    res.status(500).json({
      scanner: "ArbScan V2",
      mode: "DEMO",
      error: error.message
    });
  }
});

// ==========================================
// LIVE TRADING HARD LOCK
// ==========================================

app.post("/api/live/order", (req, res) => {
  res.status(403).json({
    executed: false,
    mode: "DEMO",
    error:
      "LIVE TRADING DISABLED"
  });
});

// ==========================================
// SERVER
// ==========================================

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("==============================");
  console.log("       ARBSCAN V2");
  console.log("==============================");
  console.log("Version: 0.2.0");
  console.log("Mode: DEMO");
  console.log(
    `Demo balance: €${portfolio.balance}`
  );
  console.log(
    "Real trading: DISABLED"
  );
  console.log(
    `Server port: ${PORT}`
  );
  console.log("==============================");
  console.log("");
});