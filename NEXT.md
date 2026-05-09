# Trusty AI — what's pending

Clean as of 2026-05-09. **Everything below is genuinely not done yet.**
For the running history of what's been shipped, run `git log` or read
`HANDOFF.md`.

---

## ✅ Already shipped (DON'T re-suggest these)

The previous bounded plan and many roadmap items are complete. Quick
sanity check before proposing anything below:

- Backend at `api.trustyai.tech` with `/api/scan` (BSC + Solana),
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
- Score animation smoothed (no more homegrown→API jolt).
- Reddit + Dexscreener pill injection removed; extension is X-only.

---

## 🟡 Pending — code work

### Orphan dead-code cleanup (mechanical, ~30 min)

When we removed the Contract Safety panel call, the LE switcher, and
the Token-tab rename, we left function definitions + DOM markup as
orphans (safer than rip-and-replace). They're inert (nothing calls
them, no UI surfaces them) but bloat the file. Clean pass:

- `runContractSafety()` definition (lines ~9393-...) — function still
  defined, never called. Plus the `contractSafetyPanel` HTML around
  line 5713 and the `contract-safety-row` around line 5786.
- `showLEPanel()` function — orphaned by the Earn sub-panel removal.
  Plus the `.le-switcher`, `.le-switcher-btn`, `.le-panel`, `.le-badge`
  CSS rules.
- Sub-bars logic in `evaluate()` — chain/narr/own/age/soc/sup
  computation that no longer drives the headline (API score does)
  but still animates as supplemental bars. **Decide first** whether
  to keep them as supplemental context or delete entirely. If keep:
  no-op. If delete: also remove the DOM bars + the score-XX elements
  + the setBar function.
- `tscLog` / `tscGet` / scan-stats system — orphaned by Earn removal.
  Plus the missions array (m-first-scan, m-10-scans, etc.).
- `checkOnboarding()` is already a no-op stub — could fully delete.
- The empty `?debug=1` query-param handling — actually already removed,
  just confirming.

**Risk:** sub-bars deletion is the only one with non-trivial DOM
coupling. The rest are pure dead code.

### Paid promotion model on the trending rail (~3 hr)

The trending rail currently shows organic activity only. Plan from
HANDOFF: add a paid-slots overlay (Dexscreener-style) that sorts
above organic results.

Worker:
- `POST /api/promotion?subId=…` — creates a NOWPayments invoice for a
  promotion slot (e.g., $50/day, $300/week, $1000/month).
- Webhook reuses the existing `/api/nowpayments-webhook` with a
  different order_id prefix (`promo-` instead of `trusty-`).
- KV: `promo:active` stores active promo slots with expiry.
- `GET /api/trending` merges promo slots ABOVE organic, with a
  `"promoted": true` flag per row.

Website:
- Render promoted rows with a subtle "PROMOTED" badge.
- Add a "Promote your token" CTA somewhere on the homepage / Trusty
  tab once we're ready to sell.

**Defer until:** trending has consistent organic volume (≥10 unique
tokens/day). Selling promo slots above an empty list is bad UX.

### TWAK `trusty-safety` skill (~3-4 hr)

Publish a markdown-driven skill in the
[trustwallet/tw-agent-skills](https://github.com/trustwallet/tw-agent-skills)
format. Read-only — exposes `assess_token(ca, chain)`,
`get_kols(ca)`, `get_watchlist(subId)`, `get_trending()`. NO trading
methods. We're the safety co-pilot for AI agents, not the trader.

Files to write:
- `SKILL.md` (routing)
- `references/assess.md` (the main token-safety call + response
  shape)
- `references/explain.md` (plain-English breakdown of each check)
- `references/audit-swap.md` (recommended pre-trade pattern)
- `references/watchlist.md` (read user's saved tokens)

Submit as PR to `trustwallet/tw-agent-skills` OR publish standalone
at `github.com/SimeonNBA/trusty-skill`. Decision pending.

### Watchlist alerts (~3 hr)

Score-change notifications + KOL-mention alerts on saved tokens.
Sticky daily-active driver. Choices:
- Email (need ESP — Resend/Postmark; user signup with optional email).
- Web push (browser notification API; needs service worker registration
  on the website).
- Both.

Worker: cron-driven scan of all watchlists, diff scores, emit alerts
to subscribers. New endpoint `POST /api/alerts/subscribe` for opt-in.

**Bigger than 3 hr if we go email.** Web push is faster but lower
engagement.

### Mobile audit (~1-2 hr)

Quick pass at common breakpoints (375 / 414 / 768):
- Trusty sidebar mascot stacking — should sit BELOW main column on
  ≤768px instead of squeezing.
- Tap targets ≥44px (iOS HIG minimum).
- Trending card spacing in the marquee strip.
- Wallet input + verify button stacking on narrow widths.

### Bilingual EN / 中文 (~2 hr + native review)

Phase 1: language toggle (flag emojis in nav), JS string-swap for the
~6-8 highest-impact strings (hero headline + subline, scanner CTA,
"How to Buy" step labels, Trusty-tab section titles, privacy summary).

**Don't ship Chinese strings without native speaker review.** Bad
Chinese is worse than no Chinese. Ask in the user's Telegram first.

Phase 2 (post-launch): full website translation, Chrome `_locales/`
i18n for the extension, Telegram + X dual-language posts.

### Sentiment + coord-shill heuristic tuning (~30 min each)

Current bullish/bearish word lists and 4-tweets-in-60-seconds
threshold are placeholders. Tune once we see real-world false
positives from launch usage. Skip until we have data.

---

## 🟡 Pending — strategic / admin (user actions)

These are decisions or external admin, not code:

- **NOWPayments payout addresses** for USDT-TRC20, BNB, SOL —
  configure in their dashboard so balances can flow out without
  manual per-coin conversion.
- **Chrome Web Store v0.4.0 re-zip + re-upload** — wait for v0.3.0
  review to land, then bundle the accumulated changes (Reddit
  removed, NOWPayments, watchlist sync, blurred panel, etc.) and
  re-submit. Same dashboard flow as v0.3.0.
- **Web Store listing screenshots** — current screenshots show the
  old (pre-v0.3.0) UI. Shoot fresh ones with the new mascot, blurred
  paid-panel, KOL section, watchlist popup section.
- **Real partner logos** for the Trusty tab — currently 4 dashed
  "PARTNER SLOT OPEN" placeholders. Drop in real logos as you secure
  partners.
- **Four.meme partnership outreach** — DM them about either letting
  Trusty pills appear on their token detail pages OR cross-linking
  ("scanned by Trusty" badge).
- **Trust Wallet community channels** — your X mascot connection is
  the relationship hook. Worth a Telegram message to their team.
- **CZ / Binance amplifiable tweet** — craft a launch tweet that's
  BSC-positive + safety-positive that they'd reasonably retweet.
- **Launch trailer** — 30s hero demo, 90s walkthrough, 15s rug-catch
  shorts. Record once, distribute everywhere.
- **First Timer Mode for the extension popup** — port the website's
  toggle pattern to the extension popup so non-technical users can
  see plain-English explanations.

---

## 🟢 Operational watchlist

- **Sorsa quota:** 10K req/month plan. Engagement-only ranking cut us
  to ~1 call per unique-token paid scan. Watch the trend in your first
  weeks of users — `npx wrangler tail` shows the live calls.
- **NOWPayments fee:** 0.5% per txn. Trivial at current volume.
- **Cloudflare Worker free tier:** 100K req/day. Plenty of headroom.
- **KV reads/writes:** free tier limits at 100K reads/day, 1000
  writes/day. Worth monitoring once we have real users.

---

## 🔵 Open product questions for the user

These are decisions waiting on you, not code:

- **Free vs paid promotion model** — eventually replace Featured
  Tokens with Trending + Paid-Promo. When? Probably once trending has
  organic volume.
- **iOS Safari extension** — defer until we see real iOS demand via
  /api/event traffic. No code work yet.
- **Bilingual launch order** — Chinese first or simultaneous with
  English? Affects which native review you need first.
- **Chinese launch channel** — Telegram (existing community) vs new
  Weibo/WeChat presence? Different audiences.
- **Partnership pricing** — do partners pay for slots on the Trusty
  tab? Free for friends-of-the-project? Decide before you offer slots.
