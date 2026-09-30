import {
  CONFIG,
  assertDemoMode,
  validateConfig
} from "./config.js";

// ==========================================
// ARBSCAN V2.3 — PAPER PORTFOLIO
// DEMO ONLY
// ==========================================

let initialized = false;

let initialBTCPriceEUR = null;

const balances = {};

const tradeHistory = [];


// ==========================================
// INITIALIZE PORTFOLIO
// ==========================================

export function initializePortfolio(
  btcPriceEUR
) {

  assertDemoMode();
  validateConfig();

  if (initialized) {
    return getPortfolio();
  }

  if (
    !Number.isFinite(btcPriceEUR) ||
    btcPriceEUR <= 0
  ) {
    throw new Error(
      "Invalid BTC initialization price."
    );
  }

  initialBTCPriceEUR =
    btcPriceEUR;

  for (
    const [
      exchange,
      allocation
    ] of Object.entries(
      CONFIG.exchanges
    )
  ) {

    balances[exchange] = {

      eur:
        allocation.eur,

      btc:
        allocation.btcValueEUR /
        btcPriceEUR
    };
  }

  initialized = true;

  return getPortfolio();
}


// ==========================================
// PORTFOLIO STATE
// ==========================================

export function getPortfolio() {

  const exchanges = {};

  for (
    const [
      exchange,
      balance
    ] of Object.entries(
      balances
    )
  ) {

    exchanges[exchange] = {

      eur:
        Number(
          balance.eur.toFixed(2)
        ),

      btc:
        Number(
          balance.btc.toFixed(8)
        )
    };
  }

  return {

    initialized,

    initialBTCPriceEUR,

    exchanges,

    tradeCount:
      tradeHistory.length
  };
}


// ==========================================
// PORTFOLIO VALUE
// ==========================================

export function getPortfolioValue(
  btcPriceEUR
) {

  if (!initialized) {
    throw new Error(
      "Portfolio not initialized."
    );
  }

  if (
    !Number.isFinite(btcPriceEUR) ||
    btcPriceEUR <= 0
  ) {
    throw new Error(
      "Invalid BTC valuation price."
    );
  }

  let eurTotal = 0;
  let btcTotal = 0;

  const exchanges = {};

  for (
    const [
      exchange,
      balance
    ] of Object.entries(
      balances
    )
  ) {

    const btcValueEUR =
      balance.btc *
      btcPriceEUR;

    const totalValueEUR =
      balance.eur +
      btcValueEUR;

    eurTotal +=
      balance.eur;

    btcTotal +=
      balance.btc;

    exchanges[exchange] = {

      eur:
        Number(
          balance.eur.toFixed(2)
        ),

      btc:
        Number(
          balance.btc.toFixed(8)
        ),

      btcValueEUR:
        Number(
          btcValueEUR.toFixed(2)
        ),

      totalValueEUR:
        Number(
          totalValueEUR.toFixed(2)
        )
    };
  }

  const totalValueEUR =
    eurTotal +
    (
      btcTotal *
      btcPriceEUR
    );

  const pnlEUR =
    totalValueEUR -
    CONFIG.startingBalanceEUR;

  const pnlPercent =
    (
      pnlEUR /
      CONFIG.startingBalanceEUR
    ) * 100;

  return {

    btcPriceEUR,

    exchanges,

    totals: {

      eur:
        Number(
          eurTotal.toFixed(2)
        ),

      btc:
        Number(
          btcTotal.toFixed(8)
        ),

      totalValueEUR:
        Number(
          totalValueEUR.toFixed(2)
        ),

      pnlEUR:
        Number(
          pnlEUR.toFixed(2)
        ),

      pnlPercent:
        Number(
          pnlPercent.toFixed(4)
        )
    }
  };
}


// ==========================================
// CHECK WHETHER ROUTE CAN BE EXECUTED
// ==========================================

export function canExecuteArbitrage({
  buyExchange,
  sellExchange,
  amountEUR,
  btcAmount
}) {

  assertDemoMode();

  if (!initialized) {

    return {
      allowed: false,
      reason:
        "Portfolio not initialized."
    };
  }

  const buyer =
    balances[buyExchange];

  const seller =
    balances[sellExchange];

  if (!buyer || !seller) {

    return {
      allowed: false,
      reason:
        "Unknown exchange."
    };
  }

  if (
    buyer.eur <
    amountEUR
  ) {

    return {
      allowed: false,

      reason:
        `${buyExchange} has insufficient EUR balance.`,

      availableEUR:
        Number(
          buyer.eur.toFixed(2)
        ),

      requiredEUR:
        Number(
          amountEUR.toFixed(2)
        )
    };
  }

  if (
    seller.btc <
    btcAmount
  ) {

    return {
      allowed: false,

      reason:
        `${sellExchange} has insufficient BTC balance.`,

      availableBTC:
        Number(
          seller.btc.toFixed(8)
        ),

      requiredBTC:
        Number(
          btcAmount.toFixed(8)
        )
    };
  }

  return {

    allowed: true,

    reason:
      "Sufficient pre-positioned DEMO balances."
  };
}


// ==========================================
// EXECUTE PAPER ARBITRAGE
// ==========================================
//
// IMPORTANT:
//
// This changes DEMO balances only.
// It cannot communicate with an exchange.
// No API keys.
// No real orders.
//
// ==========================================

export function executePaperArbitrage({
  buyExchange,
  sellExchange,

  amountEUR,
  btcAmount,

  sellRevenueEUR,

  buyFeeEUR,
  sellFeeEUR,

  metadata = {}
}) {

  assertDemoMode();

  const check =
    canExecuteArbitrage({
      buyExchange,
      sellExchange,
      amountEUR:
        amountEUR +
        buyFeeEUR,
      btcAmount
    });

  if (!check.allowed) {
    return {
      executed: false,
      check
    };
  }

  const buyer =
    balances[buyExchange];

  const seller =
    balances[sellExchange];

  // ----------------------------------------
  // BUY LEG
  // ----------------------------------------

  buyer.eur -=
    amountEUR +
    buyFeeEUR;

  buyer.btc +=
    btcAmount;

  // ----------------------------------------
  // SELL LEG
  // ----------------------------------------

  seller.btc -=
    btcAmount;

  seller.eur +=
    sellRevenueEUR -
    sellFeeEUR;

  // ----------------------------------------
  // PAPER TRADE RECORD
  // ----------------------------------------

  const netCashChangeEUR =
    (
      sellRevenueEUR -
      sellFeeEUR
    ) -
    (
      amountEUR +
      buyFeeEUR
    );

  const trade = {

    id:
      tradeHistory.length + 1,

    timestamp:
      new Date().toISOString(),

    mode:
      "DEMO",

    buyExchange,
    sellExchange,

    amountEUR:
      Number(
        amountEUR.toFixed(2)
      ),

    btcAmount:
      Number(
        btcAmount.toFixed(8)
      ),

    buyFeeEUR:
      Number(
        buyFeeEUR.toFixed(2)
      ),

    sellFeeEUR:
      Number(
        sellFeeEUR.toFixed(2)
      ),

    netCashChangeEUR:
      Number(
        netCashChangeEUR.toFixed(2)
      ),

    metadata
  };

  tradeHistory.push(
    trade
  );

  return {

    executed: true,

    trade,

    portfolio:
      getPortfolio()
  };
}


// ==========================================
// TRADE HISTORY
// ==========================================

export function getTradeHistory() {

  return [
    ...tradeHistory
  ];
}


// ==========================================
// RESET DEMO PORTFOLIO
// ==========================================

export function resetPortfolio() {

  assertDemoMode();

  for (
    const exchange of
    Object.keys(balances)
  ) {
    delete balances[exchange];
  }

  tradeHistory.length = 0;

  initialized = false;

  initialBTCPriceEUR = null;

  return {
    reset: true,
    mode: "DEMO"
  };
}