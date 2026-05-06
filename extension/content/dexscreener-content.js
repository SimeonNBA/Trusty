/* ================================================================
   Trusty AI — dexscreener.com content script

   Two modes of injection:

   1) ROW MODE — for the trending list, watchlist, search results, etc.
      DexScreener wraps each entire row in a giant <a> tag. We detect
      that "this anchor is a row" by size/children, then inject the
      pill INSIDE the anchor right after the token logo image. The
      pill ends up next to the token name, not in the gap between rows.

   2) PAGE MODE — for the token page itself (e.g. /bsc/0x...).
      The current page does not link to itself, so there's no anchor
      to attach to. Instead we add a small floating pill pinned to
      the top-centre of the viewport, derived from the URL. It updates
      automatically as the user navigates between tokens.
   ================================================================ */

(function () {
  "use strict";

  console.log(
    "%c🛡️ Trusty AI loaded on " + location.hostname,
    "background:#3B82F6;color:white;padding:4px 8px;border-radius:4px;font-weight:bold;"
  );

  const PAGE_PILL_ID = "trusty-page-pill";

  // Whitelist of DexScreener chain slugs.
  const KNOWN_CHAINS = new Set([
    "bsc", "ethereum", "base", "solana", "polygon", "arbitrum",
    "avalanche", "optimism", "fantom", "cronos", "zksync", "pulse",
    "tron", "sui", "ton", "mantle", "linea", "scroll", "blast",
    "celo", "kava", "aurora", "xdai", "osmosis", "injective",
    "hyperevm", "abstract", "berachain", "movement", "monad", "sonic",
    "manta", "metis", "moonbeam", "moonriver", "harmony", "klaytn",
    "okxchain", "opbnb", "core"
  ]);

  /* ── Anchor parsing ───────────────────────────────────────── */

  function parsePathToken(pathname) {
    const m = pathname.match(
      /^\/([a-z0-9-]+)\/(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})(?:[\/?#]|$)/i
    );
    if (!m) return null;
    const chain = m[1].toLowerCase();
    if (!KNOWN_CHAINS.has(chain)) return null;
    return { chain: chain, ca: m[2] };
  }

  function parseAnchor(a) {
    if (!a || !a.href) return null;
    let pathname;
    try {
      pathname = new URL(a.href, location.origin).pathname;
    } catch (e) {
      return null;
    }
    return parsePathToken(pathname);
  }

  /* ── Row detection + injection ────────────────────────────── */

  function injectIntoAnchor(a, pill) {
    // Row heuristic: anchor is wide AND has multiple children
    const isRow = a.children && a.children.length > 1;

    if (isRow) {
      // Inject inside, right after the first <img> (the token logo).
      // Falls back to prepending if no image is found.
      const img = a.querySelector("img");
      if (img && img.parentNode) {
        if (img.nextSibling) {
          img.parentNode.insertBefore(pill, img.nextSibling);
        } else {
          img.parentNode.appendChild(pill);
        }
        return;
      }
      // Fallback: place at the very start of the anchor's content
      if (a.firstChild) {
        a.insertBefore(pill, a.firstChild);
      } else {
        a.appendChild(pill);
      }
      return;
    }

    // Inline anchor (small text link) — inject as sibling AFTER the anchor
    if (a.nextSibling) {
      a.parentNode.insertBefore(pill, a.nextSibling);
    } else {
      a.parentNode.appendChild(pill);
    }
  }

  function processLink(a) {
    if (window.TrustyPill.isProcessed(a)) return;
    const info = parseAnchor(a);
    if (!info) return;

    window.TrustyPill.markProcessed(a);
    const pill = window.TrustyPill.create(info.ca, info.chain);
    injectIntoAnchor(a, pill);
  }

  function scanAllAnchors() {
    document.querySelectorAll("a[href]").forEach(processLink);
  }

  /* ── Page-mode pill (token page) ──────────────────────────── */

  // Try to inject a pill INTO the right panel's breadcrumb row
  // (the "BSC > PancakeSwap V2" line). Returns true on success.
  function tryInjectInBreadcrumb(info) {
    // Find the chain anchor that matches the current page's chain
    const anchors = document.querySelectorAll("a[href]");
    let breadcrumbAnchor = null;

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      let pathname;
      try {
        pathname = new URL(a.href, location.origin).pathname;
      } catch (e) {
        continue;
      }
      // Match chain-only path: /bsc, /ethereum, etc — no token after
      if (!/^\/[a-z0-9]+$/i.test(pathname)) continue;
      const slug = pathname.slice(1).toLowerCase();
      if (slug !== info.chain) continue;

      const rect = a.getBoundingClientRect();
      if (rect.width === 0) continue;
      if (rect.top > 250 || rect.top < 20) continue;
      // Must be in right portion of viewport (right panel)
      if (rect.right < window.innerWidth * 0.5) continue;

      breadcrumbAnchor = a;
      break;
    }

    if (!breadcrumbAnchor) return false;

    // Walk up to find the flex row that holds the breadcrumb
    let row = breadcrumbAnchor.parentElement;
    let attempts = 0;
    while (row && row !== document.body && attempts < 5) {
      const rect = row.getBoundingClientRect();
      // A modest-height row that holds at least 2 children (chain + dex link)
      if (rect.height >= 18 && rect.height <= 60 && row.children.length >= 2) {
        // Skip if a Trusty pill is already a child
        if (row.querySelector("." + "trusty-pill")) return true;
        const pill = window.TrustyPill.create(info.ca, info.chain);
        pill.style.marginLeft = "8px";
        pill.style.flexShrink = "0";
        row.appendChild(pill);
        return true;
      }
      row = row.parentElement;
      attempts++;
    }

    return false;
  }

  function removeFloatingPill() {
    const widget = document.getElementById(PAGE_PILL_ID);
    if (widget) widget.remove();
  }

  function ensureFloatingPill(info) {
    let widget = document.getElementById(PAGE_PILL_ID);
    if (widget && widget.dataset.ca === info.ca && widget.dataset.chain === info.chain) {
      return;
    }
    if (widget) widget.remove();
    widget = document.createElement("div");
    widget.id = PAGE_PILL_ID;
    widget.dataset.ca = info.ca;
    widget.dataset.chain = info.chain;
    widget.appendChild(window.TrustyPill.create(info.ca, info.chain));
    document.body.appendChild(widget);
  }

  function ensurePagePill() {
    const info = parsePathToken(location.pathname);
    if (!info) {
      removeFloatingPill();
      return;
    }

    // Prefer inline injection into the breadcrumb row.
    // Only fall back to a floating pill if DOM injection fails.
    const injected = tryInjectInBreadcrumb(info);
    if (injected) {
      removeFloatingPill();
      return;
    }
    ensureFloatingPill(info);
  }

  /* ── Observer / scheduler ─────────────────────────────────── */

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      scanAllAnchors();
      ensurePagePill();
    });
  }

  const observer = new MutationObserver(function () { schedule(); });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial pass
  scanAllAnchors();
  ensurePagePill();
})();
