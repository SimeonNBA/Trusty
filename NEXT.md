# Trusty AI — what's pending

Clean as of 2026-05-09.
**Everything below is genuinely not done yet.** For the running history
of what's been shipped, run `git log` or read `HANDOFF.md`.

---

## ✅ Already shipped (DON'T re-suggest these)

- Backend at `api.trustyai.tech`: `/api/scan` (BSC + Solana),
  `/api/kols` (Sorsa), `/api/subscribe` + webhook (NOWPayments),
  `/api/watchlist` (cloud sync), `/api/event` + `/api/trending`.
- Website: `/` (homepage with auto-scan from `?ca=`, Free/Paid value
  cards, BNB-niche hero, trending rail that auto-hides Featured when
  ≥3 items), `/privacy/`, `/watchlist/`.
- Extension v0.3.0 (in Web Store review, Unlisted): X-only pill
  injection, hover tease line, blurred paid-panel modal for free
  users, click-to-reveal KOLs (Sorsa), watchlist sync, mascot icons.
- Website nav cleanup: Weekly Trenches Report tab REMOVED, "Learn &
  Earn" → "Learn" (Earn sub-panel removed), "Token" tab renamed to
  "Trusty" with Buy / Partners / Audits / Community sections.
- Mascot: WebP-optimized to 58 KB, used as favicon + hero across all
  pages.
- Verdict labels unified (APE / CAUTION / RUN — no more "DEGEN PLAY").
- Score animation smoothed.
- Reddit + Dexscreener pill injection removed; extension is X-only.
- **Dead-code cleanup pass (2026-05-09)** — ~1,910 lines removed in
  five commits. Gone for good:
  - Contract Safety panel (DOM + CSS + runContractSafety chain +
    education-card helpers + metricData.contract entry)
  - `showLEPanel` switcher + `.le-switcher` family CSS
  - Onboarding overlay stub + entire `.onboarding-*` / `.ob-*` CSS
  - Points / streak / scan-stats / missions / leaderboard / Earn home
    renderer — entire gamification subsystem
  - Trenches 101 lesson system — modal, 5 lessons of data, flow,
    cooldown helpers, course store, all CSS
  - Sub-bars KEPT (decision: useful supplemental context below
    headline score)
- **Mobile audit + fixes (2026-05-09)** — `min-height: 44px` on
  `.main-nav-btn` for iOS HIG; sidebar bottom-bar layout extended from
  `≤600px` to `≤900px` so tablets don't squeeze main column.
- **Hold-tier removal (2026-05-09)** — extension and website now
  funnel paid users through NOWPayments only ($5/mo or $50/yr). Yearly
  plan was already in the worker; just surfaced in popup. Privacy
  story simplified — no more BSC RPC permission, no wallet-address
  collection. ~410 lines removed across 13 files.
- **Real partner logos (2026-05-09)** — Grovex (CEX, TRUSTY/USDT
  pair) and Topaz Dex (DEX) now live as real partner cards. 2 of 4
  slots filled; 2 still open for future partners.

---

## 🚀 Launch path (locked plan, in order)

### 1. Code — me (today)

Order ranked by ship-readiness. Each is its own commit.

#### Token logos from `trustwallet/assets`
- Render `<img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/{chain}/assets/{address}/logo.png">` for tokens shown in trending rail, scan results, watchlist rows, and the extension pill.
- Address checksumming for EVM chains (TW uses checksummed addresses).
- **Behavior on miss: hide the image entirely** (`onerror="this.style.display='none'"`). Causes a small layout shift but is visually cleanest. (Can flip to "show emoji-shield fallback" later if shifts are noticeable.)
- ~1 hr. Pure frontend, no worker change.

#### Four.meme Tier 1 — positioning copy on homepage
- Single line in the hero subline or value-card area: *"Scans four.meme launches and BNB Chain meme tokens."* Optionally a small four.meme logo + link to four.meme.
- Pure marketing. No API call, no detection.
- ~10-15 min. Pure frontend.

#### Four.meme Tier 2 — launchpad detection in scan results
- **Worker change** — on `/api/scan`, look up the contract's deploy transaction and check whether it was sent to the four.meme exchange proxy `0x5c952063c7fc8610ffdb798152d69f0b9550762b`. Cache the result in KV (24h TTL — deployer is immutable).
- Free, no Bitquery dependency. Source: Bitquery published the proxy address.
- Adds `launchedOn: "fourmeme"` field to the scan response.
- Extension and website both render a row: `🚀 Launched on four.meme · view on four.meme →`
- The link points to `https://four.meme/token/{contract_address}` — opens four.meme's own UI for the bonding-curve trading or post-graduation token info.
- This is **separate from** the Trade-in-TW CTA (which fires on any token, regardless of launchpad).
- ~1-2 hr. Worker + extension + website.

#### Trust Wallet swap CTAs (extension + website, primary path)
- Replace the current "Buy on PancakeSwap" affordances with a Trust Wallet-first flow.
- Mobile (any browser): `https://link.trustwallet.com/swap?...` — opens TW mobile app, swap pre-filled.
- Desktop (any browser): `https://swap.trustwallet.com/?...` — opens TW's web swap UI; auto-connects to TW Chrome extension if installed.
- PancakeSwap stays as a **secondary / fallback** option, not removed.
- **In the extension too** — even though every extension user is on desktop, they go to TW's web swap (not the mobile deep link) so the TW Chrome extension can auto-connect.
- **Pre-flight: WebFetch `swap.trustwallet.com` to lock the exact URL params** for `fromToken` / `toToken` / chain. Don't assume — verify.
- ~1 hr. Pure frontend.

#### TWAK `trusty-safety` skill
- Markdown-driven skill in [trustwallet/tw-agent-skills](https://github.com/trustwallet/tw-agent-skills) format.
- Read-only — exposes `assess_token`, `get_kols`, `get_watchlist`, `get_trending`. NO trading methods. We're the safety co-pilot for AI agents, not the trader.
- Files: `SKILL.md`, `references/assess.md`, `references/explain.md`, `references/audit-swap.md`, `references/trending.md`, `references/watchlist.md`.
- **Distribution:** build once, ship to BOTH places — open a PR to `trustwallet/tw-agent-skills` upstream AND mirror as standalone repo `github.com/SimeonNBA/trusty-skill` so we have a public canonical URL today regardless of upstream timeline.
- Pre-flight: WebFetch a couple of merged skills from the upstream repo so we match their conventions exactly.
- ~3-4 hr. Pure markdown — zero new code.

### 2. Worker deploy — user (next morning)

Four.meme Tier 2 needs a worker re-deploy. Other items above are
frontend-only or markdown-only.

### 3. Local QA pass — user (~10 min)

Load the unpacked extension in Chrome and click through:
- Open popup → tap Monthly $5 → confirm NOWPayments invoice opens cleanly
- Open popup → tap Yearly $50 → same
- Scan a known four.meme CA → confirm `🚀 Launched on four.meme` badge appears
- Scan any token → confirm "Trade in Trust Wallet" link opens swap.trustwallet.com with token pre-filled
- Confirm pill on x.com works, hover tooltip + paid panel render correctly
- Confirm watchlist syncs between extension and trustyai.tech/watchlist/

### 4. Content — user

- **Web Store screenshots** — reshoot with the new mascot, blurred paid-panel, KOL section, watchlist popup section, four.meme badge.
- **Demo video** — 30-60 second screen recording: scan a token on X → hover the pill → click → open paid panel after subscribing. Loom or QuickTime is enough.

### 5. Web Store v0.4.0 submission — user

- Wait for v0.3.0 review to land first (Web Store doesn't accept two queued versions).
- Bump `manifest.json` `version` from `0.3.0` → `0.4.0`.
- Re-zip the `extension/` folder.
- Submit through the dashboard with:
  - New screenshots + demo video link
  - Refreshed "What's new in v0.4.0" notes
  - Updated description (the text in `extension/STORE_LISTING.md` is paste-ready)
  - **Declare paid transactions** in the Privacy & Permissions section — required for extensions handling payments
- Wait 1-2 days (typical) or 3-7 days (first-time review of a paid extension).

### 6. Launch — user

- Flip listing from Unlisted → Public when approved.
- Fire the launch tweet on @Trusty_BSC.
- Notify TG community.

---

## 🟡 Parked / deferred (post-launch or out-of-scope for v1)

- **Bilingual EN / 中文** — parked. AI translation reads as machine-typo'd to native crypto-Chinese audiences and damages credibility more than no translation does. Add post-launch when a native reviewer is available (free option: ask TG community for a volunteer once we have users).
- **Bitquery Four.meme API** — paid third-party integration. Skip for v1; the launchpad detection above gives us 80% of the value for $0. Revisit post-launch if user-volume justifies the infra cost (likely $200-$500/mo low-latency tier).
- **Paid promotion model on trending rail** (~3 hr) — Dexscreener-style paid slots above organic. Defer until trending has ≥10 unique tokens/day organic.
- **Watchlist alerts** (~3+ hr) — score-change + KOL-mention alerts. Decision pending: email (needs ESP — Resend/Postmark) vs web push vs both.
- **Sentiment + coord-shill heuristic tuning** — placeholder lists. Tune once we have real-world false positives from launch usage.
- **First Timer Mode for the extension popup** — port the website's toggle pattern to the extension.
- **Hold-tier with signature verification** — if we ever bring back token-gating, do it properly with SIWE so it's not bypassable. Major listing-copy rewrite required.

---

## 🟡 Admin (user actions, mostly post-launch)

- **Four.meme partnership outreach** — DM about cross-linking ("scanned by Trusty" badge on their token detail pages OR pill injection on four.meme).
- **Trust Wallet community channels** — your X mascot connection is the relationship hook. Worth a Telegram message to their team after the TWAK skill is published.
- **CZ / Binance amplifiable tweet** — craft a launch tweet that's BSC-positive + safety-positive that they'd reasonably retweet.
- **Launch trailer** — 30s hero demo, 90s walkthrough, 15s rug-catch shorts. Record once, distribute everywhere.
- **NOWPayments payout addresses** — done as of 2026-05-09 for current coins; user will update again later if cashout flow needs more chains.

---

## 🟢 Operational watchlist

- **Sorsa quota:** 10K req/month plan. Engagement-only ranking cut us to ~1 call per unique-token paid scan. Watch the trend in your first weeks of users — `npx wrangler tail` shows the live calls.
- **NOWPayments fee:** 0.5% per txn. Trivial at current volume.
- **Cloudflare Worker free tier:** 100K req/day. Plenty of headroom.
- **KV reads/writes:** free tier limits at 100K reads/day, 1000 writes/day. Worth monitoring once we have real users.

---

## 🔵 Open product questions for the user

- **v0.3.0 → v0.4.0 timing** — when v0.3.0 lands review, do we (a) flip it Public briefly to start collecting users, then submit v0.4.0, or (b) keep v0.3.0 Unlisted and time the public launch to v0.4.0 ship date? (b) is cleaner for a clean announcement; (a) gets earliest user feedback.
- **Chinese launch channel** — Telegram (existing community) vs new Weibo/WeChat presence? Different audiences. Decide alongside bilingual unparking.
- **Partnership pricing** — do partners pay for slots on the Trusty tab? Free for friends-of-the-project? Decide before you offer slots.
- **iOS Safari extension** — defer until we see real iOS demand via `/api/event` traffic. No code work yet.
