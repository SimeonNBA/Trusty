# Trusty AI — Privacy Policy

_Last updated: 2026-05-16_

The Trusty AI Chrome extension is a browser-based tool that helps users
identify risky contract addresses on the websites they already visit.
This document explains exactly what the extension does and does not
collect.

## What the extension does

When you visit a supported page, the extension scans the page text in
your browser to detect cryptocurrency contract addresses (e.g. EVM
`0x…` and Solana base58 mints). For every detected address, the
extension fetches a safety verdict from **trustyai.tech**. When you
hover the Trusty pill, you see a short summary; when you click it,
you either get an inline panel (paid users) or are taken to
trustyai.tech for the full report (free users).

Supported sites today:

- `x.com` and `twitter.com`
- `www.binance.com/*/square` (Binance Square)

## What we collect

**On-device only (never leaves your browser):**

- The text content of pages you visit (used purely to detect contract
  addresses; nothing is stored or transmitted)
- A local in-memory cache of recent scan results
- A persistent random identifier and your subscription status, in
  Chrome's local extension storage (`chrome.storage.local`)
- Your local watchlist (saved contract addresses)

**Sent to trustyai.tech servers:**

- The contract address you scanned (e.g. `0xabc…123`)
- A best-guess chain identifier (`bsc`, `ethereum`, `solana`, etc.)
- The persistent random identifier described above (used to associate
  the optional paid subscription with your install and to sync your
  watchlist across the extension and trustyai.tech)
- Standard HTTP headers your browser automatically sends to any website
- **On Binance Square pages only:** when a Square post scrolls into
  view and contains either (a) a contract address, (b) a cashtag
  ($SYMBOL), or (c) a hashtag (#symbol) that matches a token someone
  has previously scanned, the post's visible text and engagement
  counts are sent to our server for sentiment classification.
  The text is used to classify the post as bullish / bearish / neutral
  and to detect coordinated shilling; only the resulting sentiment
  category is persisted long-term, not the raw text. Cashtags and
  hashtags that don't match any known token are ignored — we don't
  store anything for posts that aren't about a token we recognise.
- **Binance Square hashtag fetch (proxied through your browser):**
  when a paid user opens the scan panel for a token, the extension's
  background service worker fetches the public Binance Square
  hashtag page for that token symbol (the same page anyone can
  view at `https://www.binance.com/en/square/hashtag/{symbol}`).
  The fetch is sent with `credentials: omit` — it does NOT send
  your Binance session cookies, so the request is identical to an
  anonymous visitor's. We parse the returned HTML for public post
  IDs and Binance's own bullish/bearish label counts. No post body
  text is read, stored, or transmitted from this fetch. Per-post
  IDs are forwarded to our server purely as integer references for
  cross-user aggregation. Cached 10 minutes per symbol locally to
  avoid duplicate requests when the same panel reopens.

**For X (Twitter):** we still never read tweet text. X sentiment is
sourced from a separate third-party API (Sorsa) on our backend, not
from anything the extension reads in your browser.

## What we do not collect

- We do not collect your X/Twitter account, posts, follows, DMs, or
  profile data.
- We do not read or transmit X tweet content (X sentiment uses
  third-party data, not browser content).
- We do not read text from any page other than supported sites
  (x.com, twitter.com, www.binance.com/square).
- We do not track which sites you visit beyond the supported sites or
  how long you spend on them.
- We do not use cookies, fingerprinting, or third-party analytics
  services from inside the extension.
- We do not sell, share, or rent any data to anyone.

## Server-side caching

Our backend caches scan results for ~5 minutes per contract address to
reduce load on the data sources we use (DexScreener, GoPlus,
Honeypot.is, and others). This cache is keyed only by the contract
address — it contains no information about who requested the scan.

## Paid tier and payments

If you choose to unlock the paid tier, the extension creates a
NOWPayments invoice via our backend and opens NOWPayments' hosted
checkout page in a new tab. NOWPayments is a third-party payment
processor; their privacy policy applies to anything you do on their
checkout page (we never see the payment details). Our backend stores
only the persistent random identifier described above, the plan you
chose (monthly or yearly), and the resulting subscription expiry — it
does not store wallet addresses, transaction hashes, or any other
identifying information.

- We never request signatures, transactions, approvals, seed phrases,
  or private keys from any wallet.
- We never broadcast anything on your behalf.
- The persistent random identifier can be reset at any time by
  reinstalling the extension; this generates a new identifier and
  removes the link between your install and the previous subscription.

## Permissions explained

- `storage` — to remember your subscription status, persistent
  identifier, watchlist, and recent scans on your device.
- `host_permissions: https://trustyai.tech/*`,
  `https://api.trustyai.tech/*` — to call the Trusty scanning API
  and the subscription endpoint.
- `content_scripts: x.com, twitter.com` —
  to detect contract addresses on the pages you visit.
- `content_scripts: www.binance.com/*/square*` — to detect contract
  addresses in Binance Square posts and (for paid features) to read
  post text for sentiment classification.

The extension does not have access to the rest of the web. It cannot
read your other tabs, your bookmarks, your downloads, or any site that
isn't listed above.

## Children

Trusty is not directed at children under 13 and we do not knowingly
collect data from minors.

## Changes

This policy may be updated as new platforms are added (Telegram,
Discord, Farcaster, etc.) or new features ship. Material changes are
announced via the project's X account and the "Last updated" date at
the top of this document is bumped.

## Contact

Questions about this policy can be sent via X
([@Trusty_BSC](https://x.com/Trusty_BSC)) or Telegram
([t.me/TRUSTYCTO](https://t.me/TRUSTYCTO)).

---

$TRUSTY is a community project. Not affiliated with or endorsed by
Trust Wallet. Trusty AI provides informational risk indicators and is
not financial advice. Always do your own research.
