# Chrome Web Store Listing Copy — Trusty AI

Paste-ready copy for the Chrome Web Store submission. All fields below
match the structure of the Chrome Web Store dashboard. Word counts are
within the limits Google enforces.

---

## Extension name (45 characters max)

```
Trusty AI — Token Safety Scanner
```

*(33 characters)*

---

## Short description (132 characters max)

```
AI-powered safety verdict for any contract address you see on X. Don't ape blind — across all chains.
```

*(98 characters)*

---

## Detailed description (16,000 characters max — keep ~600–800 words)

```
🛡️ Trusty AI is the safety layer for crypto traders.

Every time you see a contract address on Crypto Twitter, Trusty shows you a one-click safety verdict before you ape — APE, CAUTION, or RUN — sourced from the AI scanner at trustyai.tech.

No more tab-hopping between five different safety scanners. No more aping into a 99% sell-tax honeypot you could've caught in 5 seconds. The verdict comes to you, in the feed, in plain English, before you click buy.

✦ HOW IT WORKS

→ Scrolling X or Binance Square and you spot a contract address? A small Trusty pill appears right next to it.
→ Hover the pill and you see a quick verdict + plain-English safety checks: honeypot, sell tax, LP lock, mint authority, contract renounced.
→ Click the pill and you get the full report — either inline (paid) or on trustyai.tech (free).

✦ SUPPORTED SITES

• x.com / twitter.com — pills on every CA in tweets, replies, quoted posts
• www.binance.com/square — pills on every CA in Binance Square posts; paid users see Square sentiment alongside X velocity

✦ FREE TIER (NO ACCOUNT, NO LIMITS BEYOND DAILY)

• Trusty pill on every detected contract address across supported sites
• Hover tooltip with the safety verdict and 5 key checks
• Up to 20 scans per day, then a generous cap
• Click to open the full report on trustyai.tech

✦ PAID TIER ($5/month or $50/year)

Subscribe with crypto in the extension popup to unlock:

• Unlimited scans, no daily limit
• Inline paid panel — full safety breakdown without leaving the page
• KOL activity — see which top crypto accounts are talking about a token in the last 24h
• X velocity — tweets per 24h, sentiment, coordinated-shilling detection
• Market data inline — market cap, liquidity, age, holders
• Save tokens to a personal Watchlist

To unlock: open the extension popup → choose Monthly ($5) or Yearly ($50) → pay with crypto via NOWPayments hosted checkout (200+ coins supported). No account, no signup. The paid tier activates as soon as the payment confirms on-chain.

✦ PRIVACY

We do not read your tweets, your DMs, or any X content. On Binance Square pages, we read the text of posts that contain a contract address so we can classify the post's sentiment — the raw text is sent to our backend for classification and is not persisted long-term, only the resulting sentiment label is kept. We do not collect your X account, your Binance account, your IP address, your wallet's seed phrase or signatures. We do not use cookies, analytics, or third-party trackers. The contract address you scan is public on-chain information.

Full privacy policy: trustyai.tech/privacy

✦ LINKS

• Web app: trustyai.tech
• X: @Trusty_BSC
• Telegram: t.me/TRUSTYCTO

✦ DISCLAIMER

Trusty AI provides informational risk indicators only. It is not financial advice. Always do your own research before committing capital.
```

---

## Category

```
Productivity
```

(Alternatives: "Tools" — also acceptable. Avoid "Communication" / "Social".)

---

## Language

```
English
```

---

## Single-line publisher description (the line under "By Trusty AI")

```
The community-built safety layer for crypto degens.
```

---

## Privacy policy URL

```
https://trustyai.tech/privacy/
```

(Live as of v0.3.0 — replaces the temporary Gist URL we used for v0.1.0.)

---

## Permissions justification (asked in the dashboard)

```
storage:
  Required to remember the user's subscription status, persistent
  identifier, local watchlist, and recent scan cache. All data stays
  in chrome.storage.local on the user's device — only the persistent
  identifier and watchlist are sent to our server (for cloud sync of
  the watchlist and to map the subscription invoice to the user).

host_permissions (trustyai.tech, api.trustyai.tech):
  trustyai.tech is the website the extension links to. api.trustyai.tech
  is our scanning API endpoint, where the extension fetches safety
  verdicts (CA + chain only — no PII, no page content) and creates
  the NOWPayments invoice for the optional paid tier.

content_scripts (x.com, twitter.com):
  Required to detect contract addresses on the pages where users
  encounter them. The script reads page text only to find contract
  addresses; it does not read or transmit any tweet text.

content_scripts (www.binance.com/*/square*):
  Required to detect contract addresses in Binance Square posts and
  (for paid users) to classify the sentiment of posts that contain a
  CA. The script reads the visible post text and sends it to our
  backend for sentiment classification. Only the resulting sentiment
  category (bullish / bearish / neutral) is persisted, not the raw
  text. Users opt into this paid feature by subscribing — free users
  still benefit from the pill injection without any paid-tier data
  flow.
```

---

## Single-purpose statement

```
Trusty AI's single purpose is to display a safety verdict for any
cryptocurrency contract address detected on supported web pages,
helping users avoid risky tokens before transacting.
```

---

## What's new — v0.5.1

(Paste into the "What's new in this version?" field on the v0.5.1
submission.)

```
v0.5.1 — Binance Square support, info icons, detailed safety breakdown.

• Pill injection now works on Binance Square in addition to X / Twitter.
  Every contract address you see in a Square post gets a Trusty safety
  pill with the same hover-for-verdict, click-for-full-report flow.
• Detailed safety breakdown: every pill now shows a 6-category
  sub-score view (Chain Reputation, Narrative, Ownership, Age/Timing,
  Social Presence, Supply Safety) so users see WHY a token scored
  what it did, not just the composite number.
• Info icons (ⓘ) on every safety check — click any check to see a
  plain-English explanation of what it means.
• Binance Square sentiment for paid users: mentions per 24h, sentiment
  classification, coordinated-shilling detection — same shape as the
  existing X velocity panel.
• Privacy posture: on Binance Square pages we now read post text for
  paid sentiment classification (disclosed in the privacy policy).
  X / Twitter behavior is unchanged — we still never read tweet text.
```

---

## What's new — v0.4.0

(Paste into the "What's new in this version?" field on the v0.4.0
submission. Update the version string in `manifest.json` to match.)

```
v0.4.0 — Subscription tier, multi-chain trade button, four.meme aware.

• Subscribe with crypto: $5/month or $50/year via NOWPayments. Pay
  with BTC, ETH, USDT, BNB, SOL or 200+ other coins. No account
  needed. Inline redemption code system — one click to activate
  paid on a backup device.
• Wallet-paste tier removed. Cleaner privacy story: we no longer
  read your $TRUSTY balance from BSC RPC, no wallet-address
  collection at all.
• Multi-chain Trade button: every paid panel now has a one-click
  "Trade with Trust Wallet → DEX" button. Mobile opens the Trust
  Wallet app via universal link; desktop auto-connects to the Trust
  Wallet Chrome extension and routes to PancakeSwap (BSC), Uniswap
  (ETH/Polygon/Base), or Jupiter (Solana).
• Four.meme launchpad badge: when you scan a token deployed via
  four.meme's bonding curve, the panel surfaces a "🚀 Launched on
  four.meme" link to the token's native page.
• Better Ethereum / Base / Polygon support: chain auto-detection
  fixed — ETH-native tokens used to score 0/100 RUN incorrectly
  because the worker assumed BSC.
• Dead-token-aware scoring: a token with $2 of 24h volume no longer
  scores APE just because its safety checks pass. Volume,
  liquidity, holder count, and pair age all factor into the verdict.
• Free-tier paid panel cleaned up: real safety + market data shown,
  KOL handles + X activity rendered as locked rows (no fake
  placeholder data, no clickable links to dead URLs). Single inline
  upsell card directs users to the toolbar to subscribe.
• Token logos loaded from trustwallet/assets CDN.
• Watchlist sync between extension and trustyai.tech improved.
• Reddit + Dexscreener pill injection removed — extension is X-only
  for v1 launch.
```

---

## Paid declaration (for Chrome Web Store dashboard)

When submitting v0.4.0, the dashboard will ask whether the extension
includes paid features. Toggle that **on** and paste this into the
description field:

```
Trusty AI offers an optional paid subscription that unlocks
additional features (KOL mentions, X activity, sentiment analysis,
unlimited watchlist). Pricing: $5/month or $50/year. Payment is
processed by NOWPayments — a third-party crypto payment processor.
The user pays with cryptocurrency of their choice (BTC, ETH, USDT,
BNB, SOL, or 200+ others). Payments are voluntary; the extension is
fully usable without subscribing.

We never collect or store credit card numbers, bank details, or
similar payment instruments. The extension generates a NOWPayments
invoice URL and opens it in the user's browser for them to complete
the transaction on NOWPayments' hosted checkout. We only learn
whether the payment succeeded (via NOWPayments IPN webhook), not how
the user paid.

Privacy policy: https://trustyai.tech/privacy/
Support: https://x.com/Trusty_BSC
```

---

## What's new — v0.3.0

(Previous release notes — kept for archive.)

```
v0.3.0 — Bigger, faster, and now on Solana.

• Live backend: replaced the bootstrapped scan stub with a real API
  at api.trustyai.tech, returning real on-chain safety signals from
  GoPlus, market data from Dexscreener, and (on Solana) LP-locked
  detection from RugCheck.
• Solana support: full safety scoring on Solana tokens — LP locked,
  mint authority, freeze/close authorities, transfer fees, top-wallet
  concentration, dev-wallet share. Pump.fun graduates included.
• Free-tier tooltip now shows live market cap and 24h volume above
  the safety checks — quick "is this token alive?" gut-check without
  leaving the feed.
• Paid panel: real KOL mentions powered by Sorsa — top 5 wallets
  talking about a token in the last 24h, ranked by follower count,
  each row click-throughs to the actual tweet on X.
• Honest sentiment: bullish/bearish percentage from tweet text,
  coordinated-shilling detection.
• Click-to-reveal on the paid panel keeps your scans fast and the
  KOL data fresh.
• Updated privacy policy now lives at trustyai.tech/privacy.
```
