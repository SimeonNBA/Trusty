# Trusty AI — Privacy Policy

_Last updated: 2026-05-09_

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

**That's it.** We do not send the page URL, tweet content, your X
account, your IP-derived identity, your wallet address, or any other
identifying data. The contract address you scan is public on-chain
information.

## What we do not collect

- We do not collect your X/Twitter account, posts, follows, DMs, or
  profile data.
- We do not read or transmit any text other than the contract address
  you scanned.
- We do not track which sites you visit or how long you spend on them.
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
