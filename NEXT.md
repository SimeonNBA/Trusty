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

## Trending vs Featured — collapse into one paid promotion model

We currently have two homepage rails:
- **Featured Tokens** — manually curated list (data/featured.json)
- **Trending Now** — sourced from real scan + watchlist_add activity

End state: ONE rail (Trending Now), with a paid-promotion overlay
modeled on Dexscreener:
- Free tier: shown by real-activity rank
- Paid spots: 1-3 slots reserved for projects who pay; sorted by
  amount paid, displayed with a subtle "PROMOTED" badge above the
  organic list
- Pricing: e.g. $50/day, $300/week, $1000/month — adjust based on
  homepage traffic once we have it

Until then: hide Trending if it has <3 items, keep Featured as the
warming-up placeholder. Switch over once Trending consistently has
real signal across enough tokens.

Implementation when ready:
- Worker: new `/api/promotion` POST endpoint (NOWPayments-backed,
  similar to /api/subscribe but per-promotion-slot)
- KV: `promo:active` list, sorted by spend descending
- /api/trending merges promo + organic, returning the unified list

## Extension positioning + funnel — why users pay, why they visit the site

**Why users pay (extension side):**
- The free pill verdict is genuinely useful, BUT the paid panel is
  where the differentiation lives: KOL mentions, X activity, sentiment,
  unlimited scans. Need to spell this out clearly when free users hit
  cap or hover the upgrade CTA.
- Copy ideas to test:
  - "See who's calling this token early" (KOLs)
  - "Catch coordinated shills before they pump" (activity)
  - "$5/mo. 200+ coins to pay with."
  - Short demo video on the popup itself? (autoplay-on-open)
- Friction points to remove:
  - Free user clicks pill → opens trustyai.tech in new tab. Feels like
    leaving. Maybe show inline mini-panel for free with a "Reveal full
    breakdown" CTA inside?
  - Watchlist 5-cap message could be more enticing than punitive

**Why users visit the site (web side):**
- Today: most traffic is from the extension's "open full report"
  link. The site is mostly a redirect target.
- After we remove Weekly Trenches + Earn, the value props left are:
  - Live trending feed (community signal)
  - Education (Learn tab, glossary)
  - Watchlist as a richer dashboard than the popup
  - Token info — listings, partners, $TRUSTY data (the new "Trusty" tab)
  - PDF / share-card export of any scan
- We need ONE primary reason for the user to keep coming back to the
  site (not just one-off scans). Two candidates:
  - **Trending feed as a destination** — daily check-in, "what's the
    network watching." Works once we have real volume.
  - **Watchlist with alerts** — score change notifications, price
    movement on tracked tokens, KOL mentions on saved tokens. Sticky
    if alerts work; needs email or web-push.

Pick one as the "homepage hook" before launch.

## Mobile

### Mobile responsive — homepage carousel stacking

When Trending has ≥3 items it now auto-hides Featured (single rail
on all viewports). But the homepage has more elements that need a
mobile pass — the right-side floating Trusty mascot panel, the
trending-eval cards' touch targets, the scanner input.

Audit pass needed at common breakpoints (375 / 414 / 768):
- Header logo + step-tracker pip row alignment
- Trending card spacing in the marquee strip
- Trusty sidebar with mascot — should stack BELOW main column on
  ≤768px instead of squeezing the main col
- Tab bar buttons wrap or scroll horizontally
- Wallet input + verify button stack cleanly
- Paid-panel mascot/tooltip-bubble doesn't crash into bottom nav
- Tap targets ≥44px everywhere (iOS HIG minimum)

### Extension on mobile — what's possible

Chrome on Android **does NOT support extensions**, full stop. Two
realistic paths to ship a mobile-native Trusty experience:

1. **Firefox for Android via AMO** — supports a curated subset of
   extensions via addons.mozilla.org. Would need a separate AMO
   submission; manifest is mostly compatible (V3 supported in newer
   Firefox), and Mozilla's review process is similar to Chrome Web
   Store. ~1-2 days of work to submit a Firefox-compatible build.
   This is the cleanest first step — official store, real audience,
   we control the listing.
2. **Native iOS Safari extension** — Apple's process is heavier:
   requires an Xcode project wrapper, Apple Developer account ($99/yr),
   App Store review. Possible but a real lift. Defer until we have
   meaningful demand from iOS users — once we see them in
   /api/event traffic via the website, that's the signal.

Explicitly NOT recommending: Kiwi Browser. Looks like asking users
to install an "alternative browser" to access our product, which is
a friction tax + a trust ask we shouldn't be making. We'd rather
stay on official channels (Firefox AMO, Apple App Store) even if
they take longer.

Pragmatic plan:
- Submit to Firefox AMO as the primary mobile-native channel.
- Track iOS demand for ~1-2 months before committing to the Safari
  wrapper — real signal beats premature optimization.
- For now, the mobile *web* experience on trustyai.tech is the
  catch-all: scan-via-paste, trending feed, watchlist sync. Make
  that pass-the-eye-test on mobile before any extension work.

## Cross-platform extension UX

The pill experience varies a lot by host site. Audit each:
- **x.com / twitter.com** — works well today.
- **reddit.com** — works but UI is denser; verify pill placement on
  comment threads and the new and old layouts both.
- **dexscreener.com** — pill injection has been REMOVED from the
  extension (manifest no longer registers a content script there).
  Reasons: a single Dexscreener page can list 100+ CAs, which would
  burst /api/scan and isn't useful for users already in a pro-tools
  context. DexScreener remains a backend data source (price, mcap,
  pairs) — we just don't inject pills onto their UI. Re-add later if
  we ship a proper rate-limited / lazy-injected version.

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

**Yes — and that's exactly why we DON'T do trading.** AI agents
executing real trades face:
- Hallucinated CAs (LLM types the wrong contract address)
- Wrong-amount swaps from off-by-one prompt parsing
- MEV exposure on naïve route selection
- No safety check before approval/execution
- No KOL/social context to flag pump-and-dump cycles

Trusty's `trusty-safety` skill stays **strictly read-only**:
- ✅ Token security scoring (GoPlus + RugCheck)
- ✅ Market data (Dexscreener)
- ✅ KOL signal + sentiment (Sorsa)
- ✅ Watchlist read
- ✅ Trending feed read
- ❌ Sign anything
- ❌ Swap, transfer, approve
- ❌ Touch a private key in any form

We're the **seatbelt, not the steering wheel.** The user (or another
agent's wallet skill) drives. Trusty audits. If the safety check
fails, the agent should refuse the trade or require explicit
confirmation. We carry zero trade-execution liability.

This positioning is also marketing: "Don't ape blind. Don't let
your AI agent ape blind either."

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
