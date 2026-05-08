# Trusty AI — Next session roadmap

Captured at the end of the 2026-05-07/08 build session. These are
deliberate "save for later" items — not bugs, just deferred work.

## Website fixes (trustyai.tech / index.html)

### 1. Auto-scan from `?ca=` URL param

Currently the homepage opens fresh when reached via a URL like
`trustyai.tech/?ca=0x65aea108c21439693468FCD542D81C29E8df4444&chain=evm`.
Users coming from the extension (watchlist click, paid panel "open
full report" link, share-tweet link) expect the token to be already
scanned and the result visible.

Fix outline:
- On `DOMContentLoaded`, parse `URLSearchParams` for `ca` and `chain`
- If present, populate the scanner input
- Trigger the existing scan flow programmatically
- Scroll the scan result into view

### 2. Trending feed (24h window) by real activity

Replace or augment the current "Featured Tokens" carousel on the
homepage with a "Trending" section sourced from real engagement data
within the Trusty network:
- Number of scans (extension hover / click / popup paste)
- Number of watchlist adds
- Optional: weight by paid-tier user activity higher

Implementation sketch:
- Worker: new `POST /api/event` endpoint accepting
  `{type: "scan"|"watchlist_add", ca, chain, ts}` — anonymous, no PII.
  Stores rolling 24h counters keyed by CA (KV with hourly buckets).
- Worker: `GET /api/trending?window=24h` returns top 20 CAs with
  counts, fetches scan data for each on demand.
- Website: render a "🔥 Trending now" carousel/list, each row
  click-throughs to the scanner with `?ca=...` (which works after
  fix #1).

Privacy: counters are per-CA, never per-user. No user ID or wallet
linked to events. Honest aggregate signal of what the community is
looking at.

### 3. Watchlist page on trustyai.tech (`/watchlist/`)

The popup already links to `https://trustyai.tech/watchlist/` ("See all
on trustyai.tech →") but the page doesn't exist yet. Build a simple
page that:
- Reads the user's `subId` from a query param or extension postMessage
- Fetches `/api/watchlist?subId=…` and renders the full list
- Each row shows the live score (re-scan on load), name, symbol, age,
  watch-since timestamp, and an unwatch button
- Empty state with a CTA to install the extension

## Polish bin (small but worth doing eventually)

- **Tooltip header mascot.** Right now the tooltip header is just
  text. We could add a small mascot PNG to the top-left of the
  tooltip card (using the `web_accessible_resources` we already
  declared) — would tie the brand together visually.
- **Favicon swap on the website.** `index.html` and `privacy/index.html`
  use the inline-SVG emoji shield as the favicon. Once we have a
  `favicon.png` (32x32 or 48x48) in the repo, swap the `<link
  rel="icon">` tags to point at it.
- **Transparent mascot for the website hero.** User has a transparent
  PNG of the new mascot — replace the current SVG mascot in the
  homepage hero/sticky-side panel. *Saved at `assets/mascot-hero.png`
  but it's 1.2 MB — should be optimized to ~200 KB via squoosh.app
  (PNG quantizer or WebP) for faster page load.*
- **Sentiment heuristic tuning.** Current bullish/bearish word lists
  are reasonable but could be tuned with real-world false positives
  from the first weeks of usage.
- **Coord-shill heuristic tuning.** Currently a 4-tweets-in-60-seconds
  threshold; on high-volume queries like "bitcoin" it can trigger
  false positives. Worth tightening once we see real-world rates.
- **Worker debug endpoint.** Removed `?debug=1` for security but a
  signed/keyed admin variant would be useful for diagnosing future
  issues without redeploying.

## Website navigation cleanup

- **Remove the "Weekly Trenches Report" tab** entirely. Stale data, not
  driving value. Delete the tab button + the panel + the data file.
- **"Learn & Earn" → "Learn"**. Drop the "Earn" half. Whatever points/
  tasks system was there, remove. Single-purpose tab: education.
- **Rename "Token" tab to "Trusty"**. On this rebuilt tab, list:
  - Every exchange where $TRUSTY is tradeable (CEX + DEX)
  - Every project partner / integration we secure
  - Useful $TRUSTY links (chart, contract, audits, etc.)

## Cross-platform extension UX

The pill experience varies a lot by host site. Audit each:
- **x.com / twitter.com** — works well today.
- **reddit.com** — works but UI is denser; verify pill placement on
  comment threads and the new and old layouts both.
- **dexscreener.com** — *concern:* one Dexscreener page can list 100+
  CAs (trending, watchlists, search results). Auto-injecting a pill
  on every CA means hundreds of `/api/scan` calls per page load
  (mostly cached, but still bandwidth + KV reads). And users could
  spam-scan a screen of tokens if pills are inviting.

  Options to consider:
  - Disable the extension on Dexscreener entirely (simplest)
  - Only inject pills on Dexscreener token *detail* pages, not lists
  - Lazy-inject via IntersectionObserver — only scan CAs that scroll
    into view
  - Hard cap of N pills per Dexscreener page

  My pick: lazy-inject + cap. Test the UX before deciding to disable.

## Go-to-market

- **Launch checklist** — what has to be in place before we tell anyone:
  - Web Store listing public (currently Unlisted; flip when ready)
  - Privacy + Terms pages live (privacy is, terms isn't)
  - Hero mascot + branding finalized
  - At least 3 partner logos on the new "Trusty" tab
  - Sample scan video / screenshot set for tweet thread
- **Marketing plan**:
  - Launch tweet thread with screen recording of the extension in
    action on a real shill tweet — show the pill catching a honeypot
    in real time
  - Outreach to 5-10 Crypto Twitter KOLs in the safety/research niche
    for organic reviews (free unlimited tier in exchange for honest
    review)
  - Cross-post on Reddit (r/CryptoCurrency, r/CryptoMoonShots) showing
    the safety scoring catching real rugs from this week
  - Telegram + Discord for the existing $TRUSTY community
- **Video content** (record once, distribute everywhere):
  - 30-second hero demo: paste a CA → watch the pill verdict appear →
    open the panel → see KOLs + market data
  - 90-second walkthrough: install, verify wallet, paid panel, watchlist
  - 15-second clips for shorts / reels: "This token is a honeypot —
    Trusty caught it in 1 second" with real examples
  - How-to-find-a-rug tutorial (the educational angle that makes
    Trusty look like the obvious answer)

## Long-term: TWAK / tw-agent-skills integration

**Repo:** [trustwallet/tw-agent-skills](https://github.com/trustwallet/tw-agent-skills)

TWAK is a markdown-driven skill registry for AI coding agents (Claude
Code, Cursor, GitHub Copilot, etc.). Skills live in
`/skills/{name}/SKILL.md` + `/skills/{name}/references/*.md`. Three
official skills today:
- `api` — Trust Wallet's data API (token info, prices, swap quotes,
  market data, basic security validation)
- `wallet` — `twak` CLI (balances, swaps, transfers, alerts, ERC-20)
- `sdk` — open-source libs (Wallet Core, Web3 Provider, Barz)

The `api` skill already has a thin `security.md` reference, but it
maps to Trust Wallet's own risk scoring — which is conservative and
narrow. Trusty's safety stack is wider: GoPlus + RugCheck + Sorsa
social signal + Dexscreener market depth, fused into a 0-100 score
with plain-English reasons.

### Is trading risky?

**Yes — and that's the niche.** Most TWAK examples will be aggressive
(snipe-this, max-yield-that). AI agents executing real trades face:
- Hallucinated CAs (LLM types the wrong contract address)
- Wrong-amount swaps from off-by-one prompt parsing
- MEV exposure on naïve route selection
- No safety check before approval/execution
- No KOL/social context to flag pump-and-dump cycles

Trusty's role inside an agent isn't to *trade* — it's to be the
**safety co-pilot that audits the trade before commit**. "Are you
sure? This token scores 32/100, top 5 wallets hold 67%, mint
authority is active. Reply YES to confirm anyway."

### Niche implementation: `trusty-safety` skill

A separate skill we publish as a PR to tw-agent-skills (or as our
own forkable skill repo). Wraps `api.trustyai.tech` so any TWAK
agent can call:

```
assess_token(ca, chain) -> {
  score: 0-100,
  verdict: APE | CAUTION | RUN,
  blockers: ["honeypot", "owner not renounced", "top 5 hold 67%"],
  reasons: ["LP locked at 99%", "no transfer fee", ...],
  market: { mcap, liquidity, volume24h, age, holders },
  social: { tweets24h, sentiment, top_kols }
}
```

Recommended use pattern in the skill markdown:
> Before any swap, transfer, or token-interaction action, call
> `trusty-safety.assess_token`. If verdict is RUN, refuse and
> explain to the user. If verdict is CAUTION, require explicit
> confirmation. If APE, proceed.

### Effort & what we'd ship

- **Phase 1 (~3-4 hr):** Write the skill markdown (SKILL.md + 2-3
  reference files) wrapping `/api/scan`. No code change to our
  Worker — same endpoint. Submit as PR to tw-agent-skills, or
  publish at github.com/SimeonNBA/trusty-skill for `npx skills add`.
- **Phase 2 (later):** Agent-specific helpers — e.g., a
  `assess_swap_route` that takes a path of CAs and returns the
  worst-scoring leg. Or `monitor_watchlist_alerts` that reads our
  watchlist API and surfaces score changes.
- **Phase 3 (vision):** Become the de-facto "safety layer" for AI
  agents on BNB Chain. Marketing angle: "Don't ape blind. Don't
  let your AI agent ape blind either."

### Open questions

- Submit as PR to upstream tw-agent-skills (audience reach, but slower)
  OR publish standalone (faster, more control)?
- Free for skill users, or require Sorsa-tier API key for paid users?
  (KOL data is the differentiator; safety checks could remain free.)
- Cobrand carefully — Trusty is community, Trust Wallet is the brand.
  We're not affiliated, so the skill name should be `trusty-safety`
  not `trustwallet-trusty` or similar.

## Operational

- **Watch the Sorsa quota.** 10K/month plan. Engagement-only ranking
  cut us to 1 call per scan, but we should add a small dashboard to
  see daily usage trend before we surprise-run out.
- **Set up payout addresses on NOWPayments** for the most-likely-paid
  coins (USDT-TRC20, USDT-BEP20, BNB, SOL) so accumulated balances
  can flow out without per-coin manual conversion.
- **Update Chrome Web Store listing's hero image and screenshots** to
  show the new v0.3.0+ features (KOL panel, Solana support, MC strip).
