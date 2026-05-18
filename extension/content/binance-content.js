/* ================================================================
   Trusty AI — Binance Square content script

   Scans Binance Square posts for contract addresses and reports them
   to the worker so it can aggregate Square sentiment per token. That
   sentiment is then surfaced in the X paid panel alongside X velocity.

   NOTE — pill injection on Square pages was tried and dropped: Binance
   ships obfuscated React class names that change between pages and
   releases, so a stable selector set is impractical. The user value
   (cross-platform sentiment) is fully captured by the report-only
   path, which doesn't depend on the DOM structure at all.

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

  /* ── Mention reporting helpers ──────────────────────────────
     For each Square post containing a CA, send an anonymous mention
     event to the worker. Worker classifies sentiment server-side and
     aggregates per CA in a 24h window. Raw post text leaves the
     browser only for classification; it's never persisted long-term. */

  function extractPostId(postEl) {
    // Real post IDs from anchor href: /en/square/post/<ID>
    const link = postEl.querySelector("a[href*='/square/post/']");
    if (link && link.href) {
      const m = link.href.match(/\/square\/post\/([^/?#]+)/);
      if (m && m[1]) return m[1];
    }
    // Fallback: stable text-content hash. Same post → same hash → dedup
    // works even without a real ID. Worker drops duplicate post IDs.
    const txt = (postEl.textContent || "").slice(0, 200);
    let h = 5381;
    for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) >>> 0;
    return "h_" + h.toString(36);
  }

  function extractEngagement(postEl) {
    // Best-effort: sum visible engagement counts (likes + comments + reposts).
    // Square's DOM doesn't expose these via semantic selectors, so we
    // approximate by collecting numbers from button-like elements with
    // values typical of engagement counts. If we can't find them, default
    // to 0 — the sentiment classifier doesn't strictly require engagement.
    let total = 0;
    const btns = postEl.querySelectorAll("button, [role='button'], [class*='engage']");
    btns.forEach(function (btn) {
      const txt = (btn.textContent || "").trim();
      // Match shorthand counts like "1.2K", "523", "42"
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

  function detectCAsInText(text) {
    if (!text || !window.TrustyCA || !window.TrustyCA.findContractAddresses) return [];
    return window.TrustyCA.findContractAddresses(text);
  }

  // Track posts we've already reported to avoid duplicate sentiment
  // events on mutation-observer re-fires. Worker also dedups by postId,
  // so this is just bandwidth-saving.
  const reportedPosts = new WeakSet();

  function processPost(postEl) {
    if (!postEl) return;
    if (reportedPosts.has(postEl)) return;

    // Report sentiment mention(s) for the worker to aggregate.
    // Only fires if the post contains at least one CA — we never report
    // CA-free posts to the worker.
    const text = postEl.textContent || "";
    const found = detectCAsInText(text);
    if (!found.length) {
      // Mark it processed anyway so we don't re-scan empty posts on
      // every mutation tick.
      reportedPosts.add(postEl);
      return;
    }

    const postId = extractPostId(postEl);
    const engagement = extractEngagement(postEl);
    const seenInThisPost = new Set(); // dedup CAs within a single post
    for (const entry of found) {
      const key = (entry.ca || "").toLowerCase();
      if (!key || seenInThisPost.has(key)) continue;
      seenInThisPost.add(key);
      if (window.TrustyAPI && window.TrustyAPI.reportSquareMention) {
        window.TrustyAPI.reportSquareMention(entry.ca, entry.chain, postId, text, engagement);
      }
    }
    reportedPosts.add(postEl);
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
