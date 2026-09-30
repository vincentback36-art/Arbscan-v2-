// ==========================================
// ARBSCAN V2.3 — CENTRAL CONFIGURATION
// DEMO / PAPER TRADING ONLY
// ==========================================

export const CONFIG = Object.freeze({

  // ----------------------------------------
  // SECURITY
  // ----------------------------------------

  mode: "DEMO",
  realTradingEnabled: false,

  // ----------------------------------------
  // PAPER PORTFOLIO
  // ----------------------------------------

  startingBalanceEUR: 10000,

  // Capital maximum simulé par arbitrage
  demoTradeAmountEUR: 1000,

  // Profit NET minimum avant paper trade
  minimumNetProfitPercent: 0.30,

  // ----------------------------------------
  // TAKER FEES
  // ----------------------------------------
  //
  // Hypothèses correspondant au niveau
  // d'entrée actuel.
  //
  // Elles restent configurables car le
  // niveau réel dépend du compte/volume.
  // ----------------------------------------

  fees: {

    Binance: {
      takerPercent: 0.15,
      source: "Binance fiat spot fee schedule",
      configurable: true
    },

    Kraken: {
      takerPercent: 0.80,
      source: "Kraken Pro Spot Crypto Tier 1",
      configurable: true
    },

    Coinbase: {
      takerPercent: 0.50,
      source: "Coinbase Advanced EU entry tier",
      configurable: true
    }
  },

  // ----------------------------------------
  // PRE-POSITIONED DEMO BALANCES
  // ----------------------------------------
  //
  // 10 000 € fictifs répartis entre
  // les trois exchanges.
  //
  // Une partie est conservée en EUR
  // et une partie en BTC.
  //
  // La valeur BTC sera initialisée
  // ultérieurement avec le marché.
  // ----------------------------------------

  exchanges: {

    Binance: {
      eur: 2000,
      btcValueEUR: 1500
    },

    Kraken: {
      eur: 1500,
      btcValueEUR: 1500
    },

    Coinbase: {
      eur: 1500,
      btcValueEUR: 2000
    }
  },

  // ----------------------------------------
  // SAFETY LIMITS
  // ----------------------------------------

  risk: {

    // Jamais plus de 10 % du portefeuille
    // théorique sur une opportunité.
    maxPortfolioPercentPerTrade: 10,

    // Refuse un carnet trop ancien.
    maxOrderBookAgeMs: 5000,

    // Limite de slippage acceptable
    // pour la simulation.
    maxSlippagePercent: 0.10
  }
});


// ==========================================
// SECURITY CHECK
// ==========================================

export function assertDemoMode() {

  if (
    CONFIG.mode !== "DEMO" ||
    CONFIG.realTradingEnabled !== false
  ) {
    throw new Error(
      "SECURITY LOCK: ArbScan must remain DEMO ONLY."
    );
  }
}


// ==========================================
// FEE ACCESS
// ==========================================

export function getTakerFee(exchange) {

  const exchangeConfig =
    CONFIG.fees[exchange];

  if (!exchangeConfig) {
    throw new Error(
      `Unknown exchange: ${exchange}`
    );
  }

  return exchangeConfig.takerPercent;
}


// ==========================================
// INITIAL DEMO CAPITAL CHECK
// ==========================================

export function getInitialCapitalEUR() {

  return Object.values(
    CONFIG.exchanges
  ).reduce(
    (total, exchange) =>
      total +
      exchange.eur +
      exchange.btcValueEUR,
    0
  );
}


// ==========================================
// CONFIG VALIDATION
// ==========================================

export function validateConfig() {

  assertDemoMode();

  const capital =
    getInitialCapitalEUR();

  if (
    capital !==
    CONFIG.startingBalanceEUR
  ) {
    throw new Error(
      `Invalid DEMO allocation: €${capital} allocated instead of €${CONFIG.startingBalanceEUR}.`
    );
  }

  return true;
}