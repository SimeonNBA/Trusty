/* ================================================================
   Trusty AI — shared pill & tooltip module

   Used by every content script (x-content.js, reddit-content.js,
   dexscreener-content.js, …). Each platform handles its own DOM
   detection and just calls TrustyPill.create(ca, chain) to get a
   fully-wired pill element it can inject anywhere.

   Public API:
     TrustyPill.create(ca, chain)  → HTMLElement  (the pill)
     TrustyPill.markProcessed(el)  → mark a container scanned
     TrustyPill.isProcessed(el)    → check if already scanned
   ================================================================ */

(function () {
  "use strict";

  const PILL_CLASS = "trusty-pill";
  const TOOLTIP_ID = "trusty-tooltip";
  const PANEL_ID = "trusty-panel";
  const PANEL_BACKDROP_ID = "trusty-panel-backdrop";
  const PROCESSED_ATTR = "data-trusty-scanned";

  /* ── Cached tier (so we don't hit chrome.storage on every click) ── */
  let cachedTier = { tier: "free" };
  function refreshTier() {
    if (window.TrustyTier) {
      window.TrustyTier.getTier().then(function (t) { cachedTier = t || { tier: "free" }; });
    }
  }
  refreshTier();
  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function () { refreshTier(); });
    }
  } catch (e) { /* not in extension context */ }

  /* ── Tooltip state (one shared tooltip across all platforms) ── */
  let tooltipEl = null;
  let activePill = null;
  let hideTimer = null;

  function ensureTooltip() {
    if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.id = TOOLTIP_ID;
    tooltipEl.className = "trusty-tooltip";
    tooltipEl.setAttribute("role", "tooltip");
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function renderTooltipHtml(result) {
    const verdictClass = "trusty-tt-verdict-" + result.verdict.toLowerCase();
    const verdictEmoji =
      result.verdict === "APE" ? "🟢" :
      result.verdict === "CAUTION" ? "🟡" : "🔴";

    const checksHtml = result.checks.map(function (c) {
      const icon = c.ok ? "✅" : "❌";
      const cls = c.ok ? "trusty-tt-check-ok" : "trusty-tt-check-bad";
      return (
        '<li class="trusty-tt-check ' + cls + '">' +
          '<span class="trusty-tt-check-icon">' + icon + '</span>' +
          '<span class="trusty-tt-check-label">' + c.label + '</span>' +
        '</li>'
      );
    }).join("");

    const chainLabel = (result.chain || "EVM").toUpperCase();

    return (
      '<div class="trusty-tt-header ' + verdictClass + '">' +
        '<div class="trusty-tt-verdict">' + verdictEmoji + " " + result.verdict + '</div>' +
        '<div class="trusty-tt-score">' + result.score + '/100</div>' +
      '</div>' +
      '<div class="trusty-tt-meta">' +
        result.symbol +
        ' <span class="trusty-tt-chain">on ' + chainLabel + '</span>' +
      '</div>' +
      '<ul class="trusty-tt-checks">' + checksHtml + '</ul>' +
      '<div class="trusty-tt-footer">' +
        "Want KOL activity, X velocity and full breakdown?<br>" +
        "<strong>Hold $TRUSTY or upgrade for $5/mo</strong>" +
      '</div>'
    );
  }

  function positionTooltip(pill, tt) {
    const rect = pill.getBoundingClientRect();
    const ttRect = tt.getBoundingClientRect();
    const margin = 8;

    let top = rect.bottom + margin;
    let left = rect.left;

    if (top + ttRect.height > window.innerHeight - margin) {
      top = rect.top - ttRect.height - margin;
    }
    if (left + ttRect.width > window.innerWidth - margin) {
      left = window.innerWidth - ttRect.width - margin;
    }
    if (left < margin) left = margin;

    tt.style.top = top + "px";
    tt.style.left = left + "px";
  }

  function showTooltipFor(pill) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    const tt = ensureTooltip();
    if (!pill._trustyResult) {
      tt.innerHTML = '<div class="trusty-tt-loading">Scanning the chain…</div>';
    } else {
      tt.innerHTML = renderTooltipHtml(pill._trustyResult);
    }
    positionTooltip(pill, tt);
    tt.classList.add("show");
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove("show");
  }

  /* ── Pill ── */

  function applyResultToPill(pill, result) {
    pill.classList.remove(PILL_CLASS + "-loading");
    pill.classList.add(PILL_CLASS + "-" + result.verdict.toLowerCase());
    const score = pill.querySelector("." + PILL_CLASS + "-score");
    if (score) score.textContent = String(result.score);
    pill._trustyResult = result;
  }

  function onPillEnter(e) {
    activePill = e.currentTarget;
    showTooltipFor(activePill);
  }

  function onPillLeave() {
    activePill = null;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (!activePill) hideTooltip();
    }, 120);
  }

  function onPillClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const pill = e.currentTarget;
    const ca = pill.dataset.trustyCa;
    const chain = pill.dataset.trustyChain;
    const result = pill._trustyResult;

    // Paid users: open inline panel. Free: drive traffic to the website.
    if (cachedTier && cachedTier.tier === "paid") {
      openPaidPanel(result, ca, chain);
      return;
    }
    const url =
      "https://trustyai.tech/?ca=" + encodeURIComponent(ca) +
      "&chain=" + encodeURIComponent(chain) +
      "&utm_source=extension";
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /* ── Paid panel — full breakdown + KOLs + X activity ───────── */

  function closePaidPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
    const backdrop = document.getElementById(PANEL_BACKDROP_ID);
    if (backdrop) backdrop.remove();
    document.documentElement.style.overflow = "";
  }

  function openPaidPanel(result, ca, chain) {
    closePaidPanel();
    if (!result) {
      // Try fetching now if pill click happened before scan resolved
      if (window.TrustyAPI && window.TrustyAPI.scan) {
        window.TrustyAPI.scan(ca, chain).then(function (r) { openPaidPanel(r, ca, chain); });
      }
      return;
    }

    const backdrop = document.createElement("div");
    backdrop.id = PANEL_BACKDROP_ID;
    backdrop.className = "trusty-panel-backdrop";
    backdrop.addEventListener("click", closePaidPanel);
    document.body.appendChild(backdrop);

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "trusty-panel";

    const verdictClass = "trusty-tt-verdict-" + result.verdict.toLowerCase();
    const verdictEmoji =
      result.verdict === "APE" ? "🟢" :
      result.verdict === "CAUTION" ? "🟡" : "🔴";
    const chainLabel = (result.chain || "EVM").toUpperCase();

    const allChecks = (result.checks || []).concat(result.paidChecks || []);
    const checksHtml = allChecks.map(function (c) {
      const icon = c.ok ? "✅" : "❌";
      const cls = c.ok ? "trusty-tt-check-ok" : "trusty-tt-check-bad";
      return '<li class="trusty-tt-check ' + cls + '">' +
                '<span class="trusty-tt-check-icon">' + icon + '</span>' +
                '<span class="trusty-tt-check-label">' + c.label + '</span>' +
              '</li>';
    }).join("");

    const kolsHtml = (result.kols && result.kols.length) ? result.kols.map(function (k) {
      const ago = k.mins < 60 ? (k.mins + "m ago") :
                  k.mins < 1440 ? (Math.floor(k.mins / 60) + "h ago") :
                  (Math.floor(k.mins / 1440) + "d ago");
      return '<div class="trusty-pp-kol-row">' +
                '<span class="trusty-pp-kol-handle">' + k.handle + '</span>' +
                '<span class="trusty-pp-kol-followers">' + k.followers + '</span>' +
                '<span class="trusty-pp-kol-time">' + ago + '</span>' +
              '</div>';
    }).join("") : '<div class="trusty-pp-empty">No KOL mentions in the last 24h.</div>';

    const act = result.activity || {};
    const md = result.marketData || {};
    const deltaSign = act.deltaPct >= 0 ? "↑" : "↓";
    const deltaCls = act.deltaPct >= 0 ? "up" : "down";

    panel.innerHTML =
      '<button class="trusty-pp-close" aria-label="Close">✕</button>' +

      '<div class="trusty-pp-header ' + verdictClass + '">' +
        '<div class="trusty-pp-verdict">' + verdictEmoji + " " + result.verdict + '</div>' +
        '<div class="trusty-pp-score">' + result.score + '/100</div>' +
      '</div>' +
      '<div class="trusty-pp-meta">' + result.symbol +
        ' <span class="trusty-pp-chain">on ' + chainLabel + '</span></div>' +

      '<div class="trusty-pp-section">' +
        '<div class="trusty-pp-section-title">🛡️ Safety</div>' +
        '<ul class="trusty-tt-checks">' + checksHtml + '</ul>' +
      '</div>' +

      '<div class="trusty-pp-section">' +
        '<div class="trusty-pp-section-title">🐦 KOLs last 24h</div>' +
        kolsHtml +
      '</div>' +

      '<div class="trusty-pp-section">' +
        '<div class="trusty-pp-section-title">📈 X activity</div>' +
        '<div class="trusty-pp-stat-grid">' +
          '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + (act.tweets24h || 0).toLocaleString() + '</div><div class="trusty-pp-stat-lbl">tweets / 24h</div></div>' +
          '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num ' + deltaCls + '">' + deltaSign + ' ' + Math.abs(act.deltaPct || 0) + '%</div><div class="trusty-pp-stat-lbl">vs yesterday</div></div>' +
          '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + (act.sentiment || "—") + '</div><div class="trusty-pp-stat-lbl">sentiment</div></div>' +
          '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num ' + (act.coordShill ? 'down' : 'up') + '">' + (act.coordShill ? "DETECTED" : "Clean") + '</div><div class="trusty-pp-stat-lbl">coord. shill</div></div>' +
        '</div>' +
      '</div>' +

      '<div class="trusty-pp-section">' +
        '<div class="trusty-pp-section-title">📊 Market</div>' +
        '<div class="trusty-pp-stat-grid">' +
          '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + (md.mcap || "—") + '</div><div class="trusty-pp-stat-lbl">market cap</div></div>' +
          '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + (md.liquidity || "—") + '</div><div class="trusty-pp-stat-lbl">liquidity</div></div>' +
          '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + (md.age || "—") + '</div><div class="trusty-pp-stat-lbl">age</div></div>' +
          '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + (md.holders || 0).toLocaleString() + '</div><div class="trusty-pp-stat-lbl">holders</div></div>' +
        '</div>' +
      '</div>' +

      '<div class="trusty-pp-footer">' +
        'Open the full report on ' +
        '<a href="https://trustyai.tech/?ca=' + encodeURIComponent(ca) + '&chain=' + encodeURIComponent(chain) + '&utm_source=extension_paid" target="_blank" rel="noopener">trustyai.tech →</a>' +
      '</div>';

    document.body.appendChild(panel);
    panel.querySelector(".trusty-pp-close").addEventListener("click", closePaidPanel);
    document.documentElement.style.overflow = "hidden";

    // ESC to close
    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape") {
        closePaidPanel();
        document.removeEventListener("keydown", escHandler);
      }
    });
  }

  function create(ca, chain) {
    const pill = document.createElement("span");
    pill.className = PILL_CLASS + " " + PILL_CLASS + "-loading";
    pill.dataset.trustyCa = ca;
    pill.dataset.trustyChain = chain || "evm";
    pill.setAttribute("role", "button");
    pill.setAttribute("aria-label", "Trusty safety score for " + ca);

    const icon = document.createElement("span");
    icon.className = PILL_CLASS + "-icon";
    icon.textContent = "🛡️";

    const score = document.createElement("span");
    score.className = PILL_CLASS + "-score";
    score.textContent = "…";

    pill.appendChild(icon);
    pill.appendChild(score);

    if (window.TrustyAPI && window.TrustyAPI.scan) {
      window.TrustyAPI.scan(ca, chain)
        .then(function (result) { applyResultToPill(pill, result); })
        .catch(function (err) {
          console.warn("Trusty scan failed for", ca, err);
          pill.classList.remove(PILL_CLASS + "-loading");
          pill.classList.add(PILL_CLASS + "-error");
          score.textContent = "?";
        });
    }

    pill.addEventListener("mouseenter", onPillEnter);
    pill.addEventListener("mouseleave", onPillLeave);
    pill.addEventListener("click", onPillClick);

    return pill;
  }

  /* ── "Already processed" helpers (so platforms don't re-scan) ── */

  function markProcessed(el) {
    if (el && el.setAttribute) el.setAttribute(PROCESSED_ATTR, "1");
  }

  function isProcessed(el) {
    return el && el.getAttribute && el.getAttribute(PROCESSED_ATTR) === "1";
  }

  function isAncestorProcessed(el) {
    let parent = el && el.parentElement;
    while (parent && parent !== document.body) {
      if (isProcessed(parent)) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  /* ── Inline injection: walk text nodes, splice pills next to CAs ──
     Given a container element, finds CAs in its text and injects a
     pill IMMEDIATELY AFTER each CA occurrence, preserving the original
     text. Dedupes within the call so the same CA only gets one pill
     even if it appears in multiple text nodes. Skips text already
     inside our own injected pills.
     ────────────────────────────────────────────────────────────── */

  function injectInline(textEl) {
    if (!textEl || !window.TrustyCA) return 0;

    // First pass: collect all candidate text nodes (skip our own injection)
    const walker = document.createTreeWalker(
      textEl,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (!node.nodeValue || node.nodeValue.length < 32) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip text that's already inside a Trusty pill
          let p = node.parentElement;
          while (p && p !== textEl) {
            if (p.classList && p.classList.contains(PILL_CLASS)) {
              return NodeFilter.FILTER_REJECT;
            }
            p = p.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    const seen = new Set(); // dedupe across the whole container
    let injected = 0;

    textNodes.forEach(function (textNode) {
      const text = textNode.nodeValue;
      const found = window.TrustyCA.findContractAddresses(text);
      if (!found.length) return;

      // Build all match positions (lowercase indexOf so we hit the actual
      // string regardless of original case)
      const lowerText = text.toLowerCase();
      const matches = [];
      found.forEach(function (entry) {
        const lower = entry.ca.toLowerCase();
        if (seen.has(lower)) return;
        const idx = lowerText.indexOf(lower);
        if (idx === -1) return;
        seen.add(lower);
        matches.push({ idx: idx, len: entry.ca.length, ca: entry.ca, chain: entry.chain });
      });

      if (!matches.length) return;
      matches.sort(function (a, b) { return a.idx - b.idx; });

      // Build replacement fragment: text — CA text — pill — ... — trailing
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      matches.forEach(function (m) {
        if (m.idx > cursor) {
          fragment.appendChild(document.createTextNode(text.slice(cursor, m.idx)));
        }
        // Preserve the original CA text exactly as it appeared
        fragment.appendChild(document.createTextNode(text.slice(m.idx, m.idx + m.len)));
        // Insert the pill right after the CA
        fragment.appendChild(create(m.ca, m.chain));
        cursor = m.idx + m.len;
        injected++;
      });
      if (cursor < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    });

    return injected;
  }

  // Hide tooltip on global scroll/blur (one listener for the whole extension)
  window.addEventListener("scroll", hideTooltip, { passive: true, capture: true });
  window.addEventListener("blur", hideTooltip);

  window.TrustyPill = {
    create: create,
    injectInline: injectInline,
    markProcessed: markProcessed,
    isProcessed: isProcessed,
    isAncestorProcessed: isAncestorProcessed,
    PROCESSED_ATTR: PROCESSED_ATTR
  };
})();
