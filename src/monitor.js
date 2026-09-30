// ==========================================
// ARBSCAN V2.4 — CONTINUOUS MONITOR
// DEMO / OBSERVATION ONLY
// ==========================================

const CONFIG = {
  intervalMs: 2000,
  maxHistory: 10000
};

let running = false;
let timer = null;

let startedAt = null;
let totalScans = 0;
let successfulScans = 0;
let failedScans = 0;

const history = [];
const opportunities = [];

let lastScan = null;


// ==========================================
// STORE SCAN
// ==========================================

function recordScan(scan) {

  totalScans++;

  if (scan.error) {
    failedScans++;
  } else {
    successfulScans++;
  }

  lastScan = scan;

  history.push(scan);

  // Avoid unlimited RAM usage
  if (
    history.length >
    CONFIG.maxHistory
  ) {
    history.shift();
  }

  if (
    scan.opportunity === true
  ) {

    opportunities.push(scan);

    if (
      opportunities.length >
      CONFIG.maxHistory
    ) {
      opportunities.shift();
    }
  }
}


// ==========================================
// RUN ONE SCAN
// ==========================================

async function executeScan(
  scanFunction
) {

  const scanStarted =
    Date.now();

  try {

    const result =
      await scanFunction();

    const scan = {

      id:
        totalScans + 1,

      timestamp:
        new Date().toISOString(),

      durationMs:
        Date.now() -
        scanStarted,

      error:
        null,

      ...result
    };

    recordScan(scan);

    return scan;

  } catch (error) {

    const scan = {

      id:
        totalScans + 1,

      timestamp:
        new Date().toISOString(),

      durationMs:
        Date.now() -
        scanStarted,

      error:
        error?.message ||
        "Unknown scan error",

      opportunity:
        false
    };

    recordScan(scan);

    return scan;
  }
}


// ==========================================
// START MONITOR
// ==========================================

export function startMonitor(
  scanFunction
) {

  if (running) {

    return {
      started: false,
      reason:
        "Monitor already running.",
      status:
        getMonitorStatus()
    };
  }

  if (
    typeof scanFunction !==
    "function"
  ) {
    throw new Error(
      "scanFunction must be a function."
    );
  }

  running = true;

  startedAt =
    new Date().toISOString();

  // First scan immediately
  executeScan(scanFunction);

  timer =
    setInterval(
      async () => {

        // Prevent overlapping scans
        if (!running) {
          return;
        }

        await executeScan(
          scanFunction
        );

      },
      CONFIG.intervalMs
    );

  return {
    started: true,
    status:
      getMonitorStatus()
  };
}


// ==========================================
// STOP MONITOR
// ==========================================

export function stopMonitor() {

  if (!running) {

    return {
      stopped: false,
      reason:
        "Monitor is not running.",
      status:
        getMonitorStatus()
    };
  }

  running = false;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  return {
    stopped: true,
    status:
      getMonitorStatus()
  };
}


// ==========================================
// STATUS
// ==========================================

export function getMonitorStatus() {

  const uptimeMs =
    startedAt
      ? Date.now() -
        new Date(
          startedAt
        ).getTime()
      : 0;

  return {

    version:
      "0.2.4",

    mode:
      "DEMO",

    running,

    intervalMs:
      CONFIG.intervalMs,

    startedAt,

    uptimeMs,

    statistics: {

      totalScans,

      successfulScans,

      failedScans,

      opportunitiesDetected:
        opportunities.length
    },

    lastScan
  };
}


// ==========================================
// HISTORY
// ==========================================

export function getScanHistory(
  limit = 100
) {

  const safeLimit =
    Math.max(
      1,
      Math.min(
        Number(limit) || 100,
        1000
      )
    );

  return history.slice(
    -safeLimit
  );
}


// ==========================================
// OPPORTUNITIES
// ==========================================

export function getOpportunities(
  limit = 100
) {

  const safeLimit =
    Math.max(
      1,
      Math.min(
        Number(limit) || 100,
        1000
      )
    );

  return opportunities.slice(
    -safeLimit
  );
}


// ==========================================
// SUMMARY
// ==========================================

export function getMonitorSummary() {

  const profitable =
    history.filter(
      scan =>
        scan.opportunity === true
    );

  const netProfits =
    profitable
      .map(
        scan =>
          scan.netProfitEUR
      )
      .filter(
        Number.isFinite
      );

  const bestNetProfitEUR =
    netProfits.length
      ? Math.max(
          ...netProfits
        )
      : null;

  const bestNetProfitPercent =
    profitable.length
      ? Math.max(
          ...profitable
            .map(
              scan =>
                scan.netProfitPercent
            )
            .filter(
              Number.isFinite
            )
        )
      : null;

  return {

    mode:
      "DEMO",

    running,

    startedAt,

    intervalMs:
      CONFIG.intervalMs,

    totalScans,

    successfulScans,

    failedScans,

    opportunitiesDetected:
      profitable.length,

    opportunityRatePercent:
      totalScans > 0
        ? Number(
            (
              profitable.length /
              totalScans *
              100
            ).toFixed(4)
          )
        : 0,

    bestNetProfitEUR,

    bestNetProfitPercent,

    paperTradesExecuted:
      0,

    realTradesExecuted:
      0
  };
}


// ==========================================
// RESET MONITOR DATA
// ==========================================

export function resetMonitorData() {

  if (running) {
    throw new Error(
      "Stop monitor before resetting data."
    );
  }

  history.length = 0;
  opportunities.length = 0;

  totalScans = 0;
  successfulScans = 0;
  failedScans = 0;

  lastScan = null;
  startedAt = null;

  return {
    reset: true,
    mode: "DEMO"
  };
}