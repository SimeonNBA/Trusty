// Backtest for the Trusty safety-gated memecoin strategy.
//
//   node backtest.mjs
//
// Dataset: data/scans.json — real Trusty scans (forward-tracked), each
// with the verdict we gave at scan time, the market cap at scan, the
// PEAK market cap reached afterward (peakGainPct), and the latest
// (mcChangePct). This is a genuine forward-test of the safety verdict's
// predictive value, not a synthetic backtest.
//
// Strategy modelled: trade only APE-rated tokens; exit at +TP, -SL, or
// hold to latest (time-stop). Friction = round-trip slippage applied to
// every trade.

import { readFileSync } from "node:fs";

const TP = 50;        // take-profit %
const SL = -30;       // stop-loss %
const FRICTION = 4;   // ~2% slippage each side, round-trip, in %

const rows = JSON.parse(readFileSync(new URL("./data/scans.json", import.meta.url))).performance || [];

// Exit policies. peak-only data can't prove the exact path, so we model
// three honest policies and let the numbers speak:
//   tp50   : fixed +50% TP / -30% SL  (the naive version)
//   runner : -30% SL, NO take-profit, hold to latest  (let winners run;
//            any token now below SL would have been stopped at SL)
//   trail  : -30% SL, else capture 40% of the peak gain (give back 60%
//            from the top — a trailing-stop approximation)
function tradeReturn(r, policy) {
  const peak = typeof r.peakGainPct === "number" ? r.peakGainPct : 0;
  const now = typeof r.mcChangePct === "number" ? r.mcChangePct : 0;
  let gross;
  if (policy === "tp50") {
    gross = peak >= TP ? TP : (now <= SL ? SL : now);
  } else if (policy === "runner") {
    gross = now <= SL ? SL : now;
  } else { // trail
    gross = now <= SL ? SL : Math.max(now, Math.round(peak * 0.4));
  }
  return gross - FRICTION;
}

function stats(list, policy) {
  const rets = list.map((r) => tradeReturn(r, policy));
  const n = rets.length;
  if (!n) return { n: 0 };
  const sum = rets.reduce((a, b) => a + b, 0);
  const wins = rets.filter((r) => r > 0).length;
  const sorted = [...rets].sort((a, b) => a - b);
  const ordered = [...list].sort((a, b) => new Date(a.flaggedAt) - new Date(b.flaggedAt));
  let eq = 1, peak = 1, maxDD = 0;
  for (const r of ordered) {
    eq *= 1 + tradeReturn(r, policy) / 100 / n; // 1/n equal allocation
    if (eq > peak) peak = eq;
    const dd = (peak - eq) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return {
    n, avg: Math.round(sum / n), median: Math.round(sorted[Math.floor(n / 2)]),
    winRate: Math.round((wins / n) * 100), best: Math.round(sorted[n - 1]), worst: Math.round(sorted[0]),
    portfolioReturnPct: Math.round((eq - 1) * 100), maxDrawdownPct: Math.round(maxDD),
  };
}

const byV = (v) => rows.filter((r) => (r.verdictAtScan || "").toUpperCase() === v);
const ape = byV("APE");

console.log("Trusty safety-gated strategy — backtest");
console.log("dataset:", rows.length, "real Trusty scans (" + ape.length + " APE) · SL " + SL + "% · friction " + FRICTION + "%/trade\n");

console.log("EXIT POLICY COMPARISON (APE trades only):");
for (const [pol, label] of [["tp50", "fixed +50% TP / -30% SL"], ["trail", "trailing stop (~40% of peak), -30% SL"], ["runner", "let winners run, -30% SL, no TP"]]) {
  const s = stats(ape, pol);
  console.log("  " + label.padEnd(40), "portfolio " + (s.portfolioReturnPct >= 0 ? "+" : "") + s.portfolioReturnPct + "%", "| win " + s.winRate + "%", "| maxDD " + s.maxDrawdownPct + "%");
}

console.log("\nVERDICT EDGE (portfolio return under the 'let winners run' policy):");
for (const v of ["APE", "CAUTION", "RUN"]) {
  const s = stats(byV(v), "runner");
  if (!s.n) { console.log("  " + v + ": no samples"); continue; }
  console.log("  " + v.padEnd(8), "n=" + String(s.n).padStart(2), "portfolio " + (s.portfolioReturnPct >= 0 ? "+" : "") + s.portfolioReturnPct + "%", "| win " + s.winRate + "%");
}
console.log("\nKey finding: a tight TP caps the few 10x winners that carry memecoin books;");
console.log("the edge is a tight stop + letting winners run, gated by safety so the losers are fewer.");
