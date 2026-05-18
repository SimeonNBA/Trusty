# Trusty AI — handoff for the next chat

Short version: **the previous bounded plan is done.** Read this once,
then read `NEXT.md` for what's actually pending. Don't re-suggest
work that's already shipped — `git log` is the source of truth.

## How to start a new chat

Paste this:

```
Read D:/Trusty-AI/frontend/HANDOFF.md and NEXT.md.

Sanity check first: visit trustyai.tech, hover/click a pill on X,
verify nothing's broken. Then ask me which pending item from NEXT.md
to ship next.

Don't deploy the worker (I deploy in the morning).
Don't make strategic decisions — defer to me.
Commit + push each change independently with clear messages.
If a regex won't match or a file's been modified, re-read the file
first; don't compound errors.
```

That's it. The current Claude will pick up where we left off without
re-suggesting completed work.

## Live production state (as of 2026-05-16)

| Surface | Status |
|---|---|
| `api.trustyai.tech` | Deployed from `main` with all v0.5.1 worker code. 13 endpoints: scan, kols, subscribe, nowpayments-webhook, subscription, watchlist, event, trending, redeem-code, admin/mint-code, admin/stats, admin/warm-goplus, **square-mention** (new). /api/scan now emits `subScores` field. /api/kols now includes `squareActivity` field. |
| `trustyai.tech/` | Homepage with BNB-niche hero, Free/Paid value cards, auto-scan from `?ca=`, Hot Tokens trending with chain dropdown, Install CTA |
| `trustyai.tech/privacy/` | Updated 2026-05-16 — discloses Binance Square text reading for sentiment classification |
| `trustyai.tech/watchlist/` | Live |
| `trustyai.tech/admin/` | Live |
| **Extension v0.5.0** | LIVE on Chrome Web Store — public. Mock-fallback hide + trending tab + chain dropdown. |
| **Extension v0.5.1** | ⚠️ Zip BUILT at `D:/Trusty-AI/frontend/trusty-ai-v0.5.1.zip` — **NOT YET SUBMITTED** to Chrome Web Store. User wants to add Trust Wallet API integration (market data + swaps) before submitting. |

## v0.5.1 pending features before submission (USER DIRECTION)

User wants to integrate Trust Wallet Agent SDK before submitting v0.5.1:
- **`get_swap_quote` / `get_swap_route_step`** — enrich the "Trade in Trust Wallet" CTA in paid panel with expected swap rate + route
- **`get_token_prices` / `get_asset_details`** — market data (could supplement Dexscreener for redundancy)
- (Optional, separate effort) **`check_token_security`** — backup to GoPlus when it fails

Source: https://developer.trustwallet.com/developer/agent-sdk
API gateway docs: https://developer.trustwallet.com/developer/mcp/api-gateway.md
Auth model: HMAC-SHA256, API keys at portal.trustwallet.com (user needs to register)
Brand-association sensitivity: **v0.4.0 listing was rejected for keyword stuffing including Trust Wallet brand mentions. Be CAREFUL not to re-introduce brand association in user-facing copy when integrating their API.**

## v0.5.1 features already done (in the zip, in `v0.5.1` branch)

- Tooltips (ⓘ click-to-expand on every safety check)
- 6-category sub-score bars (Chain Reputation, Narrative, Ownership, Age/Timing, Social Presence, Supply Safety)
- Binance Square pill injection (`www.binance.com/*/square*` content script)
- Binance Square sentiment classification (paid feature, surfaces in paid panel)
- Manifest 0.4.0 → 0.5.1, privacy policy + listing copy updated to disclose Square text reading

## Backend data sources

- **GoPlus** (free, no key) — EVM token security
- **GoPlus Solana** (free, no key) — Solana token security
- **RugCheck.xyz** (free, no key) — Solana LP-locked (catches Pump.fun graduates GoPlus misses)
- **Dexscreener** (free, no key) — market data, EVM + Solana
- **Sorsa** (paid $49/mo, 10K req/mo) — KOL mentions + X activity
- **NOWPayments** (0.5% fee/txn) — crypto subscriptions ($5/mo, $50/yr)

## Cloudflare secrets set

- `SORSA_API_KEY`
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- `ADMIN_SECRET` (for `/api/admin/mint-code` — set this once before
  using the `scripts/mint-code.mjs` CLI)
- `BSCSCAN_API_KEY` (optional — increases the four.meme detection
  rate limit. Free without a key for low volume.)

KV namespace: `SCAN_KV` (id in `api/wrangler.toml`).

## Don't ship without explicit user input

- ❌ Worker deploys (user does in the morning).
- ❌ Anything touching NOWPayments or money flow without confirmation.
- ❌ Chinese strings without native speaker review.
- ❌ Real partner logos / outreach (user-relationship moves).
- ❌ Web Store v0.4.0 re-submission (admin in their dashboard).
- ❌ Strategic copy that requires the user's voice.

## File map

| File | Role |
|---|---|
| `api/src/index.js` | Cloudflare Worker, all endpoints |
| `api/wrangler.toml` | Worker config + KV binding |
| `extension/manifest.json` | Extension config (currently v0.3.0) |
| `extension/lib/pill-injector.js` | Pill rendering + paid panel + blurred-mode + watchlist stars |
| `extension/lib/api.js` | API client + in-memory caches + scanKols + reportEvent |
| `extension/lib/tier.js` | Wallet + subscription tier resolution + watchlist helpers |
| `extension/popup/{popup.html,popup.css,popup.js}` | Toolbar popup |
| `extension/content/x-content.js` | X-specific DOM hooks |
| `extension/content/trustyai-bridge.js` | subId bridge (only on trustyai.tech) |
| `extension/content/shared.css` | Pill + tooltip + paid-panel + blurred styles |
| `index.html` | Homepage (one big file) |
| `privacy/index.html` | Privacy policy page |
| `watchlist/index.html` | Public watchlist viewer |
| `NEXT.md` | **Pending work — start here for what to ship** |
| `HANDOFF.md` | This file |

## Recent commits (latest first)

```
d2660da  Item 3c: remove redundant Contract Safety panel call
8ae5b21  Item 3a + 3b: drop DEGEN PLAY + smooth score animation
97e29be  Item 1: Blurred paid-panel modal for free users
185e29f  Item 4: Free vs Paid value cards on homepage
93ef743  Item 2: Hover tease line on free pill
ba4b6a9  Item 5: BNB-niche hero headline + SEO meta
50c279a  Remove Reddit pill injection (X-only at launch)
e667066  Remove Dexscreener pill injection
…
```

For the full history, run `git -C D:/Trusty-AI/frontend log --oneline | head -30`.
