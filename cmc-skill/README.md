# Trusty — Safety-Gated Memecoin Strategy (CMC Skill)

BNB Hack 2026, Track 2 (Strategy Skills). A CoinMarketCap Agent Hub
Skill that turns CMC market data into a backtestable BNB Chain memecoin
strategy — with a contract-safety gate that pure-data strategies lack.

- **Strategy spec:** [`SKILL.md`](./SKILL.md)
- **Backtest harness:** [`backtest.mjs`](./backtest.mjs)
- **Dataset:** [`data/scans.json`](./data/scans.json) — 53 real Trusty
  scans, forward-tracked (verdict at scan, MC at scan, peak MC, latest MC).

## What makes it different

CMC supplies the market timing (regime, Fear & Greed, ETF flows). Trusty
adds the contract-safety gate (honeypot, mint, tax, LP, holders) that
decides what is survivable to trade. Timing from CMC, survival from Trusty.

## Results (backtest)

On 53 real Trusty scans (~1 week, 43 APE trades), `node backtest.mjs`:

| Exit policy | Portfolio | Win rate | Max DD |
|---|---|---|---|
| Fixed +50% TP (naive) | −11% | 16% | 13% |
| Trailing stop (~40% of peak) | **+29%** | 26% | **7%** |
| Let winners run, no TP | +20% | 14% | 12% |

Verdict edge (let-winners-run): **APE +20% · CAUTION −18% · RUN −10%** —
the safety gate steered away from the losers.

Key finding: a tight take-profit destroys memecoin returns by capping the
few 10x winners that carry the book; the edge is a tight stop + trailing
exit, gated by safety.

Caveats: small sample, micro-cap slippage exceeds the modelled 4%, and the
trailing exit is approximated from peak-only data. This is a forward-test
of the verdict's edge, not a long historical backtest.

## Run

```
node backtest.mjs
```

Live CMC integration powering this: the Trusty market pulse at
https://trustyai.tech/market (CMC `daily_market_overview` via the Agent
Hub) and the safety engine behind the strategy at https://trustyai.tech.
