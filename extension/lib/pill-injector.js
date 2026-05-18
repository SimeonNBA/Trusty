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

  // (Legacy fake-data placeholders removed. Free-tier view now uses
  // explicitly-locked rows — see renderLockedKolsBody +
  // renderLockedActivityBody below.)

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

  // Per-check explanations. Matched by label PREFIX so variable-content
  // labels (e.g. "Tax 5% / 5%") still resolve. Returns null if no match.
  const CHECK_EXPLANATIONS = {
    "Not a honeypot": "Contract allows selling. Honeypots block the sell transaction, trapping buyers.",
    "Tax": "Buy/sell tax rates encoded in the contract. >5% means the contract takes a cut on every trade — common in scam tokens.",
    "Transfer fee": "Solana equivalent of tax. Empty = no fee. Non-empty = fee taken on every transfer.",
    "Transfer fee data unavailable": "GoPlus couldn't read the token's transfer fee setting. Try again in a few minutes.",
    "Tax data unavailable": "GoPlus couldn't read the tax setting. Try again in a few minutes.",
    "LP locked": "Liquidity-pool tokens are burned or locked, so nobody can pull liquidity and rug. Verified on-chain.",
    "Mint disabled": "Contract can't print new supply. If enabled, devs could dilute holders to zero.",
    "Contract renounced": "Owner gave up admin keys (sent to null address). No central party can change rules.",
    "Authorities renounced": "Solana mint + freeze authorities transferred to null. Token is immutable.",
    "Top 5 wallets hold": "Wallet concentration. >20% means whales can crash the price by selling out at once.",
    "Top wallets": "Wallet concentration data. Required to detect whale-risk.",
    "Dev wallet": "Token creator's wallet. Recent rug history at this address is a strong warning.",
    "Snipers": "Wallets that bought in the first blocks. >5% of supply held by snipers is risky — they often dump fast.",
    "Token actively trades": "Real buy/sell activity in the last 24h. Indirect proof the token isn't a honeypot (you can't trade out of one).",
    "Established": "Token has age and market cap depth. Rugs usually happen in the first weeks, so survival is a positive signal.",
    "Adequate liquidity": "Enough liquidity in the pools to enter and exit retail-size positions without major slippage.",
    "Some safety checks pending": "Safety APIs don't have data for this token yet — usually because it's fresh. Refresh in a few minutes or check the full report.",
    "Safety data unavailable": "We couldn't fetch safety data for this token right now. Try again in a few minutes.",
    "Listed in independent token registry": "A second independent registry recognises this token (separate from our primary safety source). Weak-but-positive signal vs unindexed tokens that nobody tracks.",
    "No critical security flags (independent audit)": "Independent registry checked the contract and found no honeypot, no mintable supply, no abandoned-but-recoverable ownership.",
    "No critical mint/freeze flags (independent audit)": "Independent registry confirmed mint and freeze authorities are renounced — supply is fixed and the token can't be frozen.",
    "Honeypot detected (independent audit)": "Independent registry flagged this contract as a honeypot — buyers can't sell. Do not trade.",
    "Audit flags": "Independent registry surfaced specific risks (e.g. mintable supply, closed-source contract). Treat as cautionary.",
    "Token freezable by authority": "Solana mint still has an active freeze authority — the issuer can disable transfers on any wallet. Major centralisation risk.",
    "Mint authority active": "Token's mint authority is still live — supply can be inflated arbitrarily. Major dilution risk.",
  };

  function explanationFor(label) {
    if (!label) return null;
    for (const key in CHECK_EXPLANATIONS) {
      if (label.indexOf(key) === 0) return CHECK_EXPLANATIONS[key];
    }
    return null;
  }

  function escapeAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureTooltip() {
    if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.id = TOOLTIP_ID;
    tooltipEl.className = "trusty-tooltip";
    tooltipEl.setAttribute("role", "tooltip");
    // Keep the tooltip open while the user hovers it (so they can click
    // info icons or read explanations without the tooltip vanishing).
    tooltipEl.addEventListener("mouseenter", function () {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    });
    tooltipEl.addEventListener("mouseleave", function () {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (!activePill) hideTooltip();
      }, 120);
    });
    // Delegated click handler for the per-check info icons. Click toggles
    // an inline explanation for that row.
    tooltipEl.addEventListener("click", function (e) {
      // Sub-score row → whole row is the click target (matches the
      // website pattern). Check this first so the sub-score click
      // doesn't fall through to the safety-check info handler below.
      const subRow = e.target.closest && e.target.closest('[data-trusty-sub-row="1"]');
      if (subRow) {
        e.preventDefault();
        e.stopPropagation();
        subRow.classList.toggle("trusty-tt-sub-open");
        return;
      }
      const btn = e.target.closest && e.target.closest(".trusty-tt-info");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const row = btn.closest(".trusty-tt-check");
      const expl = row && row.querySelector(".trusty-tt-check-explain");
      if (expl) expl.classList.toggle("show");
    });
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  // Build the Narrative section for the paid panel — matches the
  // scanned token's symbol/name against the 7 narrative buckets and
  // renders the matched bucket's risk profile + condensed playbook.
  // Returns empty string when there's no match so unclassified
  // tokens don't get a misleading category.
  function renderNarrativeSection(symbol, name) {
    if (!window.TrustyNarratives || !window.TrustyNarratives.classify) return "";
    const n = window.TrustyNarratives.classify(symbol, name);
    if (!n) return "";
    const tokenChips = (n.tokens || []).slice(0, 6).map(function (t) {
      return '<span class="trusty-pp-narr-chip">$' + escapeAttr(t) + '</span>';
    }).join("");
    return (
      '<div class="trusty-pp-section trusty-pp-narr-section">' +
        '<div class="trusty-pp-section-title">🎬 Narrative</div>' +
        '<div class="trusty-pp-narr-head">' +
          '<span class="trusty-pp-narr-emoji">' + n.emoji + '</span>' +
          '<span class="trusty-pp-narr-name">' + escapeAttr(n.name) + '</span>' +
          '<span class="trusty-pp-narr-sub">— ' + escapeAttr(n.subtitle) + '</span>' +
          '<span class="trusty-pp-narr-risk trusty-pp-narr-risk-' + n.riskColor + '">' + escapeAttr(n.risk) + '</span>' +
        '</div>' +
        '<div class="trusty-pp-narr-stats">' +
          '<span><strong>Avg</strong> ' + escapeAttr(n.avgReturn) + '</span>' +
          '<span><strong>Rug</strong> ' + escapeAttr(n.rugRate) + '</span>' +
          '<span><strong>Lifespan</strong> ' + escapeAttr(n.lifespan) + '</span>' +
        '</div>' +
        '<div class="trusty-pp-narr-row">' +
          '<span class="trusty-pp-narr-label good">✅ When to ape</span>' +
          '<span class="trusty-pp-narr-text">' + escapeAttr(n.whenToApe) + '</span>' +
        '</div>' +
        '<div class="trusty-pp-narr-row">' +
          '<span class="trusty-pp-narr-label bad">🚨 When to avoid</span>' +
          '<span class="trusty-pp-narr-text">' + escapeAttr(n.whenToAvoid) + '</span>' +
        '</div>' +
        '<div class="trusty-pp-narr-row">' +
          '<span class="trusty-pp-narr-label signal">⚡ Key signal</span>' +
          '<span class="trusty-pp-narr-text">' + escapeAttr(n.keySignal) + '</span>' +
        '</div>' +
        '<div class="trusty-pp-narr-row">' +
          '<span class="trusty-pp-narr-label entry">🎯 Best entry</span>' +
          '<span class="trusty-pp-narr-text">' + escapeAttr(n.bestEntry) + '</span>' +
        '</div>' +
        (tokenChips ? '<div class="trusty-pp-narr-tokens"><span class="trusty-pp-narr-tokens-lbl">Related:</span> ' + tokenChips + '</div>' : '') +
      '</div>'
    );
  }

  // Shared labels for the 6-category sub-score breakdown. Used in both
  // the hover tooltip and the paid panel so the wording matches.
  const SUB_SCORE_LABELS = [
    ["chainReputation", "Chain Reputation", "How much trust the underlying chain carries. Ethereum highest, BSC moderate, fresh chains lowest. A safe contract on a sketchy chain still inherits chain risk."],
    ["narrative", "Narrative", "Whether the token rides a known meta (dogs / cats / AI / mascots) vs a random launch with no story. Tokens with a narrative survive drawdowns better."],
    ["ownership", "Ownership", "Renounced contracts (owner = 0x0) score high — nobody can flip rules mid-game. Active owner wallets are a kill switch."],
    ["ageTiming", "Age / Timing", "How long the token has survived. Most rugs happen in week 1; old-and-alive is a quiet positive signal."],
    ["socialPresence", "Social Presence", "X and Binance Square mentions and velocity. Zero attention = zombie token. Spikes = real interest (or coordinated shilling — check the coord-shill row)."],
    ["supplySafety", "Supply Safety", "LP locked + mint disabled + healthy wallet distribution. Determines whether the floor can vanish overnight."],
  ];

  // Render one sub-score row with an inline expandable explanation.
  // The whole row is the click target (matches the website pattern) —
  // delegated click handlers on the parent toggle .trusty-tt-sub-open
  // which CSS uses to reveal the explanation block underneath.
  function renderSubScoreRow(pair, value) {
    const v = Number(value) || 0;
    const cls = v >= 70 ? "ok" : v >= 40 ? "warn" : "bad";
    const pct = Math.max(0, Math.min(100, v));
    return (
      '<li class="trusty-tt-sub" data-trusty-sub-row="1">' +
        '<div class="trusty-tt-sub-main">' +
          '<span class="trusty-tt-sub-name">' + pair[1] +
            ' <span class="trusty-tt-sub-info" aria-hidden="true">ⓘ</span>' +
          '</span>' +
          '<div class="trusty-tt-sub-bar">' +
            '<div class="trusty-tt-sub-fill trusty-tt-sub-' + cls + '" style="width:' + pct + '%"></div>' +
          '</div>' +
          '<span class="trusty-tt-sub-val trusty-tt-sub-' + cls + '">' + v + '</span>' +
        '</div>' +
        '<div class="trusty-tt-sub-explain">' + escapeAttr(pair[2]) + '</div>' +
      '</li>'
    );
  }

  // Delegated click handler — toggles .trusty-tt-sub-open on a row
  // when the user taps anywhere inside it. Used on both the tooltip
  // and the paid panel.
  function onSubRowClick(e) {
    const row = e.target.closest && e.target.closest('[data-trusty-sub-row="1"]');
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();
    row.classList.toggle("trusty-tt-sub-open");
  }

  // Sub-score breakdown for the paid panel. Returns empty when the
  // worker didn't send subScores (older worker version → silent no-op).
  function renderPanelSubScores(subScores) {
    if (!subScores || typeof subScores !== "object") return "";
    const rows = SUB_SCORE_LABELS.map(function (pair) {
      return renderSubScoreRow(pair, subScores[pair[0]]);
    }).join("");
    return (
      '<div class="trusty-pp-section">' +
        '<div class="trusty-pp-section-title">📊 Detailed breakdown</div>' +
        '<ul class="trusty-tt-subs-list trusty-tt-subs-clickable">' + rows + '</ul>' +
      '</div>'
    );
  }

  function renderTooltipHtml(result) {
    const verdictClass = "trusty-tt-verdict-" + result.verdict.toLowerCase();
    const verdictEmoji =
      result.verdict === "APE" ? "🟢" :
      result.verdict === "CAUTION" ? "🟡" : "🔴";

    const checksHtml = result.checks.map(function (c) {
      const icon = c.ok ? "✅" : "❌";
      const cls = c.ok ? "trusty-tt-check-ok" : "trusty-tt-check-bad";
      const explanation = explanationFor(c.label);
      const infoBtn = explanation
        ? '<button class="trusty-tt-info" type="button" aria-label="What does this mean?" title="What does this mean?">ⓘ</button>'
        : '';
      const explDiv = explanation
        ? '<div class="trusty-tt-check-explain">' + escapeAttr(explanation) + '</div>'
        : '';
      return (
        '<li class="trusty-tt-check ' + cls + '">' +
          '<div class="trusty-tt-check-row">' +
            '<span class="trusty-tt-check-icon">' + icon + '</span>' +
            '<span class="trusty-tt-check-label">' + c.label + '</span>' +
            infoBtn +
          '</div>' +
          explDiv +
        '</li>'
      );
    }).join("");

    const chainLabel = (result.chain || "EVM").toUpperCase();
    const md = result.marketData || {};
    const mcap = md.mcap || "—";
    const vol = md.volume24h || "—";

    // 6-category sub-score breakdown. Degrades cleanly if the worker
    // doesn't send subScores (older worker version → no section rendered).
    let subScoresHtml = "";
    if (result.subScores && typeof result.subScores === "object") {
      const rows = SUB_SCORE_LABELS.map(function (pair) {
        return renderSubScoreRow(pair, result.subScores[pair[0]]);
      }).join("");
      subScoresHtml = (
        '<div class="trusty-tt-subs">' +
          '<div class="trusty-tt-subs-title">📊 Detailed breakdown</div>' +
          '<ul class="trusty-tt-subs-list trusty-tt-subs-clickable">' + rows + '</ul>' +
        '</div>'
      );
    }

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
      subScoresHtml +
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
    } else if (pill._trustyResult._unavailable) {
      tt.innerHTML = (
        '<div class="trusty-tt-unavailable">' +
          '<div class="trusty-tt-unavailable-title">Safety data unavailable</div>' +
          '<div class="trusty-tt-unavailable-body">' +
            "The scanner couldn’t verify this token right now. This is usually temporary — refresh the tab in a few seconds to retry. " +
            'You can also <a href="https://trustyai.tech/?ca=' + encodeURIComponent(pill._trustyResult.ca || "") + '" target="_blank" rel="noopener">open the full report on trustyai.tech</a>.' +
          '</div>' +
        '</div>'
      );
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
        const sq = stillLive.querySelector('[data-trusty-section="square"]');
        if (sq) {
          sq.style.display = "";
          sq.innerHTML =
            '<div class="trusty-pp-section-title">🟡 Binance Square activity</div>' +
            renderSquareActivityBody(data.squareActivity || {});
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

  // Locked KOL list shown to free users in the paid panel. No fake
  // data, no clickable rows, no real API calls (saves Sorsa quota).
  // Matches the structure of the unblurred KOL list so the user can
  // see exactly what they'd unlock — but every row is explicitly
  // locked with a 🔒 icon and obfuscated bars instead of made-up
  // @handles. Cannot be clicked through.
  function renderLockedKolsBody() {
    const rows = [];
    for (let i = 0; i < 5; i++) {
      rows.push(
        '<div class="trusty-pp-kol-row trusty-pp-kol-locked" aria-disabled="true">' +
          '<span class="trusty-pp-kol-lock">🔒</span>' +
          '<span class="trusty-pp-kol-handle trusty-pp-locked-bar trusty-pp-locked-bar-handle"></span>' +
          '<span class="trusty-pp-kol-engagement trusty-pp-locked-bar trusty-pp-locked-bar-eng"></span>' +
          '<span class="trusty-pp-kol-time trusty-pp-locked-bar trusty-pp-locked-bar-time"></span>' +
        '</div>'
      );
    }
    return rows.join("") +
      '<div class="trusty-pp-locked-hint">🔒 Top 5 KOL handles · engagement · last-mention time — paid only</div>';
  }

  // Locked X-activity grid — same 4 stat cards as the unblurred view
  // but each value replaced with a lock icon. Labels visible so the
  // user knows what they'd unlock.
  function renderLockedActivityBody() {
    const cell = function (label) {
      return '<div class="trusty-pp-stat trusty-pp-stat-locked">' +
        '<div class="trusty-pp-stat-num trusty-pp-stat-locked-num">🔒</div>' +
        '<div class="trusty-pp-stat-lbl">' + label + '</div>' +
      '</div>';
    };
    return '<div class="trusty-pp-stat-grid">' +
      cell("tweets / 24h") +
      cell("vs yesterday") +
      cell("sentiment") +
      cell("coord. shill") +
    '</div>' +
    '<div class="trusty-pp-locked-hint">🔒 X velocity · sentiment · coord-shill detection — paid only</div>';
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

  // ── Trade-in-Trust-Wallet CTA row ──
  // Mobile users get the link.trustwallet.com universal link → opens
  // TW app's swap. Desktop users get swap.trustwallet.com (TW's web
  // swap; auto-connects to TW Chrome extension if installed). PCS as
  // a secondary fallback. UAI: c<coinId>_t<address>.
  function tradeChainCoinId(chain) {
    var c = (chain || "").toLowerCase();
    return ({
      bsc: 20000714, bnb: 20000714, binance: 20000714, evm: 20000714,
      ethereum: 60, eth: 60,
      solana: 501, sol: 501,
      polygon: 966, matic: 966
    })[c] || null;
  }
  function isMobileDevice() {
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
  }
  // Per-chain DEX with stable pre-fill URL pattern. Used as the
  // always-works swap target on desktop and as the secondary
  // fallback alongside the TW mobile deep link on mobile.
  function tradeChainDex(chain, ca) {
    var c = (chain || "").toLowerCase();
    if (!ca) return null;
    if (c === "bsc" || c === "bnb" || c === "binance" || c === "evm") {
      return { name: "PancakeSwap", icon: "🥞", url: "https://pancakeswap.finance/swap?outputCurrency=" + encodeURIComponent(ca) };
    }
    if (c === "ethereum" || c === "eth") {
      return { name: "Uniswap", icon: "🦄", url: "https://app.uniswap.org/swap?outputCurrency=" + encodeURIComponent(ca) };
    }
    if (c === "solana" || c === "sol") {
      return { name: "Jupiter", icon: "🪐", url: "https://jup.ag/swap/SOL-" + encodeURIComponent(ca) };
    }
    if (c === "polygon" || c === "matic") {
      return { name: "Uniswap", icon: "🦄", url: "https://app.uniswap.org/swap?outputCurrency=" + encodeURIComponent(ca) + "&chain=polygon" };
    }
    if (c === "base") {
      return { name: "Uniswap", icon: "🦄", url: "https://app.uniswap.org/swap?outputCurrency=" + encodeURIComponent(ca) + "&chain=base" };
    }
    return null;
  }

  // Detect Trust Wallet Chrome extension on the current page.
  // Modern wallet extensions use EIP-6963 (multi-injected wallet
  // discovery) — they don't always inject window.ethereum directly.
  // We listen for announceProvider events at script load and remember
  // any TW provider that responds.
  let _twProviderFromEip6963 = null;
  try {
    window.addEventListener("eip6963:announceProvider", function (e) {
      const info = e?.detail?.info || {};
      const provider = e?.detail?.provider;
      if (provider && /trust\s*wallet/i.test(info.name || "")) {
        _twProviderFromEip6963 = provider;
      }
    });
    // Ask any wallets currently injected to announce themselves
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  } catch (_) {}

  function hasTwExtension() {
    try {
      if (_twProviderFromEip6963) return true;
      if (window.trustwallet) return true;
      if (window.ethereum) {
        if (window.ethereum.isTrust || window.ethereum.isTrustWallet) return true;
        if (Array.isArray(window.ethereum.providers)) {
          return window.ethereum.providers.some(function (p) {
            return p && (p.isTrust || p.isTrustWallet);
          });
        }
      }
      return false;
    } catch (e) { return false; }
  }

  // Get the actual provider object so we can call .request() on it.
  function getTwProvider() {
    if (_twProviderFromEip6963) return _twProviderFromEip6963;
    if (window.ethereum && (window.ethereum.isTrust || window.ethereum.isTrustWallet)) return window.ethereum;
    if (window.ethereum && Array.isArray(window.ethereum.providers)) {
      const p = window.ethereum.providers.find(function (x) { return x && (x.isTrust || x.isTrustWallet); });
      if (p) return p;
    }
    if (window.trustwallet && typeof window.trustwallet.request === "function") return window.trustwallet;
    if (window.trustwallet && window.trustwallet.ethereum) return window.trustwallet.ethereum;
    // Fallback: any injected provider (so click still triggers SOMEONE'S
    // wallet popup — better UX than nothing happening).
    if (window.ethereum && typeof window.ethereum.request === "function") return window.ethereum;
    return null;
  }

  // Trigger Trust Wallet (or whatever wallet extension is installed)
  // popup on click, then redirect to the DEX. Returned wallet
  // addresses are discarded — pure UX trigger so the user sees a
  // wallet popup attributed to Trusty before they hit the DEX.
  async function trustyOpenTwAndRedirect(redirectUrl) {
    const provider = getTwProvider();
    try {
      if (provider && typeof provider.request === "function") {
        await provider.request({ method: "eth_requestAccounts" });
      }
    } catch (e) { /* user denied or no provider — fall through */ }
    window.open(redirectUrl, "_blank", "noopener,noreferrer");
  }
  // Expose so onclick attributes in the panel HTML can reach it
  window.__trustyOpenTwAndRedirect = trustyOpenTwAndRedirect;

  function buildTradeRow(chain, ca) {
    if (!ca) return "";
    var coinId = tradeChainCoinId(chain);
    var nativeUai = coinId ? ("c" + coinId) : null;
    var tokenUai = coinId ? ("c" + coinId + "_t" + ca) : null;
    var twMobile = (nativeUai && tokenUai)
      ? "https://link.trustwallet.com/swap?from=" + nativeUai + "&to=" + tokenUai
      : null;
    var dex = tradeChainDex(chain, ca);
    var hasTw = hasTwExtension();
    var parts = [];
    if (isMobileDevice() && twMobile) {
      // Mobile: TW deep link primary, chain DEX secondary
      parts.push('<a class="trusty-pp-trade-btn primary" href="' + twMobile + '" target="_blank" rel="noopener">' +
        '<span class="trusty-pp-trade-icon">🛡️</span><span>Trade in Trust Wallet</span></a>');
      if (dex) {
        parts.push('<a class="trusty-pp-trade-btn secondary" href="' + dex.url + '" target="_blank" rel="noopener">' +
          '<span class="trusty-pp-trade-icon">' + dex.icon + '</span><span>Or ' + dex.name + '</span></a>');
      }
    } else if (dex) {
      // Desktop: chain DEX primary. ALWAYS trigger the wallet popup
      // on click via eth_requestAccounts — works whether we
      // detected TW or not (eip6963 timing, multi-provider arrays,
      // etc. can fool detection). If no provider is installed the
      // call silently fails and we just open the DEX.
      var safeDexUrl = dex.url.replace(/'/g, "&#39;");
      var primaryLabel = hasTw
        ? "Trade with Trust Wallet → " + dex.name
        : "Trade on " + dex.name;
      var primaryIcon = hasTw ? "🛡️" : dex.icon;
      parts.push('<a class="trusty-pp-trade-btn primary" href="' + dex.url + '" target="_blank" rel="noopener" ' +
        'onclick="event.preventDefault();window.__trustyOpenTwAndRedirect(\'' + safeDexUrl + '\');return false;">' +
        '<span class="trusty-pp-trade-icon">' + primaryIcon + '</span><span>' + primaryLabel + '</span></a>');
      if (!hasTw) {
        parts.push('<a class="trusty-pp-trade-btn secondary" href="https://trustwallet.com/browser-extension" target="_blank" rel="noopener">' +
          '<span class="trusty-pp-trade-icon">⬇️</span><span>Get Trust Wallet</span></a>');
      }
    }
    if (!parts.length) return "";
    var detected = (hasTw && !(isMobileDevice() && twMobile))
      ? '<div class="trusty-pp-trade-detected">✓ Trust Wallet detected · click will open Trust Wallet first</div>'
      : '';
    // Placeholder for the lazy-fetched route hint. Hidden until populated
    // post-render in openPaidPanel(); silently stays hidden if the quote
    // endpoint is unavailable or returns no route.
    var quoteSlot = '<div class="trusty-pp-trade-quote" data-trusty-quote style="display:none;"></div>';
    return '<div class="trusty-pp-section trusty-pp-trade-section">' +
      '<div class="trusty-pp-section-title">💱 Trade</div>' +
      '<div class="trusty-pp-trade-row">' + parts.join('') + '</div>' +
      detected +
      quoteSlot +
    '</div>';
  }

  // Chain → native gas-token symbol for the quote line.
  function nativeSymForChain(chain) {
    var c = (chain || "").toLowerCase();
    if (c === "bsc" || c === "bnb" || c === "binance" || c === "evm") return "BNB";
    if (c === "ethereum" || c === "eth") return "ETH";
    if (c === "base") return "ETH";
    if (c === "polygon" || c === "matic") return "MATIC";
    if (c === "arbitrum" || c === "arb") return "ETH";
    if (c === "optimism" || c === "op") return "ETH";
    if (c === "avalanche" || c === "avax") return "AVAX";
    return "";
  }

  // Renders the swap-quote line. Conservative on the numeric output —
  // raw token amounts depend on decimals (1e6 for stables, 1e18 for
  // most) and the upstream doesn't return decimals here, so we only
  // surface fields we can interpret unambiguously: provider, price
  // impact, and slippage.
  function renderQuoteLine(q, chain) {
    if (!q || !q.ok) return "";
    var impact = (typeof q.priceImpactPct === "number") ? q.priceImpactPct : parseFloat(q.priceImpactPct || 0);
    if (isNaN(impact)) impact = 0;
    var native = nativeSymForChain(chain);
    var pieces = [];
    if (q.provider) pieces.push("via " + escapeHtml(String(q.provider)));
    pieces.push("~" + impact.toFixed(2) + "% impact");
    if (q.slippage) pieces.push(escapeHtml(String(q.slippage)) + "% slippage");
    var prefix = native ? ("Best " + native + "→token route") : "Best route";
    return '<span class="trusty-pp-quote-prefix">' + prefix + ':</span> ' + pieces.join(" · ");
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

  // Same grid pattern as renderActivityBody — keeps the X and Square
  // sections visually consistent. Square doesn't expose a "vs yesterday"
  // delta yet, so we show 3 cells (mentions / sentiment / coord-shill).
  function renderSquareActivityBody(sq) {
    if (sq === null) {
      return '<div class="trusty-pp-empty trusty-pp-loading-line">Loading Binance Square…</div>';
    }
    const mentions = sq.mentions24h || 0;
    const sentiment = sq.sentiment || "—";
    const coordShill = !!sq.coordShill;
    if (mentions === 0) {
      return '<div class="trusty-pp-empty">No Binance Square mentions for this token in the last 24h.</div>';
    }
    return '<div class="trusty-pp-stat-grid trusty-pp-stat-grid-3">' +
      '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + mentions.toLocaleString() + '</div><div class="trusty-pp-stat-lbl">mentions / 24h</div></div>' +
      '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">' + sentiment + '</div><div class="trusty-pp-stat-lbl">sentiment</div></div>' +
      '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num ' + (coordShill ? 'down' : 'up') + '">' + (coordShill ? "DETECTED" : "Clean") + '</div><div class="trusty-pp-stat-lbl">coord. shill</div></div>' +
    '</div>';
  }

  // Free-tier blurred view of Binance Square activity. Same structure
  // as renderLockedActivityBody — keeps the visual upgrade pitch
  // consistent between X and Square sections.
  function renderLockedSquareBody() {
    return '<div class="trusty-pp-locked">' +
      '<div class="trusty-pp-stat-grid trusty-pp-stat-grid-3 trusty-pp-blurred">' +
        '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">123</div><div class="trusty-pp-stat-lbl">mentions / 24h</div></div>' +
        '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num">Bullish</div><div class="trusty-pp-stat-lbl">sentiment</div></div>' +
        '<div class="trusty-pp-stat"><div class="trusty-pp-stat-num up">Clean</div><div class="trusty-pp-stat-lbl">coord. shill</div></div>' +
      '</div>' +
      '<div class="trusty-pp-locked-overlay">' +
        '<div class="trusty-pp-locked-icon">🔒</div>' +
        '<div class="trusty-pp-locked-text">Binance Square sentiment unlocked with paid tier</div>' +
      '</div>' +
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
    // Free users see real safety + market data with locked KOL/X
    // sections inline. Paid users see everything unlocked. The
    // legacy panel-wide blur class is gone — replaced by per-section
    // locked rows for cleaner UX.
    panel.className = "trusty-panel" + (blurred ? " trusty-panel-free" : "");

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

    // Narrative classification — matches symbol/name against the
    // 7 narrative buckets from the website's Degen Academy. Renders
    // the matched bucket's risk profile + playbook inline. Returns
    // empty string if no match (token is unclassified).
    const narrativeHtml = renderNarrativeSection(result.symbol, result.name);

    // Sub-score breakdown (same 6 categories as the hover tooltip)
    // — surfaced in the panel too so users get the visual on the
    // surface they spend most time on. Reuses the same data shape.
    const panelSubScoresHtml = renderPanelSubScores(result.subScores);

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

      narrativeHtml +

      '<div class="trusty-pp-section">' +
        '<div class="trusty-pp-section-title">🛡️ Safety</div>' +
        '<ul class="trusty-tt-checks">' + checksHtml + '</ul>' +
      '</div>' +

      panelSubScoresHtml +

      '<div class="trusty-pp-section" data-trusty-section="kols">' +
        '<div class="trusty-pp-section-title">🐦 Top KOL mentions</div>' +
        (blurred ? renderLockedKolsBody() : renderKolsCta()) +
      '</div>' +

      '<div class="trusty-pp-section" data-trusty-section="activity"' +
        (blurred ? '' : ' style="display:none;"') + '>' +
        '<div class="trusty-pp-section-title">📈 X activity</div>' +
        (blurred ? renderLockedActivityBody() : renderActivityBody(null)) +
      '</div>' +

      '<div class="trusty-pp-section" data-trusty-section="square"' +
        (blurred ? '' : ' style="display:none;"') + '>' +
        '<div class="trusty-pp-section-title">🟡 Binance Square activity</div>' +
        (blurred ? renderLockedSquareBody() : renderSquareActivityBody(null)) +
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

      buildTradeRow(result.chain || chain, ca) +

      (blurred
        ? '<div class="trusty-pp-section trusty-pp-upgrade-inline">' +
            '<div class="trusty-pp-upgrade-inline-text">' +
              '<span class="trusty-pp-upgrade-inline-spark">✨</span>' +
              '<span><strong>Unlock KOL data + X activity</strong><br>' +
              '<span class="trusty-pp-upgrade-inline-sub">Click the Trusty icon (top-right of your browser) → choose Monthly $5 or Yearly $50</span></span>' +
            '</div>' +
            '<div class="trusty-pp-upgrade-inline-arrow" aria-hidden="true">↗</div>' +
          '</div>'
        : '') +

      '<div class="trusty-pp-footer">' +
        'Open the full report on ' +
        '<a href="https://trustyai.tech/?ca=' + encodeURIComponent(ca) + '&chain=' + encodeURIComponent(chain) + '&utm_source=extension_paid" target="_blank" rel="noopener">trustyai.tech →</a>' +
      '</div>';

    document.body.appendChild(panel);
    panel.querySelector(".trusty-pp-close").addEventListener("click", closePaidPanel);
    document.documentElement.style.overflow = "hidden";

    // Free users: the inline upgrade card is informational (no click
    // action) because subscription only happens in the extension popup.
    // We can't programmatically open another extension's popup from a
    // content script, so we tell the user to click the toolbar icon.
    // Disable the click-to-reveal Sorsa CTA inside the free panel —
    // KOLs are locked entirely for free users; the reveal CTA would
    // be confusing in this layout.
    if (blurred) {
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

    // Click anywhere on a sub-score row to expand its explanation
    // inline (matches the website's Learn pattern). Delegated so it
    // works regardless of when the row was rendered.
    panel.addEventListener("click", onSubRowClick);

    // Lazy swap-quote enrichment. Read-only display — execution still
    // happens in the user's wallet via the existing Trade buttons.
    // Silent no-op if the endpoint is unavailable or returns no route.
    const quoteSlot = panel.querySelector("[data-trusty-quote]");
    if (quoteSlot && window.TrustyAPI && window.TrustyAPI.getSwapQuote) {
      const quoteChain = result.chain || chain;
      window.TrustyAPI.getSwapQuote(ca, quoteChain).then(function (q) {
        if (!quoteSlot.isConnected) return;
        const html = renderQuoteLine(q, quoteChain);
        if (!html) return;
        quoteSlot.innerHTML = html;
        quoteSlot.style.display = "block";
      }).catch(function () { /* silent */ });
    }

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
      // Result-handling policy for a SAFETY product:
      // - Real worker data → display as-is.
      // - Mock fallback (worker timed out / GoPlus throttled the worker IP) →
      //   NEVER render the mock as if it were real. Hash-derived "scores"
      //   on a safety pill are actively misleading — a token that's
      //   genuinely safe would show "❌ Not a honeypot, 42/100 RUN" simply
      //   because its address hashes to 42. That's worse than a slow load.
      //   Instead, keep the pill in "scanning…" state, retry behind the
      //   scenes, and if still no real data after the retry, fall back
      //   to an explicit "data unavailable" state (gray, "?" score).
      function applyPendingState(pill) {
        pill.classList.remove(PILL_CLASS + "-loading");
        pill.classList.add(PILL_CLASS + "-pending");
        const sc = pill.querySelector("." + PILL_CLASS + "-score");
        if (sc) sc.textContent = "?";
        // Stash a sentinel result so the tooltip can render an explanatory
        // message instead of "Scanning the chain…" indefinitely.
        pill._trustyResult = { _isMock: true, _unavailable: true, ca: ca, chain: chain };
      }

      const handle = function (result) {
        if (result && result._isMock) {
          // Keep the pill in "scanning…" state — don't show mock data.
          // Schedule a retry: by then the worker has usually completed
          // its scan and cached the real result in KV.
          setTimeout(function () {
            if (!pill.isConnected) return;
            window.TrustyAPI.scan(ca, chain)
              .then(function (r2) {
                if (r2 && !r2._isMock) {
                  applyResultToPill(pill, r2);
                } else {
                  applyPendingState(pill);
                }
              })
              .catch(function () { applyPendingState(pill); });
          }, 5000);
        } else {
          applyResultToPill(pill, result);
        }
      };
      window.TrustyAPI.scan(ca, chain)
        .then(handle)
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
