/* ================================================================
   Trusty AI — reddit.com content script

   Reddit's DOM has changed several times — old.reddit, new.reddit,
   sh.reddit web components — so we use a flexible set of selectors
   and append a pill into whichever container we find.

   Same pattern as x-content.js: detect → process → inject pill from
   the shared TrustyPill module.
   ================================================================ */

(function () {
  "use strict";

  console.log(
    "%c🛡️ Trusty AI loaded on " + location.hostname,
    "background:#3B82F6;color:white;padding:4px 8px;border-radius:4px;font-weight:bold;"
  );

  /* ── Container detection ──────────────────────────────────────
     We look for any of these as a "scannable text container":
       • Old reddit:  .md inside .entry (post body or comment)
       • New reddit:  [data-test-id="post-content"] / [data-testid="post-content"]
       • New reddit:  [data-testid="comment"]
       • Sh.reddit:   shreddit-post / shreddit-comment text bodies
     We try them all and dedupe via the PROCESSED_ATTR marker.
     ────────────────────────────────────────────────────────────── */

  // Selectors for "scannable text containers" across Reddit's many DOMs.
  // Crucially, we list the INNERMOST container per platform so we don't
  // double-process when a parent + child both match.
  const CONTAINER_SELECTORS = [
    // Old reddit (post body or comment body)
    "div.md",
    // New reddit React
    '[data-test-id="post-content"]',
    '[data-testid="post-content"]',
    '[data-testid="comment-content"]',
    // Sh.reddit web components — slot for the rendered body
    "shreddit-post [slot='text-body']",
    "shreddit-comment [slot='comment']"
  ].join(", ");

  function processContainer(el) {
    if (!el) return;
    if (window.TrustyPill.isProcessed(el)) return;
    // Skip if any ancestor was already processed (defensive — handles
    // edge cases where two selectors still match nested containers)
    if (window.TrustyPill.isAncestorProcessed(el)) return;
    window.TrustyPill.markProcessed(el);

    // Inline injection — pill goes right next to the CA text
    window.TrustyPill.injectInline(el);
  }

  function scanAll() {
    document.querySelectorAll(CONTAINER_SELECTORS).forEach(processContainer);
  }

  /* ── Observer ─────────────────────────────────────────────── */

  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      scanAll();
    });
  }

  const observer = new MutationObserver(function () { scheduleScan(); });
  observer.observe(document.body, { childList: true, subtree: true });

  scanAll();
})();
