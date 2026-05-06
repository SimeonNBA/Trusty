# Trusty — Chrome Extension

The browser-native safety layer for BNB Chain meme coins.

Detects contract addresses on supported sites (X, Reddit, DexScreener, more)
and shows a one-click safety verdict — Ape, Caution, or Run — sourced from
the Trusty AI scanner at [trustyai.tech](https://trustyai.tech).

This is the **v2 client** of the Trusty product. The web app at
trustyai.tech is the v1.

---

## Status

**Day 1 of MVP** — manifest, content-script scaffold, popup shell.
Functional CA detection and pill injection ship in Day 2-3.

## Local install (developer mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select this folder: `D:\Trusty-Extension\`
5. The Trusty icon should appear in your toolbar
6. Visit `x.com` — open DevTools console — you should see a blue "🛡️ Trusty loaded on x.com" log

## First-time icon setup

Chrome wants PNG icons at 16/48/128 pixels. To generate them:

1. Open `assets/icon-generator.html` in any normal browser
2. Click **Generate & download all 3**
3. Save the 3 files into `assets/` (overwriting any existing ones)
4. Reload the extension at `chrome://extensions/`

(Headless Chrome can't render SVG-to-PNG reliably on this machine, so this is the simplest route.)

## File layout

```
trusty-extension/
├── manifest.json               # Manifest V3 entry point
├── background/
│   └── service-worker.js       # MV3 background script (lifecycle events)
├── content/
│   ├── x-content.js            # Content script for x.com / twitter.com
│   └── x-content.css           # Styles for in-tweet UI (pill injection)
├── lib/
│   └── ca-detector.js          # Shared CA-regex utilities
├── popup/
│   ├── popup.html              # Toolbar-icon popup
│   ├── popup.css
│   └── popup.js
├── assets/
│   ├── icon.svg                # Source artwork
│   ├── icon-generator.html     # One-time PNG generator
│   ├── icon-16.png             # Generated
│   ├── icon-48.png             # Generated
│   └── icon-128.png            # Generated
├── README.md
├── PRIVACY.md
└── .gitignore
```

## Roadmap (the 7-day MVP sprint)

| Day | Goal |
|-----|------|
| 1   | ✅ Scaffold, manifest, smoke-test content script, popup shell |
| 2   | CA regex detection + console log of CAs on real tweets |
| 3   | Pill injection next to each detected CA, click handler |
| 4   | Verdict popover wired to `trustyai.tech/api/scan` |
| 5   | Privacy policy review, Chrome Web Store screenshots, listing copy |
| 6   | Submit to Chrome Web Store |
| 7   | Buffer for review + polish |

## Tech choices

- **Manifest V3** — Chrome's current standard. Works on Edge, Brave, Opera.
- **Plain JS** — no framework, no bundler, no build step. Faster to ship,
  zero dependency drift.
- **Vanilla CSS** — single stylesheet for the popup; per-platform CSS for
  injected UI.

## Project links

- **Web app:** [trustyai.tech](https://trustyai.tech)
- **X:** [@Trusty_BSC](https://x.com/Trusty_BSC)
- **Telegram:** [t.me/TRUSTYCTO](https://t.me/TRUSTYCTO)
- **Token contract:** `0x65aea108c21439693468FCD542D81C29E8df4444` (BNB Smart Chain)

## Disclaimer

$TRUSTY is a community project. Not affiliated with or endorsed by Trust Wallet.
This extension is for informational purposes only. Not financial advice. DYOR.

## License

MIT
