# Trusty AI — Next session roadmap

Captured at the end of the 2026-05-07/08 build session. These are
deliberate "save for later" items — not bugs, just deferred work.

## Website fixes (trustyai.tech / index.html)

### 1. Auto-scan from `?ca=` URL param

Currently the homepage opens fresh when reached via a URL like
`trustyai.tech/?ca=0x65aea108c21439693468FCD542D81C29E8df4444&chain=evm`.
Users coming from the extension (watchlist click, paid panel "open
full report" link, share-tweet link) expect the token to be already
scanned and the result visible.

Fix outline:
- On `DOMContentLoaded`, parse `URLSearchParams` for `ca` and `chain`
- If present, populate the scanner input
- Trigger the existing scan flow programmatically
- Scroll the scan result into view

### 2. Trending feed (24h window) by real activity

Replace or augment the current "Featured Tokens" carousel on the
homepage with a "Trending" section sourced from real engagement data
within the Trusty network:
- Number of scans (extension hover / click / popup paste)
- Number of watchlist adds
- Optional: weight by paid-tier user activity higher

Implementation sketch:
- Worker: new `POST /api/event` endpoint accepting
  `{type: "scan"|"watchlist_add", ca, chain, ts}` — anonymous, no PII.
  Stores rolling 24h counters keyed by CA (KV with hourly buckets).
- Worker: `GET /api/trending?window=24h` returns top 20 CAs with
  counts, fetches scan data for each on demand.
- Website: render a "🔥 Trending now" carousel/list, each row
  click-throughs to the scanner with `?ca=...` (which works after
  fix #1).

Privacy: counters are per-CA, never per-user. No user ID or wallet
linked to events. Honest aggregate signal of what the community is
looking at.

### 3. Watchlist page on trustyai.tech (`/watchlist/`)

The popup already links to `https://trustyai.tech/watchlist/` ("See all
on trustyai.tech →") but the page doesn't exist yet. Build a simple
page that:
- Reads the user's `subId` from a query param or extension postMessage
- Fetches `/api/watchlist?subId=…` and renders the full list
- Each row shows the live score (re-scan on load), name, symbol, age,
  watch-since timestamp, and an unwatch button
- Empty state with a CTA to install the extension

## Polish bin (small but worth doing eventually)

- **Tooltip header mascot.** Right now the tooltip header is just
  text. We could add a small mascot PNG to the top-left of the
  tooltip card (using the `web_accessible_resources` we already
  declared) — would tie the brand together visually.
- **Favicon swap on the website.** `index.html` and `privacy/index.html`
  use the inline-SVG emoji shield as the favicon. Once we have a
  `favicon.png` (32x32 or 48x48) in the repo, swap the `<link
  rel="icon">` tags to point at it.
- **Transparent mascot for the website hero.** User has a transparent
  PNG of the new mascot — replace the current SVG mascot in the
  homepage hero/sticky-side panel.
- **Sentiment heuristic tuning.** Current bullish/bearish word lists
  are reasonable but could be tuned with real-world false positives
  from the first weeks of usage.
- **Coord-shill heuristic tuning.** Currently a 4-tweets-in-60-seconds
  threshold; on high-volume queries like "bitcoin" it can trigger
  false positives. Worth tightening once we see real-world rates.
- **Worker debug endpoint.** Removed `?debug=1` for security but a
  signed/keyed admin variant would be useful for diagnosing future
  issues without redeploying.

## Operational

- **Watch the Sorsa quota.** 10K/month plan. Engagement-only ranking
  cut us to 1 call per scan, but we should add a small dashboard to
  see daily usage trend before we surprise-run out.
- **Set up payout addresses on NOWPayments** for the most-likely-paid
  coins (USDT-TRC20, USDT-BEP20, BNB, SOL) so accumulated balances
  can flow out without per-coin manual conversion.
- **Update Chrome Web Store listing's hero image and screenshots** to
  show the new v0.3.0+ features (KOL panel, Solana support, MC strip).
