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

But scanning alone doesn't keep users. So Trusty is built as a **scan → learn → earn loop** that gives people a reason to come back every day.

### Core Features

**Scan**
- **Token Scanner** — Live market data (price, mcap, liquidity, volume, buy/sell ratio, age, holders) + full contract safety scan (honeypot, mint authority, LP lock, sell tax, whale concentration) + AI "Trusty Says" verdict
- **Gut Check** — Five honest questions (bull or bear market, flip or hold, real $100M path, can you sleep holding this tonight) that dynamically adjust the final recommendation and position size. The mirror most tools skip.
- **Watchlist** — Save tokens, re-scan anytime. localStorage only, no account required.
- **PDF Report + Share** — One-click download and share-to-X so users can pass the scan along.

**Learn**
- **Cheat Sheet** — Ape vs Run signals, Narrative Risk Matrix, Narrative Playbooks
- **Degen Glossary** — Every term a new trader needs, A-Z
- **Alpha Threads** — Curated long-reads from the best traders on X
- **History** — Trust Wallet (2017 to today), BNB Chain, and the full crypto lore
- **Weekly Trenches Report** — Weekly recap of what pumped, what rugged, and what the meta is this week on BNB Chain

**Earn (test mode)** — the retention loop
- **Trusty Points** — Every scan (+10), every lesson completed (+50), every streak day tracked. Points stored in localStorage until Phase 2 activates on-chain rewards.
- **Trenches 101** — A 5-lesson course on BNB launchpads (how they work, the first 5 minutes of a launch, rug patterns, reading a Trusty scan, your first scouting run). Each lesson has a quiz. Wrong answers lock the lesson for 24 hours — no point-farming.
- **Daily Streak** — 🔥 counter that resets if you skip a day. One scan a day keeps it alive.
- **6 Missions** — First Scan, Scout Status (10 scans), 3-Day Streak, Watchlist Loader, Read Trenches, Trenches Scholar (finish the course).
- **Scout Leaderboard** — Top 10 by weekly points. Phase 2 adds weekly $TRUSTY prize pools for the top 3.
- **"You vs The Trenches"** — Personal stats showing tokens scanned, RUN verdicts flagged, APE signals seen, days active.

Everything in Earn is clearly labelled **TEST** — points are local, no tokens are distributed yet. The full on-chain reward system launches in Phase 2.

---

## Why It Fits This Hackathon

Four.meme's mission is democratising meme coin creation. Trusty's mission is democratising meme coin evaluation. Same problem, two sides.

Someone mints a token on Four.meme in 30 seconds. Someone else should be able to evaluate that same token in 10 seconds. Right now, that second half doesn't exist for the average person — Trusty closes that gap.

And there's one more thing: **$TRUSTY is a community revival of the little blue shield** that appeared across Trust Wallet's early marketing in 2019 — Telegram stickers, blog posts, product announcements. In 2025 the community launched $TRUSTY on BNB Chain as a CTO: no VCs, no presale, no official partnership with Trust Wallet. The character is already familiar to the exact audience Four.meme wants to keep.

*$TRUSTY is a community project. Not affiliated with or endorsed by Trust Wallet.*

---

## Tech Stack

- **Frontend:** Single-page HTML/CSS/JS app, no build step, hosted on GitHub Pages
- **Backend:** Minimal Node.js + Express on Railway ([trusty-backend](https://github.com/SimeonNBA/trusty-backend))
- **Chain:** BNB Smart Chain
- **APIs:** DexScreener (market data), GoPlus Security (contract risk), Honeypot.is (honeypot detection)
- **AI:** "Trusty Says" verdict generator — context-aware scoring across 7 weighted categories
- **Retention:** Points / streak / course progress / scan stats, all client-side (localStorage). No backend account system yet.
- **Content pipeline:** `data/articles.json` (Trenches Report) + `data/featured.json` (featured tokens) + `data/trending.json` (trending, refreshed via GitHub Actions every 15 min)

## Architecture

```
User → trustyai.tech (GitHub Pages)
         ├── Scan → DexScreener + GoPlus + Honeypot.is
         ├── Gut Check → Client-side logic, adjusts verdict + position size
         ├── Learn → Static content (Cheat Sheet, Glossary, Threads, History)
         ├── Earn (test) → localStorage
         │      ├── Trusty Points store
         │      ├── Daily streak tracker
         │      ├── Trenches 101 completion + 24h lock on wrong answers
         │      ├── Missions auto-check
         │      └── Leaderboard (seed + user row)
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

**Phase 2 — Activate the Earn loop.** Sign-in, on-chain reputation profile, convert Trusty Points to $TRUSTY airdrops, weekly prize pool for the top 3 on the Scout Leaderboard. The test-mode system already shipped is the preview of this.

**Phase 3 — CA-Hunt tournaments.** Weekly scouting competitions where degens submit tokens, the community verdicts them, and the best scouts (fastest to flag a rug, first to find a 10x) win $TRUSTY and partner prizes.

**Phase 4 — B2B education partnerships.** BNB Chain projects pay Trusty to run bespoke courses, guided scans, and quizzes for their holders. Users earn, projects onboard educated communities, Trusty earns recurring revenue.

**Phase 5 — Telegram bot + public API.** Let other BNB dApps embed Trusty scans directly into their interfaces.

---

## $TRUSTY

Community revival of the Trust Wallet shield character from 2019. Launched in 2025 as a community takeover — not affiliated with or endorsed by Trust Wallet.

Contract on BNB Smart Chain: `0x65aea108c21439693468FCD542D81C29E8df4444`

- X: [@Trusty_BSC](https://x.com/Trusty_BSC)

## License

MIT
