# Trusty AI

AI-powered meme coin scanner, risk analyzer, and education platform on BNB Smart Chain.

**Live:** [trustyai.tech](https://trustyai.tech)

## What It Does

- **Scam Detection** — Paste any contract address, get instant risk analysis (honeypot, mint function, sell tax, whale wallets, LP status) from DexScreener, GoPlus, and Honeypot.is
- **AI Risk Score** — Plain English explanation of token safety ("Trusty Says")
- **Portfolio Dashboard** — Connect Trust Wallet, see all BSC tokens with risk badges (SAFE / OKAY / RISKY / DANGER)
- **One-Click Trading** — Swap via PancakeSwap V2 with slippage protection (5-25%)
- **Education** — Interactive "Rug or Gem?" quiz, cheat sheet, risk matrix, narrative playbooks
- **Trending Tokens** — Updated every 15 minutes via GitHub Actions

## Tech Stack

- **Frontend:** Single-page HTML/CSS/JS app hosted on GitHub Pages
- **Backend:** Node.js + Express on Railway ([trusty-backend](https://github.com/SimeonNBA/trusty-backend))
- **Chain:** BNB Smart Chain (BSC)
- **Wallet:** Trust Wallet browser extension
- **APIs:** DexScreener, GoPlus, Honeypot.is, Chainbase
- **DEX:** PancakeSwap V2 Router

## Architecture

```
User → trustyai.tech (GitHub Pages)
         ├── Token Scan → DexScreener + GoPlus + Honeypot.is
         ├── Portfolio → Backend → Chainbase API
         ├── Swap → PancakeSwap Router (on-chain via wallet)
         └── Trending → data/trending.json (GitHub Actions)
```

## Setup

No build step required. Clone and open `index.html` or deploy to any static hosting.

```bash
git clone https://github.com/SimeonNBA/Trusty.git
cd Trusty
# Open index.html in browser or deploy to GitHub Pages
```

## Backend

See [trusty-backend](https://github.com/SimeonNBA/trusty-backend) for the Node.js API server.

## Contract

$TRUSTY on BNB Smart Chain: `0x65aea108c21439693468FCD542D81C29E8df4444`

## License

MIT
