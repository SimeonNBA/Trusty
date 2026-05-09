/* ================================================================
   Trusty AI — shared pill & tooltip module

   Used by the X content script (x-content.js). Each platform
   that adds support handles its own DOM
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

  // Decorative placeholders shown only in the BLURRED paid-panel for
  // free users — gives the blur shape so the user sees the structure
  // of what they'd unlock. Never shown un-blurred.
  const BLURRED_PLACEHOLDER_KOLS = [
    { handle: "@cz_binance", followers: "9.2M", likes: 1240, retweets: 327, replies: 89, mins: 18 },
    { handle: "@runecrypto_", followers: "280K", likes: 412, retweets: 98, replies: 31, mins: 47 },
    { handle: "@MarcellxMarcell", followers: "145K", likes: 287, retweets: 64, replies: 22, mins: 95 },
    { handle: "@bnb_alpha", followers: "67K", likes: 156, retweets: 34, replies: 12, mins: 180 },
    { handle: "@meme_chad_bsc", followers: "32K", likes: 78, retweets: 19, replies: 6, mins: 320 },
  ];
  const BLURRED_PLACEHOLDER_ACTIVITY = {
    tweets24h: 248,
    deltaPct: 340,
    sentiment: "78% bullish",
    coordShill: false,
  };

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
    const md = result.marketData || {};
    const mcap = md.mcap || "—";
    const vol = md.volume24h || "—";

    return (
      '<div class="trusty-tt-header ' + verdictClass + '">' +
        '<div class="trusty-tt-verdict">' + verdictEmoji + " " + result.verdict + '</div>' +
        '<div class="trusty-tt-score">' + result.score + '/100</div>' +
      '</div>' +
      '<div class="trusty-tt-meta">' +
        result.symbol +
        ' <span class="trusty-tt-chain">on ' + chainLabel + '</span>' +
      '</div>' +
      '<div class="trusty-tt-market">' +
        '<div class="trusty-tt-market-cell">' +
          '<div class="trusty-tt-market-num">' + mcap + '</div>' +
          '<div class="trusty-tt-market-lbl">Market Cap</div>' +
        '</div>' +
        '<div class="trusty-tt-market-divider"></div>' +
        '<div class="trusty-tt-market-cell">' +
          '<div class="trusty-tt-market-num">' + vol + '</div>' +
          '<div class="trusty-tt-market-lbl">Vol 24h</div>' +
        '</div>' +
      '</div>' +
      '<ul class="trusty-tt-checks">' + checksHtml + '</ul>' +
      '<div class="trusty-tt-tease">' +
        '<span class="trusty-tt-tease-icon">🐦</span>' +
        '<span class="trusty-tt-tease-text">KOL activity · X velocity · sentiment</span>' +
        '<span class="trusty-tt-tease-lock">🔒</span>' +
      '</div>' +
      '<div class="trusty-tt-footer">' +
        "<strong>Upgrade for $5/mo or $50/yr</strong>" +
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

    // Anonymous trending signal — record that someone clicked through
    // on this CA. Click is a stronger intent signal than hover.
    if (window.TrustyAPI && window.TrustyAPI.reportEvent) {
      window.TrustyAPI.reportEvent("scan", ca, chain);
    }

    // Paid users: full inline panel. Free users: same panel, but the
    // KOL handles + activity numbers are blurred behind an upgrade
    // overlay. They literally see the structure of what they're missing.
    const isPaid = cachedTier && cachedTier.tier === "paid";
    openPaidPanel(result, ca, chain, { blurred: !isPaid });
  }

  /* ── Paid panel — full breakdown + KOLs + X activity ───────── */

  function closePaidPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
    const backdrop = document.getElementById(PANEL_BACKDROP_ID);
    if (backdrop) backdrop.remove();
    document.documentElement.style.overflow = "";
    if (kolPreviewEl) { kolPreviewEl.remove(); kolPreviewEl = null; }
  }

  /* ── Tweet-preview hover popover (on KOL rows in the paid panel) ── */
  let kolPreviewEl = null;

  function ensureKolPreview() {
    if (kolPreviewEl && document.body.contains(kolPreviewEl)) return kolPreviewEl;
    kolPreviewEl = document.createElement("div");
    kolPreviewEl.className = "trusty-kol-preview";
    document.body.appendChild(kolPreviewEl);
    return kolPreviewEl;
  }

  function onKolRowEnter(e) {
    const row = e.target.closest && e.target.closest(".trusty-pp-kol-row");
    if (!row) return;
    const text = row.getAttribute("data-trusty-text");
    if (!text) return;
    const handle = row.querySelector(".trusty-pp-kol-handle")?.textContent || "";
    const likes = parseInt(row.getAttribute("data-trusty-likes") || "0", 10);
    const rts = parseInt(row.getAttribute("data-trusty-rts") || "0", 10);
    const reps = parseInt(row.getAttribute("data-trusty-replies") || "0", 10);

    const pop = ensureKolPreview();
    pop.innerHTML =
      '<div class="trusty-kol-preview-head">' + escapeHtml(handle) + '</div>' +
      '<div class="trusty-kol-preview-text">' + escapeHtml(text) + '</div>' +
      '<div class="trusty-kol-preview-stats">' +
        '<span>' + likes.toLocaleString() + ' likes</span>' +
        '<span>' + rts.toLocaleString() + ' RTs</span>' +
        '<span>' + reps.toLocaleString() + ' replies</span>' +
      '</div>';

    // Position to the LEFT of the panel by default; flip if no room.
    const panel = document.getElementById(PANEL_ID);
    const panelRect = panel ? panel.getBoundingClientRect() : { left: 0, right: 0, top: 0 };
    const rowRect = row.getBoundingClientRect();
    pop.style.visibility = "hidden";
    pop.classList.add("show");
    const popRect = pop.getBoundingClientRect();

    let left = panelRect.left - popRect.width - 12;
    if (left < 12) left = panelRect.right + 12; // not enough room on left → flip right
    if (left + popRect.width > window.innerWidth - 12) {
      // Still no room — overlay at row level
      left = Math.max(12, window.innerWidth - popRect.width - 12);
    }
    let top = rowRect.top;
    if (top + popRect.height > window.innerHeight - 12) {
      top = window.innerHeight - popRect.height - 12;
    }
    if (top < 12) top = 12;

    pop.style.left = left + "px";
    pop.style.top = top + "px";
    pop.style.visibility = "";
  }

  function onKolRowLeave(e) {
    // Only hide when truly leaving — moving inside the row's children fires mouseout too
    const row = e.target.closest && e.target.closest(".trusty-pp-kol-row");
    if (!row) return;
    if (e.relatedTarget && row.contains(e.relatedTarget)) return;
    if (kolPreviewEl) kolPreviewEl.classList.remove("show");
  }

  /* ── Body renderers for the lazy-loaded KOL + activity sections ── */

  function renderKolsCta() {
    return (
      '<button class="trusty-pp-reveal-cta" type="button">' +
        '<span class="trusty-pp-reveal-icon">✨</span>' +
        '<span class="trusty-pp-reveal-text">Reveal KOL mentions + X activity</span>' +
        '<span class="trusty-pp-reveal-meta">Top 5 by followers · powered by Sorsa</span>' +
      '</button>'
    );
  }

  function revealKols(ca, chain, symbol) {
    const live = document.getElementById(PANEL_ID);
    if (!live) return;
    const kolsBody = live.querySelector('[data-trusty-section="kols"]');
    const actBody = live.querySelector('[data-trusty-section="activity"]');
    if (kolsBody) {
      kolsBody.innerHTML =
        '<div class="trusty-pp-section-title">🐦 Top KOL mentions</div>' +
        renderKolsBody(null); // pulse "Loading…"
    }
    if (window.TrustyAPI && window.TrustyAPI.scanKols) {
      window.TrustyAPI.scanKols(ca, chain, symbol).then(function (data) {
        const stillLive = document.getElementById(PANEL_ID);
        if (!stillLive) return; // user closed before fetch resolved
        const k = stillLive.querySelector('[data-trusty-section="kols"]');
        const a = stillLive.querySelector('[data-trusty-section="activity"]');
        if (k) {
          k.innerHTML =
            '<div class="trusty-pp-section-title">🐦 Top KOL mentions</div>' +
            renderKolsBody(data.kols || []);
        }
        if (a) {
          a.style.display = "";
          a.innerHTML =
            '<div class="trusty-pp-section-title">📈 X activity</div>' +
            renderActivityBody(data.activity || {});
        }
      }).catch(function () {
        const k = document.getElementById(PANEL_ID)?.querySelector('[data-trusty-section="kols"]');
        if (k) {
          k.innerHTML =
            '<div class="trusty-pp-section-title">🐦 Top KOL mentions</div>' +
            '<div class="trusty-pp-empty">Couldn\'t load KOL data — try again later.</div>';
        }
      });
    }
  }

  function renderKolsBody(kols) {
    if (kols === null) {
      return '<div class="trusty-pp-empty trusty-pp-loading-line">Loading KOL mentions…</div>';
    }
    if (!kols.length) {
      return '<div class="trusty-pp-empty">No KOL mentions in the last 24h.</div>';
    }
    return kols.map(function (k, idx) {
      const ago = k.mins < 60 ? (k.mins + "m ago") :
                  k.mins < 1440 ? (Math.floor(k.mins / 60) + "h ago") :
                  (Math.floor(k.mins / 1440) + "d ago");
      const eng = fmtEngagement(k);
      const inner =
        '<span class="trusty-pp-kol-handle">' + escapeHtml(k.handle) + '</span>' +
        '<span class="trusty-pp-kol-engagement">' + eng + '</span>' +
        '<span class="trusty-pp-kol-time">' + ago + '</span>';
      // Stash the tweet text on the row via data-attr so the hover
      // popover can read it without extra wiring.
      const dataAttrs =
        ' data-trusty-text="' + escapeHtml(k.text || "") + '"' +
        ' data-trusty-likes="' + (k.likes || 0) + '"' +
        ' data-trusty-rts="' + (k.retweets || 0) + '"' +
        ' data-trusty-replies="' + (k.replies || 0) + '"';
      if (k.tweetUrl) {
        return '<a class="trusty-pp-kol-row trusty-pp-kol-link"' +
                  ' href="' + escapeHtml(k.tweetUrl) + '"' +
                  ' target="_blank" rel="noopener noreferrer"' +
                  ' title="View tweet on X"' + dataAttrs + '>' +
                  inner +
                  '<span class="trusty-pp-kol-arrow" aria-hidden="true">↗</span>' +
                '</a>';
      }
      return '<div class="trusty-pp-kol-row"' + dataAttrs + '>' + inner + '</div>';
    }).join("");
  }

  function fmtEngagement(k) {
    const likes = k.likes || 0;
    const rts = k.retweets || 0;
    const reps = k.replies || 0;
    if (!likes && !rts && !reps) return "<span class=\"trusty-pp-kol-faded\">—</span>";
    const parts = [];
    if (likes) parts.push(fmtCount(likes) + "❤");
    if (rts) parts.push(fmtCount(rts) + "🔁");
    if (reps) parts.push(fmtCount(reps) + "💬");
    return parts.join(" ");
  }

  function fmtCount(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderActivityBody(act) {
    if (act === null) {
      return '<div class="trusty-pp-empty trusty-pp-loading-line">Loading X activity…</div>';
    }
    const tweets = act.tweets24h || 0;
    const deltaPct = act.deltaPct || 0;
    const deltaSign = deltaPct >= 0 ? "↑" : "↓";
    const deltaCls = deltaPct >= 0 ? "up" : "down";
    const deltaCell = deltaPct === 0
      ? '<div class="trusty-pp-stat-num">—</div>'
      : '<div class="trusty-pp-stat-num ' + deltaCls + '">' + deltaSign + ' ' + Math.abs(deltaPct) + '%</div>';
    return '<div class="trusty-pp-stat-grid">' +
      '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + tweets.toLocaleString() + '</div><div class="trusty-pp-stat-lbl">tweets / 24h</div></div>' +
      '<div class="trusty-pp-stat">' + deltaCell + '<div class="trusty-pp-stat-lbl">vs yesterday</div></div>' +
      '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + (act.sentiment || "—") + '</div><div class="trusty-pp-stat-lbl">sentiment</div></div>' +
      '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num ' + (act.coordShill ? 'down' : 'up') + '">' + (act.coordShill ? "DETECTED" : "Clean") + '</div><div class="trusty-pp-stat-lbl">coord. shill</div></div>' +
    '</div>';
  }

  function openPaidPanel(result, ca, chain, opts) {
    closePaidPanel();
    opts = opts || {};
    const blurred = !!opts.blurred;
    if (!result) {
      // Try fetching now if pill click happened before scan resolved
      if (window.TrustyAPI && window.TrustyAPI.scan) {
        window.TrustyAPI.scan(ca, chain).then(function (r) { openPaidPanel(r, ca, chain, opts); });
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
    panel.className = "trusty-panel" + (blurred ? " trusty-panel-blurred" : "");

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

    const md = result.marketData || {};

    panel.innerHTML =
      '<button class="trusty-pp-close" aria-label="Close">✕</button>' +
      '<button class="trusty-pp-star" type="button" aria-label="Save to watchlist" title="Save to watchlist">☆</button>' +

      '<div class="trusty-pp-header ' + verdictClass + '">' +
        '<div class="trusty-pp-verdict">' + verdictEmoji + " " + result.verdict + '</div>' +
        '<div class="trusty-pp-score">' + result.score + '/100</div>' +
      '</div>' +
      '<div class="trusty-pp-meta">' + result.symbol +
        ' <span class="trusty-pp-chain">on ' + chainLabel + '</span></div>' +

      (result.launchedOn === 'fourmeme'
        ? '<a class="trusty-pp-fourmeme" href="https://four.meme/token/' + encodeURIComponent(ca) + '" target="_blank" rel="noopener">' +
            '<span class="trusty-pp-fourmeme-icon">🚀</span>' +
            '<span class="trusty-pp-fourmeme-text">' +
              '<span class="trusty-pp-fourmeme-title">Launched on four.meme</span>' +
              '<span class="trusty-pp-fourmeme-sub">View token page →</span>' +
            '</span>' +
            '<span class="trusty-pp-fourmeme-arrow">↗</span>' +
          '</a>'
        : '') +

      '<div class="trusty-pp-section">' +
        '<div class="trusty-pp-section-title">🛡️ Safety</div>' +
        '<ul class="trusty-tt-checks">' + checksHtml + '</ul>' +
      '</div>' +

      '<div class="trusty-pp-section" data-trusty-section="kols">' +
        '<div class="trusty-pp-section-title">🐦 Top KOL mentions</div>' +
        (blurred ? renderKolsBody(BLURRED_PLACEHOLDER_KOLS) : renderKolsCta()) +
      '</div>' +

      '<div class="trusty-pp-section" data-trusty-section="activity"' +
        (blurred ? '' : ' style="display:none;"') + '>' +
        '<div class="trusty-pp-section-title">📈 X activity</div>' +
        (blurred ? renderActivityBody(BLURRED_PLACEHOLDER_ACTIVITY) : renderActivityBody(null)) +
      '</div>' +

      '<div class="trusty-pp-section">' +
        '<div class="trusty-pp-section-title">📊 Market</div>' +
        '<div class="trusty-pp-stat-grid trusty-pp-stat-grid-3">' +
          '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + (md.mcap || "—") + '</div><div class="trusty-pp-stat-lbl">market cap</div></div>' +
          '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + (md.volume24h || "—") + '</div><div class="trusty-pp-stat-lbl">vol 24h</div></div>' +
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

    // Free users: overlay an upgrade prompt on top of the blurred panel.
    if (blurred) {
      const overlay = document.createElement("div");
      overlay.className = "trusty-pp-upgrade-overlay";
      overlay.innerHTML =
        '<div class="trusty-pp-upgrade-card">' +
          '<div class="trusty-pp-upgrade-icon">✨</div>' +
          '<div class="trusty-pp-upgrade-title">Free catches rugs.<br>Paid catches winners.</div>' +
          '<div class="trusty-pp-upgrade-sub">' +
            'KOL handles · X velocity · sentiment · coord-shill detection · unlimited watchlist' +
          '</div>' +
          '<button class="trusty-pp-upgrade-btn" type="button" data-action="open-popup">' +
            '🛡️ Unlock — $5/mo or $50/yr' +
          '</button>' +
          '<a class="trusty-pp-upgrade-secondary" href="https://trustyai.tech/?ca=' +
            encodeURIComponent(ca) + '&chain=' + encodeURIComponent(chain) +
            '&utm_source=extension_blurred" target="_blank" rel="noopener">' +
            'Or open the full free report on trustyai.tech →' +
          '</a>' +
        '</div>';
      panel.appendChild(overlay);

      // Open the extension popup so the user can subscribe / verify wallet
      const upgradeBtn = overlay.querySelector('[data-action="open-popup"]');
      if (upgradeBtn) {
        upgradeBtn.addEventListener("click", function () {
          // Best-effort: most modern Chrome supports openPopup() but only
          // from a user gesture in the action context. Fall back to opening
          // the trustyai.tech upgrade page if that doesn't work here.
          try {
            chrome.runtime.sendMessage({ action: "openSubscribe" });
          } catch (_) {}
          window.open("https://trustyai.tech/?upgrade=1&utm_source=extension_blurred", "_blank", "noopener,noreferrer");
        });
      }

      // Disable the click-to-reveal Sorsa CTA inside the blurred panel —
      // the blur is the visual gate; the reveal CTA would be confusing.
      const revealCta = panel.querySelector(".trusty-pp-reveal-cta");
      if (revealCta) revealCta.style.display = "none";
    }

    // Wire the star button on the panel header — same flow as the
    // pill star, but on a token the user is actively examining.
    const panelStar = panel.querySelector(".trusty-pp-star");
    if (panelStar && window.TrustyTier) {
      window.TrustyTier.watchlistContains(ca, chain).then(function (saved) {
        if (saved) {
          panelStar.textContent = "★";
          panelStar.classList.add("trusty-pp-star-active");
          panelStar.setAttribute("aria-pressed", "true");
        }
      });
      panelStar.addEventListener("click", async function () {
        const saved = panelStar.classList.contains("trusty-pp-star-active");
        if (saved) {
          await window.TrustyTier.watchlistRemove(ca, chain);
          panelStar.textContent = "☆";
          panelStar.classList.remove("trusty-pp-star-active");
          panelStar.setAttribute("aria-pressed", "false");
          flashStarFeedback(panelStar, "Removed from watchlist");
        } else {
          const res = await window.TrustyTier.watchlistAdd({
            ca: ca,
            chain: chain,
            symbol: (result.symbol || "").replace(/^\$/, ""),
            name: result.name || ""
          });
          if (!res.ok && res.error === "cap_reached") {
            flashStarFeedback(panelStar,
              "Free tier holds " + res.cap + " — upgrade for unlimited", true);
            return;
          }
          if (!res.ok) {
            flashStarFeedback(panelStar, "Couldn't save. Try again.");
            return;
          }
          panelStar.textContent = "★";
          panelStar.classList.add("trusty-pp-star-active");
          panelStar.setAttribute("aria-pressed", "true");
          flashStarFeedback(panelStar, "Saved to watchlist");
          if (window.TrustyAPI && window.TrustyAPI.reportEvent) {
            window.TrustyAPI.reportEvent("watchlist_add", ca, chain);
          }
        }
      });
    }

    // Click-to-reveal: paid users opt in to KOLs + activity by clicking
    // the CTA. Saves Sorsa quota when the user just wants to glance at
    // safety + market data, and frames the data as a VIP action.
    const cta = panel.querySelector(".trusty-pp-reveal-cta");
    if (cta) {
      const symbol = (result.symbol || "").replace(/^\$/, "");
      cta.addEventListener("click", function () {
        revealKols(ca, chain, symbol);
      });
    }

    // Tweet-preview popover on KOL row hover. Delegated so it works
    // both on initial render (none yet) and after the lazy KOL fetch.
    panel.addEventListener("mouseover", onKolRowEnter, true);
    panel.addEventListener("mouseout", onKolRowLeave, true);

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

    // Inline emoji shield — inherits the verdict color via CSS, which
    // is what we want on the colored pill backgrounds. The PNG mascot
    // lives in the toolbar/popup/Web Store; the emoji belongs here
    // because it renders sharp at 11px and adapts to context color.
    const icon = document.createElement("span");
    icon.className = PILL_CLASS + "-icon";
    icon.textContent = "🛡️";

    const score = document.createElement("span");
    score.className = PILL_CLASS + "-score";
    score.textContent = "…";

    // Star button — toggles watchlist membership without leaving the
    // page. We start with empty-star, flip filled when the watchlist
    // mirror reports the CA is in the list.
    const star = document.createElement("button");
    star.className = PILL_CLASS + "-star";
    star.type = "button";
    star.setAttribute("aria-label", "Save to watchlist");
    star.setAttribute("title", "Save to watchlist");
    star.textContent = "☆";
    star.addEventListener("click", onStarClick);

    pill.appendChild(icon);
    pill.appendChild(score);
    pill.appendChild(star);

    // Reflect existing watchlist state
    if (window.TrustyTier && window.TrustyTier.watchlistContains) {
      window.TrustyTier.watchlistContains(ca, chain || "evm").then(function (saved) {
        if (saved) markStarSaved(star, true);
      });
    }

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

  function markStarSaved(starEl, saved) {
    if (!starEl) return;
    starEl.textContent = saved ? "★" : "☆";
    starEl.classList.toggle(PILL_CLASS + "-star-active", !!saved);
    starEl.setAttribute("aria-pressed", saved ? "true" : "false");
  }

  async function onStarClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const star = e.currentTarget;
    const pill = star.closest("." + PILL_CLASS);
    if (!pill || !window.TrustyTier) return;

    const ca = pill.dataset.trustyCa;
    const chain = pill.dataset.trustyChain || "evm";
    const result = pill._trustyResult || {};
    const isSaved = star.classList.contains(PILL_CLASS + "-star-active");

    if (isSaved) {
      await window.TrustyTier.watchlistRemove(ca, chain);
      markStarSaved(star, false);
      flashStarFeedback(star, "Removed from watchlist");
      return;
    }

    const res = await window.TrustyTier.watchlistAdd({
      ca: ca,
      chain: chain,
      symbol: (result.symbol || "").replace(/^\$/, ""),
      name: result.name || ""
    });
    if (!res.ok && res.error === "cap_reached") {
      flashStarFeedback(
        star,
        "Free tier holds " + res.cap + " — upgrade for unlimited",
        true
      );
      return;
    }
    if (!res.ok) {
      flashStarFeedback(star, "Couldn't save. Try again.");
      return;
    }
    markStarSaved(star, true);
    flashStarFeedback(star, res.alreadyWatched ? "Already in watchlist" : "Saved to watchlist");
    // Anonymous trending signal — saving is a strong intent signal,
    // weighed heavier than scans by the trending aggregator.
    if (!res.alreadyWatched && window.TrustyAPI && window.TrustyAPI.reportEvent) {
      window.TrustyAPI.reportEvent("watchlist_add", ca, chain);
    }
  }

  // Tiny ephemeral toast next to the star — non-blocking feedback.
  function flashStarFeedback(starEl, msg, isUpgrade) {
    const old = document.querySelector("." + PILL_CLASS + "-toast");
    if (old) old.remove();
    const toast = document.createElement("span");
    toast.className = PILL_CLASS + "-toast" + (isUpgrade ? " " + PILL_CLASS + "-toast-upgrade" : "");
    toast.textContent = msg;
    document.body.appendChild(toast);
    const r = starEl.getBoundingClientRect();
    toast.style.top = (r.bottom + 6) + "px";
    toast.style.left = Math.max(8, Math.min(window.innerWidth - 220, r.left - 100)) + "px";
    setTimeout(function () { toast.classList.add("show"); }, 0);
    setTimeout(function () { toast.classList.remove("show"); setTimeout(function () { toast.remove(); }, 200); }, 2400);
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
