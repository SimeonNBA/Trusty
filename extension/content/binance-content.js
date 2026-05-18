/* ================================================================
   Trusty AI — Binance Square content script

   Detects contract addresses inside Binance Square posts and injects
   a Trusty score pill next to each one. Mirrors x-content.js — only
   the DOM selectors differ.

   Square is a SPA, so we observe mutations on body to catch posts
   added after initial render (infinite scroll, route changes).
   ================================================================ */

(function () {
  "use strict";

  console.log(
    "%c🛡️ Trusty AI loaded on " + location.hostname + "/square",
    "background:#F0B90B;color:#0a0f1c;padding:4px 8px;border-radius:4px;font-weight:bold;"
  );

  /* ── Post discovery ─────────────────────────────────────────
     Square's DOM uses multiple class-name conventions and has changed
     a few times. Rather than depending on one selector, we try the
     known patterns + the semantic `article` fallback. injectInline()
     handles deduplication so a post matched by multiple selectors
     gets processed once. */

  const POST_SELECTORS = [
    "article",                          // semantic HTML
    "[role='article']",                 // ARIA fallback
    "[class*='postCard']",              // Binance React conventions
    "[class*='post-card']",
    "[class*='PostCard']",
    "[class*='feedItem']",
    "[class*='feed-item']",
    "[data-bn-type='post']",            // Binance internal data attribute
    "[data-testid*='post']",            // testid pattern
  ];

  function findPostContainers() {
    return Array.from(document.querySelectorAll(POST_SELECTORS.join(",")));
  }

  function processPost(postEl) {
    if (!postEl) return;
    if (window.TrustyPill.isProcessed(postEl)) return;
    window.TrustyPill.markProcessed(postEl);
    // injectInline walks the post's text nodes, finds CAs, and inserts
    // a pill right after each one. Same module used on X — zero new
    // pill rendering code needed here.
    window.TrustyPill.injectInline(postEl);
  }

  function scanAllPosts() {
    findPostContainers().forEach(processPost);
  }

  /* ── Mutation observer ──────────────────────────────────────
     Same rAF-throttled pattern as x-content.js: coalesce bursts of
     mutations into a single scan per animation frame. Avoids
     hammering on infinite-scroll feeds. */

  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      scanAllPosts();
    });
  }

  const observer = new MutationObserver(function () { scheduleScan(); });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial scan (in case some posts are present at document_idle)
  scanAllPosts();
})();
