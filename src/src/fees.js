// ==========================================
// ARBSCAN V2 — DEMO FEE MODEL
// ==========================================
//
// IMPORTANT:
//
// Ces taux servent à la simulation.
// Ils ne doivent PAS être présentés comme
// les frais exacts d'un compte utilisateur.
//
// Les frais réels peuvent varier selon :
// - volume de trading
// - maker / taker
// - niveau VIP
// - promotions
// - marché utilisé
//
// ==========================================

export const EXCHANGE_FEES = Object.freeze({
  Binance: {
    takerPercent: 0.10
  },

  Kraken: {
    takerPercent: 0.40
  },

  Coinbase: {
    takerPercent: 0.60
  }
});

export function getTakerFee(exchange) {
  const config = EXCHANGE_FEES[exchange];

  if (!config) {
    throw new Error(
      `Unknown exchange fee configuration: ${exchange}`
    );
  }

  return config.takerPercent;
}

// ==========================================
// NET ARBITRAGE CALCULATION
// ==========================================

export function calculateNetArbitrage({
  buyExchange,
  sellExchange,
  buyPrice,
  sellPrice,
  amountEUR
}) {
  if (
    !Number.isFinite(buyPrice) ||
    !Number.isFinite(sellPrice) ||
    !Number.isFinite(amountEUR) ||
    buyPrice <= 0 ||
    sellPrice <= 0 ||
    amountEUR <= 0
  ) {
    throw new Error(
      "Invalid arbitrage calculation parameters"
    );
  }

  const buyFeePercent =
    getTakerFee(buyExchange);

  const sellFeePercent =
    getTakerFee(sellExchange);

  // Quantité théorique de BTC achetée
  // avant application des frais.
  const btcAmount =
    amountEUR / buyPrice;

  // Valeur obtenue à la revente.
  const grossSellValue =
    btcAmount * sellPrice;

  const buyFeeEUR =
    amountEUR *
    (buyFeePercent / 100);

  const sellFeeEUR =
    grossSellValue *
    (sellFeePercent / 100);

  const totalFeesEUR =
    buyFeeEUR + sellFeeEUR;

  const grossProfitEUR =
    grossSellValue - amountEUR;

  const netProfitEUR =
    grossProfitEUR - totalFeesEUR;

  const netProfitPercent =
    (netProfitEUR / amountEUR) * 100;

  return {
    amountEUR:
      Number(amountEUR.toFixed(2)),

    btcAmount:
      Number(btcAmount.toFixed(8)),

    buyFeePercent,
    sellFeePercent,

    buyFeeEUR:
      Number(buyFeeEUR.toFixed(2)),

    sellFeeEUR:
      Number(sellFeeEUR.toFixed(2)),

    totalFeesEUR:
      Number(totalFeesEUR.toFixed(2)),

    grossProfitEUR:
      Number(grossProfitEUR.toFixed(2)),

    netProfitEUR:
      Number(netProfitEUR.toFixed(2)),

    netProfitPercent:
      Number(netProfitPercent.toFixed(4)),

    profitable:
      netProfitEUR > 0
  };
}