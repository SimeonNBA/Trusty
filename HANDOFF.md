# Trusty AI — Session Handoff

Carries context from the 2026-05-08/09 build session into the next
fresh chat. Paste a prompt referencing this file plus `NEXT.md` and
the next-Claude has full context without reading 6 hours of history.

## Where we are right now

### Live state
- `api.trustyai.tech` — Cloudflare Worker, all endpoints healthy
  (`/api/scan`, `/api/kols`, `/api/subscribe`, `/api/nowpayments-webhook`,
  `/api/subscription`, `/api/watchlist`, `/api/event`, `/api/trending`).
- `trustyai.tech` — homepage with auto-scan from `?ca=` URL param,
  bilingual pending, scanner unified with /api/scan headline score,
  trending feed wired (currently low signal).
- `trustyai.tech/privacy/` — live, replaces the old Gist URL.
- `trustyai.tech/watchlist/` — live, reads subId from URL hash.
- Extension v0.3.0 in Chrome Web Store review (Unlisted). v0.4.0
  worth of changes accumulated locally — not yet zipped/submitted.

### Latest commits (top of `main`)
Run `git -C D:/Trusty-AI/frontend log -10 --oneline` for the live list.
As of this handoff: Dexscreener removed, Reddit removed, orphan
cleanup done, all changes pushed.

### Extension scope
- Pill injection: **x.com / twitter.com only** (Reddit + Dexscreener
  removed for cleaner v1 launch).
- Bridge content script on `trustyai.tech` (no pill injection there;
  copies the persistent subId into the page's localStorage for
  watchlist sync).

### Backend data sources
- **GoPlus** (free, no key) — EVM token security
- **GoPlus Solana** (free, no key) — Solana token security
- **RugCheck.xyz** (free, no key) — Solana LP locked detection (more
  reliable than GoPlus for Pump.fun graduates)
- **Dexscreener** (free, no key) — market data on EVM + Solana
- **Sorsa** (paid, $49/mo, 10k req/mo) — KOL mentions + X activity
- **NOWPayments** (paid 0.5% fee per txn) — crypto subscriptions
- **Public BSC RPC nodes** — read-only $TRUSTY balance for the
  hold-path paid tier

### Cloudflare secrets currently set
- `SORSA_API_KEY`
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`

KV namespace: `SCAN_KV` (id in wrangler.toml).

## Bounded scope for tomorrow's session

These are pre-approved by the user. Ship them in order. Each is
expected to be one independent commit + push.

### Item 0 — Sanity check on the latest live state
Before doing anything: visit `trustyai.tech` and confirm a real scan
(e.g., $TRUSTY at `0x65aea108c21439693468FCD542D81C29E8df4444&chain=bsc`)
animates to 85 / APE without visual hiccups. If anything breaks,
STOP and document in NEXT.md before shipping new code.

### Item 1 — Blurred paid-panel modal for free users (HIGHEST LEVERAGE)
~1 hour. The single most impactful conversion lever.

Today, when a *free* user clicks a pill:
- Extension opens `trustyai.tech` in a new tab.
- They never *see* the paid panel they'd be unlocking.

Change to: free user click → opens the **same paid panel modal a
paid user would see**, but with KOL handles + X activity numbers
**blurred** behind a clear "Unlock for $5/mo" CTA. They literally
see the structure of what they're missing.

Implementation:
- `extension/lib/pill-injector.js` — in `onPillClick`, instead of
  `window.open(trustyai.tech/?ca=...)` for free users, call
  `openPaidPanel(result, ca, chain)` with a flag like
  `{ blurred: true }`.
- Inside `openPaidPanel`, if blurred mode: render the panel as
  normal, then add a class like `trusty-pp-blurred` to the KOL +
  activity sections, and show a "Unlock for $5/mo" overlay button
  that opens the popup OR the website upgrade flow.
- CSS: add `.trusty-pp-blurred .trusty-pp-kol-handle, .trusty-pp-blurred .trusty-pp-kol-engagement, .trusty-pp-blurred .trusty-pp-stat-num { filter: blur(6px); user-select: none; }` plus the overlay styles.
- The Reveal CTA inside the panel becomes the **upgrade CTA** for
  free users (different copy + behavior).
- Keep the existing free behavior of "open trustyai.tech full report"
  as a secondary link in the modal — don't remove the option entirely.

Acceptance: free user clicks → blurred panel appears → upgrade CTA
visible → either subscribes or dismisses. No regression for paid
users (their unblurred panel still works).

### Item 2 — Hover tease line on the free pill (~15 min)
On the free pill's hover tooltip, add ONE line above the existing
"Hold $TRUSTY or upgrade" CTA:
```
🐦 KOL activity · X velocity · sentiment available
```
No real numbers (avoids quota burn on every hover) — just a tease
of what's behind the wall.

In `pill-injector.js`'s `renderTooltipHtml`, between the checks
list and the footer, add a small line. Style with a subtle gold
accent matching the existing footer's `<strong>` color.

Acceptance: free user hovers → sees the new line → still snappy
(no extra API call).

### Item 3 — Tier 1 metric unification (~1 hour)
Three sub-tasks, ship as one commit:

**3a. Match verdict labels.** Website currently shows "DEGEN PLAY"
between APE and RUN. Extension shows "CAUTION". Pick CAUTION
everywhere — drop "DEGEN PLAY" from `index.html`. Search for
"DEGEN PLAY" in the file and replace with "CAUTION" wherever it
appears in user-facing text.

**3b. Smooth the score animation.** Currently the website's
`evaluate()` animates to a homegrown score (e.g., 53), then 600ms
later `syncHeadlineScoreWithApi` overrides to the API score
(e.g., 85) — visual jolt. Refactor: don't run the homegrown
animation at all. Show "Scanning…" placeholder, fetch /api/scan
in parallel with the existing flow, then animate ONCE to the API
score. Keep the homegrown sub-bars + max-ape-size + greens/reds
as supplemental context (they don't drive the headline).

**3c. Remove the redundant Contract Safety panel re-fetch.** The
website's `runContractSafety` makes its OWN GoPlus + Honeypot.is
calls duplicating /api/scan. Remove the panel entirely OR refactor
it to render from the /api/scan response we already have. The
extension's panel already shows these checks — having them twice
on the website in different formats is noise.

Acceptance: scan a token on the website → single coherent flow,
single score animation, no duplicate safety panel, same number
the extension shows.

### Item 4 — Three Free / Paid feature cards on homepage (~30 min)
Add a section to `index.html` BELOW the hero, ABOVE the scanner:
three side-by-side cards explicitly contrasting Free vs Paid.

Card 1: **KOLs**
- Free: ❌ See safety only
- Paid: ✅ Top 5 wallets ranked by engagement, tweet links, hover preview

Card 2: **X Activity**
- Free: ❌ —
- Paid: ✅ Tweets/24h, sentiment, coordinated-shilling detection

Card 3: **Watchlist**
- Free: ⭐ 5 saved tokens
- Paid: ⭐ Unlimited

Style consistent with the existing lore-card / token-page aesthetic.
Bottom of the section: a small "Hold $TRUSTY or subscribe ($5/mo)" CTA.

Acceptance: visible on homepage between the hero and the scanner,
mobile responsive.

### Item 5 — BNB Chain niche headline + meta (~15 min)
Replace the website hero subline "Scan any meme coin. Learn the
meta. Know before you ape." with something BNB-niche-positive:

```
The safety layer BNB Chain doesn't have. Built by the community.
Scan any meme coin · Learn the meta · Know before you ape.
```

Update the `<meta name="description">` to match. Keep the Bangers
display title intact.

Don't drop the multi-chain support — Solana etc. still works.
This is a **positioning** change, not a feature change.

Acceptance: hero copy + meta updated, no functional change.

## Don't ship without explicit user input

❌ **Worker deploys** — the user deploys to production. Make code
changes in `api/src/index.js` if needed but don't run
`npx wrangler deploy`. Document any worker changes in the commit
message so they know to deploy.

❌ **Chinese translation** — needs native speaker review. Don't
ship Chinese strings without that review even if the user mentions
wanting bilingual.

❌ **Anything touching NOWPayments / payment flow** — money flow
risk is real, only ship with explicit confirmation.

❌ **Real partner logos / outreach** — those are user-relationship
moves.

❌ **Web Store v0.4.0 re-submission** — admin task, user does in
the dashboard.

❌ **Strategic copy decisions** that require the user's voice
(launch tweet, full hero rewrites, marketing pages).

## Protocol

1. Read `NEXT.md` and this `HANDOFF.md` first.
2. Run the sanity check (Item 0).
3. Ship Item 1, commit + push, brief one-line confirmation.
4. Ship Item 2, commit + push.
5. Ship Item 3, commit + push.
6. Ship Item 4, commit + push.
7. Ship Item 5, commit + push.
8. Final summary message: what's done, what's blocked, anything
   that needs the user's attention.

For each commit: clear message, follow the conventional style
("Add X", "Remove Y", "Fix Z"). Co-author trailer included as
established earlier in this project's history.

If a regex doesn't match or a file has been modified since read,
DON'T ship a partial fix — re-read the file first, then make the
edit cleanly. Don't compound errors.

If something feels strategic (a copy decision, a UX call that
wasn't pre-defined here), STOP and add a note to `NEXT.md`.
Better to defer than to ship something the user didn't sign off
on.

## Open questions to leave for the user

- Decide between: **(a) Free click opens blurred panel (Item 1) only**, OR **(b) Free click opens blurred panel AND keeps the existing trustyai.tech tab as a secondary CTA inside the modal**. I lean toward (b) — preserves existing flow as a fallback. User can confirm tomorrow.
- BNB Chain headline wording — Item 5 has a draft. User may want to tweak. Ship the draft; they'll iterate.
- After Items 1-5 ship, ask user about: bilingual EN/中文 toggle, v0.4.0 zip + Web Store re-upload, NOWPayments payout addresses, Four.meme partnership outreach.

## Files to know about

- `api/src/index.js` — Cloudflare Worker, all endpoints
- `api/wrangler.toml` — Worker config + KV binding
- `extension/manifest.json` — extension config (currently v0.3.0)
- `extension/lib/pill-injector.js` — pill rendering + paid panel
- `extension/lib/api.js` — API client, in-memory caches
- `extension/lib/tier.js` — wallet + subscription tier resolution +
  watchlist helpers
- `extension/popup/popup.html|css|js` — toolbar popup
- `extension/content/x-content.js` — X-specific DOM hooks
- `extension/content/trustyai-bridge.js` — sub-id bridge (only on
  trustyai.tech)
- `extension/content/shared.css` — pill + tooltip + paid-panel
  styles (the largest CSS surface)
- `index.html` — homepage (single big file, lots of inline CSS/JS)
- `privacy/index.html` — privacy policy page
- `watchlist/index.html` — public watchlist viewer
- `NEXT.md` — long-term roadmap and deferred decisions
- `HANDOFF.md` — this file
