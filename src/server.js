import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==========================================
// ARBSCAN V2 — DEMO / PAPER TRADING ONLY
// ==========================================

const CONFIG = Object.freeze({
  mode: "DEMO",
  realTradingEnabled: false,
  startingBalance: 10000,
  currency: "EUR",

  // On commencera uniquement si le profit NET
  // dépasse ce seuil.
  minimumNetProfitPercent: 0.30,

  // Capital maximum utilisé par une simulation.
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

// Sécurité absolue pour la V2 DEMO.
function assertDemoMode() {
  if (CONFIG.mode !== "DEMO" || CONFIG.realTradingEnabled !== false) {
    throw new Error(
      "SECURITY LOCK: ArbScan V2 is restricted to DEMO trading."
    );
  }
}

// Calcule une opportunité d'arbitrage.
// Les frais sont exprimés en pourcentage.
function calculateOpportunity({
  symbol,
  buyExchange,
  sellExchange,
  buyPrice,
  sellPrice,
  buyFeePercent = 0,
  sellFeePercent = 0,
  slippagePercent = 0,
  transferCost = 0,
  amount = 1000
}) {
  const grossSpreadPercent =
    ((sellPrice - buyPrice) / buyPrice) * 100;

  const tradingFees =
    amount * ((buyFeePercent + sellFeePercent) / 100);

  const slippageCost =
    amount * (slippagePercent / 100);

  const grossProfit =
    amount * (grossSpreadPercent / 100);

  const netProfit =
    grossProfit -
    tradingFees -
    slippageCost -
    transferCost;

  const netProfitPercent =
    (netProfit / amount) * 100;

  return {
    symbol,
    buyExchange,
    sellExchange,
    buyPrice,
    sellPrice,
    amount,

    grossSpreadPercent:
      Number(grossSpreadPercent.toFixed(4)),

    estimatedCosts:
      Number(
        (
          tradingFees +
          slippageCost +
          transferCost
        ).toFixed(2)
      ),

    netProfit:
      Number(netProfit.toFixed(2)),

    netProfitPercent:
      Number(netProfitPercent.toFixed(4)),

    profitable:
      netProfitPercent >=
      CONFIG.minimumNetProfitPercent
  };
}

// Simule un arbitrage.
// Aucun ordre réel n'est envoyé.
function executeDemoTrade(opportunity) {
  assertDemoMode();

  const maxAllowed =
    portfolio.balance *
    (CONFIG.maxTradePercent / 100);

  if (opportunity.amount > maxAllowed) {
    return {
      executed: false,
      reason: `Trade exceeds demo risk limit (€${maxAllowed.toFixed(2)})`
    };
  }

  if (!opportunity.profitable) {
    return {
      executed: false,
      reason: "Net profit below minimum threshold"
    };
  }

  portfolio.balance += opportunity.netProfit;
  portfolio.totalProfit += opportunity.netProfit;
  portfolio.simulatedTrades += 1;

  if (opportunity.netProfit >= 0) {
    portfolio.winningTrades += 1;
  } else {
    portfolio.losingTrades += 1;
  }

  const trade = {
    id: trades.length + 1,
    type: "PAPER_TRADE",
    timestamp: new Date().toISOString(),
    ...opportunity
  };

  trades.unshift(trade);

  return {
    executed: true,
    trade
  };
}

// ==========================================
// API
// ==========================================

app.get("/", (req, res) => {
  res.json({
    app: "ArbScan V2",
    version: "0.1.0",
    status: "online",
    mode: CONFIG.mode,
    realTrading: false,
    message:
      "Arbitrage scanner running in DEMO mode."
  });
});

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

app.get("/api/trades", (req, res) => {
  res.json({
    count: trades.length,
    trades
  });
});

// Route temporaire pour tester le moteur.
// Plus tard, les prix seront fournis automatiquement
// par les exchanges.
app.post("/api/demo/opportunity", (req, res) => {
  try {
    assertDemoMode();

    const opportunity =
      calculateOpportunity(req.body);

    const result =
      executeDemoTrade(opportunity);

    res.json({
      opportunity,
      simulation: result,
      portfolio
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Toute tentative d'ordre réel est bloquée.
app.post("/api/live/order", (req, res) => {
  res.status(403).json({
    executed: false,
    error:
      "LIVE TRADING DISABLED — ArbScan V2 is currently DEMO ONLY."
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("==============================");
  console.log("       ARBSCAN V2");
  console.log("==============================");
  console.log(`Mode: ${CONFIG.mode}`);
  console.log(
    `Demo balance: €${portfolio.balance}`
  );
  console.log("Real trading: DISABLED");
  console.log(`Server port: ${PORT}`);
  console.log("==============================");
  console.log("");
});