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
AI-powered safety verdict for any contract address you see on X, Reddit, or DexScreener. Don't ape blind — across all chains.
```

*(126 characters)*

---

## Detailed description (16,000 characters max — keep ~600–800 words)

```
🛡️ Trusty AI is the safety layer for crypto traders.

Every time you see a contract address on Crypto Twitter, Reddit, or DexScreener, Trusty shows you a one-click safety verdict before you ape — APE, CAUTION, or RUN — sourced from the AI scanner at trustyai.tech.

No more tab-hopping between DexScreener, GoPlus, and Honeypot.is. No more aping into a 99% sell-tax honeypot you could've caught in 5 seconds. The verdict comes to you, in the feed, in plain English, before you click buy.

✦ HOW IT WORKS

→ Scrolling X or Reddit and you spot a contract address? A small Trusty pill appears right next to it.
→ Hover the pill and you see a quick verdict + 5 plain-English safety checks: honeypot, sell tax, LP lock, mint authority, contract renounced.
→ Click the pill and you get the full report — either inline (paid) or on trustyai.tech (free).

✦ SUPPORTED SITES (TODAY)

• x.com / twitter.com — pills on every CA in tweets, replies, quoted posts
• reddit.com — old, new, and sh.reddit — pills on post bodies and comments
• dexscreener.com — pills next to every token name in trending lists, watchlists, search results, and on token pages

More platforms coming: Telegram Web, Discord, Farcaster.

✦ SUPPORTED CHAINS

BNB Smart Chain · Ethereum · Base · Solana · Polygon · Arbitrum · Avalanche · and more.

✦ FREE TIER (NO ACCOUNT, NO LIMITS BEYOND DAILY)

• Trusty pill on every detected contract address across supported sites
• Hover tooltip with the safety verdict and 5 key checks
• Up to 20 scans per day, then a generous cap
• Click to open the full report on trustyai.tech

✦ PAID TIER (UNLOCKED BY HOLDING $TRUSTY)

Hold ≥ 325,000 $TRUSTY (≈ $50 worth) in your BSC wallet to unlock:

• Unlimited scans, no daily limit
• Inline paid panel — full safety breakdown without leaving the page
• KOL activity — see which top crypto accounts are talking about a token in the last 24h
• X velocity — tweets per 24h, sentiment, coordinated-shilling detection
• Market data inline — market cap, liquidity, age, holders
• Save tokens to a personal Watchlist

To unlock: paste your wallet address into the extension popup → click Verify. We check your $TRUSTY balance via public BNB Smart Chain RPC nodes (no API key required, no transactions, no signatures, read-only). If the balance is enough, the paid tier activates for 30 days. Re-verify any time. Sell your $TRUSTY and the tier reverts to free at the next check.

✦ PRIVACY

We do not read your tweets, your DMs, your Reddit posts, your comments, or any text on a page other than the contract addresses themselves. We do not collect your X/Reddit account, your IP address, your wallet's seed phrase or signatures. We do not use cookies, analytics, or third-party trackers. The contract address you scan is public on-chain information — that's all we ever send anywhere.

Full privacy policy: trustyai.tech/privacy

✦ ABOUT $TRUSTY

$TRUSTY is a community-takeover project around the blue shield mascot that appeared in Trust Wallet's 2019 marketing — Telegram stickers, blog posts, product announcements. In 2025 the community relaunched it on BNB Smart Chain as a fair launch (no team allocation, no VCs, no presale, 100% LP burned). The community then built trustyai.tech and this extension as the safety layer the chain actually needs.

$TRUSTY is a community project. Not affiliated with or endorsed by Trust Wallet.

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
https://trustyai.tech/privacy
```

(Make sure this resolves before submission — the extension PRIVACY.md
content is the source. Either host it as `/privacy` on trustyai.tech
or add a section to the Academy that the link points to.)

---

## Permissions justification (asked in the dashboard)

```
storage:
  Required to remember the user's verified wallet address, tier
  expiry, and local scan cache. All data stays in chrome.storage.local
  on the user's device — nothing is uploaded to our servers.

host_permissions (trustyai.tech, bsc-dataseed.binance.org, bsc-dataseed1.defibit.io, bsc.publicnode.com, bsc-dataseed1.ninicoin.io):
  trustyai.tech is the extension's API for retrieving safety scan
  data. The four BSC RPC endpoints are used in read-only mode to
  verify a user's $TRUSTY balance for the paid tier. Multiple
  endpoints are listed for fallback redundancy. No write
  transactions, no signatures, no private keys.

content_scripts (x.com, twitter.com, reddit.com, dexscreener.com):
  Required to detect contract addresses on the pages where users
  encounter them. The script reads page text only to find contract
  addresses; it does not read or transmit any other text content.
```

---

## Single-purpose statement

```
Trusty AI's single purpose is to display a safety verdict for any
cryptocurrency contract address detected on supported web pages,
helping users avoid risky tokens before transacting.
```
