# trusty-safety — Trust Wallet Agent Skills

Read-only safety-verdict skill for any AI agent in the Trust Wallet
Agent Kit (TWAK) ecosystem. Wraps the `api.trustyai.tech` endpoints
behind a markdown-driven SKILL.md router that follows the
[trustwallet/tw-agent-skills](https://github.com/trustwallet/tw-agent-skills)
convention.

## What it does

Given a contract address, returns a one-shot APE / CAUTION / RUN
verdict with plain-English checks (honeypot, sell tax, LP lock, mint
authority, contract renounced) plus market data, KOL signal, and
launchpad origin (e.g. four.meme).

Pair with any trading skill to gate swaps on safety.

## Distribution

This directory is the canonical source. It's published in two places:

1. **Standalone**: this directory in the Trusty AI monorepo at
   `github.com/SimeonNBA/Trusty/tree/main/tw-agent-skill`.
2. **Upstream PR**: opened against
   [trustwallet/tw-agent-skills](https://github.com/trustwallet/tw-agent-skills)
   to land in their `skills/` folder. If accepted, this is mirrored
   under `skills/safety/` upstream.

## Structure

```
tw-agent-skill/
├── SKILL.md              ← routing + Quick Start
├── README.md             ← this file
└── references/
    ├── assess.md         ← assess_token — main safety call
    ├── explain.md        ← plain-English breakdown of each check
    ├── audit-swap.md     ← recommended pre-trade pattern
    ├── trending.md       ← get_trending — discovery
    └── watchlist.md      ← get_watchlist — read user's saved tokens
```

## Read-only by design

No trading methods. No transaction signing. No private-key handling.
The skill only ever reads contract metadata — failure to assess can
never compromise a user.

## Links

- Web app: <https://trustyai.tech>
- API base: `https://api.trustyai.tech`
- Privacy: <https://trustyai.tech/privacy/>
- Contact: [@Trusty_BSC](https://x.com/Trusty_BSC) on X
