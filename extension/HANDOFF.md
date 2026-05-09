# Trusty AI — Handoff for New Chat

Paste this into the first message of a fresh Claude chat to continue
work without rebuilding context. ~500 words, captures everything that
matters about the current state.

---

## CONTEXT FOR CLAUDE (paste this)

I'm building **Trusty AI**, a Chrome extension that's the v2 of my BNB
Chain meme-coin scanner. The v1 is a website at trustyai.tech (separate
repo: `D:\Trusty-AI\frontend\` → github.com/SimeonNBA/Trusty). The
extension is separate: `D:\Trusty-Extension\` → its own private GitHub
repo (`trusty-extension`).

**$TRUSTY** is a community-takeover meme coin around the blue shield
mascot from Trust Wallet's 2019 marketing. Not affiliated with Trust
Wallet. Fair launch, 100% LP burned. Contract:
`0x65aea108c21439693468FCD542D81C29E8df4444` on BNB Smart Chain.

### Current state of the extension (v0.1.0, 14 commits on `main`)

**What works end-to-end:**
- Manifest V3, vanilla JS (no framework, no build step)
- Inline Trusty score pills on x.com / twitter.com / reddit.com /
  dexscreener.com next to every contract address
- Hover tooltip with 5 plain-English safety checks (free tier)
- Click → free users open trustyai.tech, paid users get an inline
  floating panel with full breakdown + KOLs + X activity + market data
- Paid tier via NOWPayments crypto-pay subscription ($5/mo or $50/yr).
  Popup creates an invoice via `/api/subscribe`, opens hosted checkout,
  polls `/api/subscription` until paid. Status cached in
  `chrome.storage.local`.

**What's stubbed (intentional, swap-to-real later):**
- `lib/api.js` `scan()` returns deterministic mock data (score, checks,
  KOLs, X activity, market data) based on a hash of the CA. Real
  endpoint at `trustyai.tech/api/scan` doesn't exist yet — it's a
  one-line swap when the backend is ready.

### File layout
```
trusty-extension/
├── manifest.json
├── background/service-worker.js
├── content/x-content.js, reddit-content.js, dexscreener-content.js,
│           shared.css, dexscreener-content.css
├── lib/ca-detector.js (regex), api.js (scan via /api/scan),
│       tier.js (NOWPayments subscription + watchlist),
│       pill-injector.js (shared pill + tooltip + paid panel)
├── popup/popup.html, popup.css, popup.js
├── assets/icon-16/48/128.png, icon.svg, icon-generator.html
├── README.md, PRIVACY.md, STORE_LISTING.md, SCREENSHOTS.md, .gitignore
```

### Conventions established
- All Trusty UI classes prefixed `trusty-` to avoid host site conflicts
- CSS uses `!important` strategically on font-family inside Trusty UI
  to defeat host site overrides
- MutationObserver on `document.body` watches for new content; debounced
  via `requestAnimationFrame`
- `TrustyPill.create(ca, chain)` is the single entry point; platform
  scripts only handle DOM detection
- `data-trusty-scanned="1"` marker prevents reprocessing
- `TrustyPill.injectInline(textEl)` walks text nodes via TreeWalker,
  splits at CA matches, inserts pill right after the CA text
- Tier cached in memory in pill-injector; refreshed on
  `chrome.storage.onChanged`

### What's NOT yet shipped (potential next work)
- Day 6: submit to Chrome Web Store (manual user action,
  STORE_LISTING.md + SCREENSHOTS.md ready)
- Real backend `/api/scan` endpoint on trustyai.tech (currently mock)
- TweetScout API integration for real KOL data ($49/mo)
- LunarCrush sentiment ($30/mo, optional)
- NOWPayments crypto-pay flow (alternative to token-gating)
- Paid-tier hover tease ("12 KOLs · ↑340% velocity · click for full")
  — currently paid hover and free hover are identical
- Alpha-alert pulse on pill when a tier-1 KOL tweets a CA in last 30m
- Watchlist sync between extension and trustyai.tech
- Telegram Web, Discord, Farcaster content scripts
- Inline injection on DexScreener token-page title (right panel) —
  currently a floating top-right pill at top:90/right:16

### Decisions already made (don't relitigate)
- Manifest V3, vanilla JS, no build step. Simplicity over framework.
- Subscription-only paid tier via NOWPayments. No on-chain hold path
  (removed pre-launch — bypassable without signature verification).
- No fiat / Stripe (compliance risk for a community project).
- Cashtags ($PEPE etc.) intentionally NOT detected — too ambiguous,
  resolving to wrong contract is dangerous.
- Pill always sits inline next to CA, not at end of text container.
- Free click → website (drives traffic). Paid click → inline panel.
- Paid tier: $5/month or $50/year via NOWPayments. Status polled from
  `/api/subscription`, cached locally. 30-day or 365-day expiry per plan.

### How I work
- I sanity-check before code. No "stupid mistakes" like inventing a
  shield mascot when one already exists in the repo.
- I use TodoWrite for any multi-step work.
- I commit with descriptive messages. Branch is `main`, no PRs needed.
- I keep file structure flat and readable. No unnecessary tooling.

What I'd like to do next: [you fill this in]

---

## Why I'm starting a new chat

The previous chat was at 80% context. Day 1–5 of the MVP are
shipped. Continuing in a fresh chat keeps the next iteration efficient.
