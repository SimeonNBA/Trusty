# Trusty — Safety-Gated Memecoin Strategy (CoinMarketCap Skill)

A CoinMarketCap Agent Hub Skill that turns CMC market data into a
backtestable BNB Chain memecoin trading strategy, with a contract-safety
gate that pure-data strategies don't have. Deliverable is a strategy spec
+ signals, not a live-trading agent (BNB Hack, Track 2).

## Inputs — CMC Agent Hub

- `daily_market_overview` / `detect_market_regime` → market regime,
  Fear & Greed, liquidity, BTC ETF flows, and a candidate watchlist.
- These set the **risk budget** (risk-on / defensive / flat) and the
  **max position size**, and surface candidate symbols.

## The strategy

1. **Regime gate (CMC).** Read the CMC regime + Fear & Greed. In a
   defensive/tightening regime, cut max position size and raise the entry
   bar; in flat, stand down. The regime is the throttle.
2. **Discovery.** Top BNB Chain memecoins by 24h volume, plus CMC
   watchlist candidates.
3. **Safety gate (Trusty's differentiator).** Drop any candidate failing
   honeypot / mint-authority / sell-tax / LP-lock / holder-concentration
   checks **before** any entry rule runs. Only an APE-grade verdict passes.
4. **Confirmation.** APE safety verdict **and** social traction
   (X / Binance Square).
5. **Sizing.** position = base × CMC-regime budget × safety score.
6. **Exit — the key lesson from the backtest.** Hard stop at **−30%**.
   **No fixed take-profit** — trail the stop and let winners run. A tight
   TP caps the few 10x winners that carry a memecoin book; the edge is a
   tight stop plus an uncapped, trailing upside, gated by safety so there
   are fewer losers to begin with.

Default params: stop −30%, trailing exit (give back ≈60% from the peak),
friction 2% per side. All rules are deterministic and historical-data
driven, so the strategy backtests cleanly.

## Output

Per-candidate signals: entry decision, stop, trailing rule, and size —
a strategy spec an agent (or a human) can execute, and that backtests
deterministically.

## Backtest (real Trusty data)

See `backtest.mjs` + `data/scans.json` (53 real Trusty scans, forward-
tracked: verdict at scan, MC at scan, peak MC reached, latest MC).

- **Trailing-stop policy: ≈ +29% equal-weight, 7% max drawdown, 26% win rate.**
- Verdict edge: **APE +20% vs CAUTION −18% vs RUN −10%** — the safety
  gate steered away from the losers.
- Naive fixed +50% TP returns −11% — included to show why a tight TP is
  wrong for this asset class.

**Honest caveats:** small sample (~1 week, 43 APE trades); many candidates
are micro-caps where real slippage exceeds the 4% modelled (so % returns
assume small size); peak-only data means the trailing exit is an
approximation, not a tick-level fill. This is a forward-test of the
verdict's edge, not a long historical backtest.

## Run

```
node backtest.mjs
```
