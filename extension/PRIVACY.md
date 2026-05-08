# Trusty AI — Privacy Policy

_Last updated: 2026-05-03_

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
- Your tier preferences (paid wallet address, expiry timestamp), in
  Chrome's local extension storage (`chrome.storage.local`)

**Sent to trustyai.tech servers:**

- The contract address you scanned (e.g. `0xabc…123`)
- A best-guess chain identifier (`bsc`, `ethereum`, `solana`, etc.)
- Standard HTTP headers your browser automatically sends to any website

**Sent to public BNB Smart Chain RPC nodes (when verifying a paid wallet):**

- Your BSC wallet address, embedded in a standard ERC-20 `balanceOf`
  call, sent to a public RPC endpoint (Binance, defibit, publicnode,
  ninicoin)

**That's it.** We do not send the page URL, tweet content, your X
account, your IP-derived identity, or any other identifying data. The
contract address you scan is public on-chain information.

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

## Paid tier and wallet addresses

If you choose to unlock the paid tier by linking a $TRUSTY wallet
address, that address is stored in `chrome.storage.local` on your
device. We make periodic read-only calls (every 30 days, or whenever
you click "Re-verify") to a public BNB Smart Chain RPC endpoint to
check whether the address still holds the required $TRUSTY balance.

- We never request signatures, transactions, approvals, seed phrases,
  or private keys from your wallet.
- We never broadcast anything on your behalf.
- The wallet address is not sent to our servers — only to public BSC
  RPC nodes, which already see this kind of public on-chain query.
- The address is removed from local storage when you click "Re-verify"
  and replace it, or when you uninstall the extension.

## Permissions explained

- `storage` — to remember your tier and recent scans on your device.
- `host_permissions: https://trustyai.tech/*` — to call the Trusty
  scanning API.
- `host_permissions: https://bsc-dataseed.binance.org/*`,
  `https://bsc-dataseed1.defibit.io/*`, `https://bsc.publicnode.com/*`,
  `https://bsc-dataseed1.ninicoin.io/*` — to verify your $TRUSTY
  balance via public RPC nodes.
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
