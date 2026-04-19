# Trusty AI

**The AI safety net for BNB Chain meme coins.** Scan any token in 5 seconds, see the rug risk, and learn what to look for before you ape.

**Live:** [trustyai.tech](https://trustyai.tech)
**Submission:** Four.meme AI Sprint on DoraHacks — April 2026

---

## The Problem

Every day, thousands of people enter crypto for the first time through meme coins. They see a ticker on TikTok, get a CA dropped in a Telegram group, and ape in within minutes — with no idea what they're buying.

The result is predictable. Honeypot contracts they can't sell. Mint authority still active so the dev prints infinite tokens. 15% sell taxes that bleed them on every exit. Whale wallets holding 60% of supply, ready to dump.

This isn't a knowledge problem. The data exists — DexScreener, GoPlus, Honeypot.is. The problem is that no normie knows where to look, what any of it means, or how to connect it to a decision.

Four.meme sits at the centre of this problem — 812,000 daily users, $1B+ trading volume, mostly first-timers with no framework for evaluating what they're about to buy.

---

## The Solution

Trusty is an AI-powered meme coin evaluator on BNB Smart Chain. Paste a contract address, and in under 10 seconds Trusty pulls live market data from DexScreener and a full contract safety scan from GoPlus + Honeypot.is — then translates all of it into one plain-English verdict: **Ape**, **Caution**, or **Run**. Every number is explained in degen language, not audit jargon.

### Core Features

- **Token Scanner** — Live market data (price, mcap, liquidity, volume, buy/sell ratio, age, holders) + full contract safety scan (honeypot, mint authority, LP lock, sell tax, whale concentration) + AI "Trusty Says" verdict in plain English
- **Gut Check** — Five honest questions (bull or bear market, flip or hold, real $100M path, can you sleep holding this tonight) that dynamically adjust the final recommendation and position size. The mirror most tools skip.
- **Academy** — Cheat Sheet (Ape vs Run signals, Risk Matrix, Narrative Playbooks), Degen Glossary, Alpha Threads, History (Trust Wallet / BNB Chain / Crypto)
- **Watchlist** — Save tokens, re-scan anytime. localStorage only, no account required.
- **Weekly Trenches Report** — Weekly recap of what pumped, what rugged, and what the meta is this week on BNB Chain
- **PDF Report + Share** — One-click PDF download and share-to-X so users can pass the scan along

---

## Why It Fits This Hackathon

Four.meme's mission is democratising meme coin creation. Trusty's mission is democratising meme coin evaluation. Same problem, two sides.

Someone mints a token on Four.meme in 30 seconds. Someone else should be able to evaluate that same token in 10 seconds. Right now, that second half doesn't exist for the average person — Trusty closes that gap.

And there's one more thing: **$TRUSTY is the OG Trust Wallet mascot from 2019** — the little blue shield from Telegram stickers and blog posts. Relaunched in 2025 as a community takeover, no VCs, no presale. The face of the platform is already trusted by the exact audience Four.meme wants to keep.

---

## Tech Stack

- **Frontend:** Single-page HTML/CSS/JS app, no build step, hosted on GitHub Pages
- **Backend:** Minimal Node.js + Express on Railway ([trusty-backend](https://github.com/SimeonNBA/trusty-backend))
- **Chain:** BNB Smart Chain
- **APIs:** DexScreener (market data), GoPlus Security (contract risk), Honeypot.is (honeypot detection)
- **AI:** "Trusty Says" verdict generator — context-aware scoring across 7 weighted categories
- **Content pipeline:** `data/articles.json` + `data/featured.json` + `data/trending.json` (trending refreshed via GitHub Actions every 15 min)

## Architecture

```
User → trustyai.tech (GitHub Pages)
         ├── Token Scan → DexScreener + GoPlus + Honeypot.is
         ├── Gut Check → Client-side logic, adjusts verdict + position size
         ├── Academy → Static content (cheat sheet, narratives, history)
         ├── Watchlist → localStorage (no account)
         └── Trenches Report → data/articles.json + GitHub Pages
```

No wallet connection. No trading. No custody risk. Trusty is an **evaluation layer**, not an execution layer — by design.

## Setup

No build step required. Clone and open `index.html` locally, or deploy to any static host.

```bash
git clone https://github.com/SimeonNBA/Trusty.git
cd Trusty
# Open index.html in browser or deploy to GitHub Pages
```

---

## Roadmap

**Phase 2 — Profiles & reputation.** Sign-in, personal scan history, on-chain reputation badges for users who consistently flag rugs early.

**Phase 3 — CA-Hunt tournaments.** Weekly scouting competitions where degens submit tokens, the community verdicts them, and the best scouts (fastest to flag a rug, first to find a 10x) win $TRUSTY and partner prizes.

**Phase 4 — Learn-and-Earn partnerships.** BNB Chain projects pay Trusty to run quizzes, academy modules, and guided scans for their token. Users earn, projects onboard educated holders, Trusty earns recurring revenue.

**Phase 5 — Telegram bot + API.** Let other BNB dApps embed Trusty scans directly into their own interfaces.

---

## $TRUSTY

OG Trust Wallet mascot since 2019. Community takeover in 2025.

Contract on BNB Smart Chain: `0x65aea108c21439693468FCD542D81C29E8df4444`

- X: [@Trusty_BNB](https://x.com/Trusty_BNB) · [@Trusty_BSC](https://x.com/Trusty_BSC)

## License

MIT
