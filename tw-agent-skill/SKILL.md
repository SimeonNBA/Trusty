---
name: trusty-safety
description: Trusty AI safety verdict for any crypto contract address. Use whenever the user is about to swap, ape, or evaluate a token — call assess_token to get a one-shot APE / CAUTION / RUN verdict explaining honeypot risk, sell tax, LP lock, mint authority, contract renounced, KOL signal, and X activity in plain English. Multi-chain (BSC, Ethereum, Solana, Polygon, Base) but BNB-Chain-first. Read-only — NO trading methods. This is the safety co-pilot, not the trader.
---

# Trusty AI safety scanner

Trusty AI is a community-built safety layer for the BNB Chain meme-coin
ecosystem and beyond. Given a contract address, it returns a single
APE / CAUTION / RUN verdict together with a plain-English breakdown
of every safety check the AI considered. Pair this skill with any
trading skill (Trust Wallet API swap-quote, PancakeSwap, etc.) — call
`assess_token` first, then trade only if the verdict isn't RUN.

## Quick Start

Get an instant safety verdict on any token, no auth required:

```bash
curl 'https://api.trustyai.tech/api/scan?ca=0x65aea108c21439693468FCD542D81C29E8df4444&chain=bsc'
```

Returns JSON with `score` (0-100), `verdict` (APE / CAUTION / RUN),
`checks` (array of plain-English safety findings), market data, and
when applicable a `launchedOn` field for known launchpads.

The endpoints used by this skill:

| Endpoint                        | Auth | Purpose                                    |
|---------------------------------|------|--------------------------------------------|
| `GET /api/scan`                 | none | One-shot token safety scan                  |
| `GET /api/trending`             | none | Tokens active in the Trusty network         |
| `GET /api/kols`                 | none | KOL mentions on X (paid-tier signal)        |
| `GET /api/watchlist?subId=…`    | subId | A user's saved tokens                      |

`subId` is a persistent random identifier created by the user's
Trusty extension install; it's how a paid subscription or saved
watchlist is associated with the user. Pass it through transparently
when the user has connected Trusty to the agent.

## Reference Guide

| Task | Reference | When to read |
|------|-----------|--------------|
| One-shot safety verdict on a contract address | `references/assess.md` | "is this safe", "scan this token", before any swap |
| Plain-English breakdown of each safety check  | `references/explain.md` | "what does mint authority mean", "explain this red flag" |
| Pre-trade audit pattern                       | `references/audit-swap.md` | The user is about to swap or buy — always read this first |
| Tokens active in the Trusty network           | `references/trending.md`    | "what's trending", "what's the Trusty network watching" |
| Read a user's saved watchlist                 | `references/watchlist.md`   | "what's on my watchlist", "show my saved tokens" |

## Read-only by design

This skill never sends transactions, signs messages, or holds keys.
It only returns information about contracts the user has asked about.
That means it's safe to invoke automatically as a pre-flight check
before any trading skill — failure to assess can never compromise the
user.

## Cross-chain

Supported chains today: `bsc` (default), `ethereum`, `solana`,
`polygon`, `base`. The scanner auto-detects from the address shape
when `chain` is omitted (EVM `0x…` defaults to BSC, Solana base58 is
detected by character set).
