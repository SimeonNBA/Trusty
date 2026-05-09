# Trusty AI — what's pending

Clean as of 2026-05-09 (post dead-code cleanup pass).
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
  - **Points / streak / scan-stats / missions / leaderboard / Earn
    home renderer** — entire gamification subsystem
  - **Trenches 101 lesson system** — modal, 5 lessons of data, flow,
    cooldown helpers, course store, all CSS
  - Sub-bars KEPT (decision: useful supplemental context below
    headline score)

---

## 🚀 Launch path

These are the items between "now" and "open to users":

### Code (me)

- **Mobile audit** (~1-2 hr) — quick pass at 375 / 414 / 768
  breakpoints. Trusty sidebar mascot stacking, tap targets ≥44px,
  trending card spacing in the marquee strip, wallet input + verify
  button stacking on narrow widths. **This is the next code task.**
- **Bilingual EN / 中文 phase 1** (~2 hr + native review) —
  language toggle (flag emojis in nav), JS string-swap for the
  ~6-8 highest-impact strings (hero headline + subline, scanner CTA,
  "How to Buy" step labels, Trusty-tab section titles, privacy
  summary). **Decision pending:** ship English-only at launch, or
  hold for Chinese native review? Don't ship Chinese strings without
  a native speaker.
- **TWAK `trusty-safety` skill** (~3-4 hr) — read-only skill in
  the [tw-agent-skills](https://github.com/trustwallet/tw-agent-skills)
  format. Exposes `assess_token`, `get_kols`, `get_watchlist`,
  `get_trending`. NO trading methods. **Decision pending:** PR to
  `trustwallet/tw-agent-skills` upstream OR standalone at
  `github.com/SimeonNBA/trusty-skill`. Could also land post-launch.

### Content + admin (user)

- **Real partner logos** — replace the 4 dashed "PARTNER SLOT OPEN"
  placeholders on the Trusty tab.
- **NOWPayments payout addresses** for USDT-TRC20, BNB, SOL —
  configure in their dashboard so balances flow out without manual
  per-coin conversion.
- **Web Store listing screenshots** — current ones show the old
  (pre-v0.3.0) UI. Reshoot with new mascot, blurred paid-panel, KOL
  section, watchlist popup section.
- **Chrome Web Store v0.4.0 re-zip + upload** — wait for v0.3.0
  review to land, bundle the accumulated changes (Reddit removed,
  NOWPayments, watchlist sync, blurred panel, etc.) and re-submit.
  **Declare paid transactions** in the listing (required for
  extensions handling payments).
- **Flip extension to Public** once v0.4.0 review approves.

---

## 🟡 Post-launch / nice-to-have

### Code

- **Paid promotion model on the trending rail** (~3 hr) —
  Dexscreener-style paid slots above organic results. Worker:
  `POST /api/promotion?subId=…` → NOWPayments invoice; webhook reuses
  `/api/nowpayments-webhook` with `promo-` order_id prefix; KV
  `promo:active` tracks slots; `GET /api/trending` merges promo above
  organic with `"promoted": true`. Website renders with a "PROMOTED"
  badge + adds a "Promote your token" CTA. **Defer until** trending
  has consistent organic volume (≥10 unique tokens/day).
- **Watchlist alerts** (~3+ hr) — score-change + KOL-mention alerts
  on saved tokens. Worker cron diffs scores; emits to subscribers via
  `POST /api/alerts/subscribe`. **Decision pending:** email (needs
  ESP — Resend/Postmark) vs web push (browser notification API +
  service worker) vs both. Bigger than 3 hr if email.
- **Sentiment + coord-shill heuristic tuning** (~30 min each) —
  bullish/bearish word lists and 4-tweets-in-60-seconds threshold are
  placeholders. Tune once we see real-world false positives from
  launch usage. Skip until we have data.
- **First Timer Mode for the extension popup** — port the website's
  toggle pattern to the extension popup so non-technical users see
  plain-English explanations.

### Admin

- **Four.meme partnership outreach** — DM about either letting
  Trusty pills appear on their token detail pages OR cross-linking
  ("scanned by Trusty" badge).
- **Trust Wallet community channels** — your X mascot connection is
  the relationship hook. Worth a Telegram message to their team.
- **CZ / Binance amplifiable tweet** — craft a launch tweet that's
  BSC-positive + safety-positive that they'd reasonably retweet.
- **Launch trailer** — 30s hero demo, 90s walkthrough, 15s rug-catch
  shorts. Record once, distribute everywhere.

---

## 🟢 Operational watchlist

- **Sorsa quota:** 10K req/month plan. Engagement-only ranking cut us
  to ~1 call per unique-token paid scan. Watch the trend in your
  first weeks of users — `npx wrangler tail` shows the live calls.
- **NOWPayments fee:** 0.5% per txn. Trivial at current volume.
- **Cloudflare Worker free tier:** 100K req/day. Plenty of headroom.
- **KV reads/writes:** free tier limits at 100K reads/day, 1000
  writes/day. Worth monitoring once we have real users.

---

## 🔵 Open product questions for the user

- **Bilingual launch order** — Chinese first, simultaneous with
  English, or English-only at launch? Affects which native review
  you need first.
- **Chinese launch channel** — Telegram (existing community) vs new
  Weibo/WeChat presence? Different audiences.
- **Partnership pricing** — do partners pay for slots on the Trusty
  tab? Free for friends-of-the-project? Decide before you offer slots.
- **iOS Safari extension** — defer until we see real iOS demand via
  /api/event traffic. No code work yet.
