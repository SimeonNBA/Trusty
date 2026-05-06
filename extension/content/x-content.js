/* ================================================================
   Trusty AI — X.com / twitter.com content script

   Detects contract addresses inside tweets and injects a Trusty
   score pill next to each one. All pill creation, tooltip rendering,
   and click handling lives in lib/pill-injector.js — this file only
   knows where tweets are in X's DOM.
   ================================================================ */

(function () {
  "use strict";

  console.log(
    "%c🛡️ Trusty AI loaded on " + location.hostname,
    "background:#3B82F6;color:white;padding:4px 8px;border-radius:4px;font-weight:bold;"
  );

  /* ── Tweet processing ─────────────────────────────────────── */

  function processTweet(tweetEl) {
    if (window.TrustyPill.isProcessed(tweetEl)) return;
    window.TrustyPill.markProcessed(tweetEl);

    const textEls = tweetEl.querySelectorAll(
      '[data-testid="tweetText"], [data-testid="card.layoutLarge.detail"]'
    );

    textEls.forEach(function (textEl) {
      if (window.TrustyPill.isProcessed(textEl)) return;
      window.TrustyPill.markProcessed(textEl);
      // Inline injection: pill sits right next to the CA text in the tweet
      window.TrustyPill.injectInline(textEl);
    });
  }

  /* ── Observer ─────────────────────────────────────────────── */

  function scanAllTweets() {
    document.querySelectorAll('article[data-testid="tweet"]').forEach(processTweet);
  }

  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      scanAllTweets();
    });
  }

  const observer = new MutationObserver(function () { scheduleScan(); });
  observer.observe(document.body, { childList: true, subtree: true });

  scanAllTweets();
})();
