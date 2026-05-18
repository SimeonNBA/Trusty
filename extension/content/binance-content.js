/* ================================================================
   Trusty AI — Binance Square content script

   Scans Binance Square pages for token mentions and reports them to
   the worker so it can aggregate cross-platform sentiment. The
   aggregated sentiment surfaces in the X paid panel alongside X
   velocity (see /api/kols → squareActivity field).

   Approach: scan document.body.innerText on every meaningful
   mutation. Binance's React app re-mints class names on every
   release, so we don't rely on post-container selectors anymore —
   we just look at the text the page renders. Three detection paths
   fire independently per page:

     1. Raw contract addresses (0x... and base58)
     2. Cashtags ($TICKER)
     3. Hashtags (#ticker)

   For (2) and (3) the worker resolves the ticker → CA via its
   scan-history symref table. Tickers that don't match any known
   token (generic English hashtags like #crypto) are silently
   ignored server-side.

   Dedup: per (URL, ca-or-ticker) pair, per page session — a single
   page-view never reports the same token twice no matter how many
   times React re-renders. Worker has its own (postId, ca) dedup with
   a 7-day TTL so refreshes don't double-count either.
   ================================================================ */

(function () {
  "use strict";

  console.log(
    "%c🛡️ Trusty AI loaded on " + location.hostname + location.pathname,
    "background:#F0B90B;color:#0a0f1c;padding:4px 8px;border-radius:4px;font-weight:bold;"
  );

  // Per-session report cache — survives mutation re-fires but resets
  // on page navigation (see path-change handler below).
  const reported = new Set();

  // URL-derived postId. For /square/post/<id> URLs we use the actual
  // post id so worker-side dedup is stable across refreshes; for
  // other Square views (feed, profile, hashtag pages) we fall back to
  // a tiny hash of the path so each distinct page still dedups.
  function urlAsPostId() {
    const path = location.pathname || "";
    const m = path.match(/\/square\/post\/([^/?#]+)/);
    if (m && m[1]) return m[1];
    let h = 5381;
    for (let i = 0; i < path.length; i++) {
      h = ((h << 5) + h + path.charCodeAt(i)) >>> 0;
    }
    return "pg_" + h.toString(36);
  }

  // Best-effort engagement total — sums numeric labels on visible
  // engagement buttons (likes, comments, reposts). Square doesn't
  // expose these via semantic selectors so we approximate. Defaults
  // to 0 if nothing matches; the worker's sentiment classifier
  // doesn't strictly require engagement.
  function estimateEngagement() {
    let total = 0;
    const btns = document.querySelectorAll("button, [role='button'], [class*='engage']");
    btns.forEach(function (btn) {
      const txt = (btn.textContent || "").trim();
      const m = txt.match(/^(\d+(\.\d+)?)\s*([KM])?$/);
      if (m) {
        let n = parseFloat(m[1]);
        if (m[3] === "K") n *= 1000;
        else if (m[3] === "M") n *= 1000000;
        if (n > 0 && n < 10000000) total += Math.floor(n);
      }
    });
    return total;
  }

  function scanPage() {
    if (!window.TrustyCA || !window.TrustyAPI) return;
    const text = (document.body && document.body.innerText) || "";
    // Skip until the React app has actually rendered something
    // meaningful — saves a no-op POST during the initial blank frame.
    if (text.length < 40) return;

    const postId = urlAsPostId();
    const cas = window.TrustyCA.findContractAddresses(text);
    const tickers = window.TrustyCA.findTickerSymbols
      ? window.TrustyCA.findTickerSymbols(text) : [];

    if (!cas.length && !tickers.length) return;

    const engagement = estimateEngagement();

    // CA path
    for (const entry of cas) {
      const ca = (entry.ca || "").toLowerCase();
      const key = "ca:" + postId + ":" + ca;
      if (reported.has(key)) continue;
      reported.add(key);
      if (window.TrustyAPI.reportSquareMention) {
        window.TrustyAPI.reportSquareMention(entry.ca, entry.chain, postId, text, engagement);
      }
    }

    // Ticker path — worker filters tickers without a symref match
    for (const sym of tickers) {
      const u = String(sym || "").toUpperCase();
      if (!u) continue;
      const key = "tk:" + postId + ":" + u;
      if (reported.has(key)) continue;
      reported.add(key);
      if (window.TrustyAPI.reportSquareTicker) {
        window.TrustyAPI.reportSquareTicker(u, postId, text, engagement);
      }
    }
  }

  // SPA route change detection. Square is a client-side router so
  // location.pathname changes without a full page load. When it does,
  // clear the reported set so the new page can record its own mentions.
  let lastPath = location.pathname;
  function checkPathChange() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      reported.clear();
    }
  }

  // rAF-coalesced scan trigger — observer fires constantly during
  // hydration; we collapse bursts into one scan per frame.
  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      checkPathChange();
      scanPage();
    });
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Initial scan + a couple of delayed re-scans to catch React's
  // first render. The MutationObserver handles everything after that.
  scanPage();
  setTimeout(scanPage, 800);
  setTimeout(scanPage, 2500);
})();
