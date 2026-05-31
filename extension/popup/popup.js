/* ================================================================
   Trusty AI popup — subscription + tier display
   ================================================================ */

(function () {
  "use strict";

  // Version from manifest
  const versionBadge = document.getElementById("versionBadge");
  if (versionBadge && chrome.runtime && chrome.runtime.getManifest) {
    versionBadge.textContent = "v" + chrome.runtime.getManifest().version;
  }

  const $ = function (id) { return document.getElementById(id); };

  function shortAddr(a) {
    return a ? a.slice(0, 6) + "…" + a.slice(-4) : "—";
  }

  function fmtDate(ms) {
    if (!ms) return "—";
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  function renderTier(rec) {
    const pill = $("tierPill");
    const label = $("tierLabel");
    const verified = $("tierVerified");
    const subSection = $("subSection");
    const subPending = $("subPending");

    const tier = rec && rec.tier;
    const sub = rec && rec.subscription;

    if (tier !== "paid") {
      pill.textContent = "FREE";
      pill.classList.remove("paid");

      if (rec && rec.expired) {
        label.textContent = "Subscription expired — renew below";
      } else {
        label.textContent = "Subscribe to unlock paid features";
      }
      verified.style.display = "none";

      // Subscription section: visible when free, with pending overlay if waiting
      subSection.style.display = "block";
      if (sub && sub.status === "pending") {
        subPending.style.display = "block";
        // Hide the plan buttons while pending so user doesn't double-pay
        document.querySelectorAll(".sub-plan").forEach(function (b) { b.style.display = "none"; });
        $("subSection").querySelector(".sub-hint").style.display = "none";
      } else {
        subPending.style.display = "none";
        document.querySelectorAll(".sub-plan").forEach(function (b) { b.style.display = ""; });
        $("subSection").querySelector(".sub-hint").style.display = "";
      }
      return;
    }

    // Paid state via subscription (or code redemption)
    pill.textContent = "PAID";
    pill.classList.add("paid");
    label.textContent = "Unlimited scans · KOLs · X activity unlocked";
    verified.style.display = "block";
    subSection.style.display = "none";

    if (sub) {
      var planLabel;
      if (sub.plan === "yearly") planLabel = "Yearly · $50";
      else if (sub.plan === "monthly") planLabel = "Monthly · $5";
      else if (sub.plan === "lifetime") planLabel = "Lifetime · code";
      else if (sub.plan === "trial-7d") planLabel = "Trial · 7-day code";
      else if (sub.via === "code") planLabel = "Code · " + (sub.codeType || "promo");
      else planLabel = sub.plan || "Paid";
      $("tierPlan").textContent = planLabel;
      $("tierPlan").title = sub.via === "code" ? "Activated via redemption code" : "Subscription via NOWPayments";
      $("tierExpires").textContent = fmtDate(sub.expiresAt);

      // Render the recovery code if the worker surfaced one
      renderRecoveryCode(sub);
    }
  }

  function renderRecoveryCode(sub) {
    var block = $("recoveryBlock");
    if (!block) return;
    if (!sub || !sub.recoveryCode) {
      block.style.display = "none";
      return;
    }
    block.style.display = "block";
    $("recoveryCode").textContent = sub.recoveryCode;
    var hint = $("recoveryHint");
    if (sub.recoveryUsed) {
      block.classList.add("used");
      if (hint) hint.textContent = "Already redeemed on a backup device";
    } else {
      block.classList.remove("used");
      if (hint) hint.textContent = "1 use · save it now (paste on a 2nd Chrome install)";
    }
  }

  async function init() {
    const rec = await window.TrustyTier.getTier();
    renderTier(rec);
    renderWatchlist(); // local state first — fast paint
    // Background: pull latest watchlist from server, re-render once it lands
    window.TrustyTier.refreshWatchlist().then(function () { renderWatchlist(); });
    // If we have a pending sub, kick off polling on popup open
    if (rec && rec.subscription && rec.subscription.status === "pending") {
      pollSubscription();
    } else if (rec && rec.subscription && rec.subscription.status === "paid") {
      // Refresh once on open in case server status moved on
      window.TrustyTier.refreshSubscription().then(function () { reload(); });
    }
  }

  /* ── Watchlist rendering ── */

  function ago(ms) {
    const m = Math.floor((Date.now() - ms) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24);
    return d + "d ago";
  }

  async function renderWatchlist() {
    const list = $("wlList");
    const countEl = $("wlCount");
    const seeAll = $("wlSeeAll");
    const items = await window.TrustyTier.getWatchlist();
    countEl.textContent = String(items.length);

    if (!items.length) {
      list.innerHTML = '<div class="wl-empty">No saved tokens yet.<br><strong>Click the ☆ on any pill</strong> to save it.</div>';
      seeAll.style.display = "none";
      return;
    }
    const top3 = items.slice(0, 3);
    list.innerHTML = top3.map(function (it) {
      const symbol = it.symbol ? "$" + it.symbol.toUpperCase().replace(/^\$/, "") : shortAddr(it.ca);
      const chain = (it.chain || "evm").toUpperCase();
      const trustyUrl = "https://trustyai.tech/?ca=" + encodeURIComponent(it.ca) +
                       "&chain=" + encodeURIComponent(it.chain || "evm") +
                       "&utm_source=extension_watchlist";
      return '<a class="wl-row" href="' + trustyUrl + '" target="_blank" rel="noopener" data-ca="' + escapeAttr(it.ca) + '" data-chain="' + escapeAttr(it.chain || "evm") + '">' +
        '<span class="wl-row-chain">' + escapeText(chain) + '</span>' +
        '<span class="wl-row-symbol">' + escapeText(symbol) + '</span>' +
        '<span class="wl-row-time">' + ago(it.addedAt) + '</span>' +
        '<button class="wl-row-remove" type="button" aria-label="Remove" title="Remove">×</button>' +
      '</a>';
    }).join("");

    // Wire remove buttons
    list.querySelectorAll(".wl-row-remove").forEach(function (btn) {
      btn.addEventListener("click", async function (e) {
        e.preventDefault();
        e.stopPropagation();
        const row = btn.closest(".wl-row");
        if (!row) return;
        await window.TrustyTier.watchlistRemove(row.dataset.ca, row.dataset.chain);
        renderWatchlist();
      });
    });

    seeAll.style.display = items.length > 3 ? "block" : "none";

    // Pass the persistent subId via URL hash so trustyai.tech/watchlist/
    // can fetch the cloud list. Hash isn't sent over HTTP — stays
    // client-side, never appears in server access logs.
    if (items.length > 3) {
      window.TrustyTier.getOrCreateSubId().then(function (subId) {
        seeAll.href = "https://trustyai.tech/watchlist/#sub=" + encodeURIComponent(subId);
      });
    }
  }

  function escapeText(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeText(s).replace(/"/g, "&quot;");
  }

  async function reload() {
    const fresh = await window.TrustyTier.getTier();
    renderTier(fresh);
  }

  /* ── Subscription button handlers + status polling ── */

  function showSubError(msg) {
    let el = $("subError");
    if (!el) {
      el = document.createElement("div");
      el.id = "subError";
      el.className = "sub-error";
      $("subSection").appendChild(el);
    }
    el.textContent = msg;
  }

  function clearSubError() {
    const el = $("subError");
    if (el) el.remove();
  }

  async function onSubscribeClick(e) {
    clearSubError();
    const btn = e.currentTarget;
    const plan = btn.dataset.plan;
    if (plan !== "monthly" && plan !== "yearly") return;

    document.querySelectorAll(".sub-plan").forEach(function (b) { b.disabled = true; });
    const result = await window.TrustyTier.startSubscription(plan);
    document.querySelectorAll(".sub-plan").forEach(function (b) { b.disabled = false; });

    if (!result.ok) {
      showSubError(result.error || "Could not start subscription.");
      return;
    }
    // Open NOWPayments hosted checkout in a new tab
    chrome.tabs.create({ url: result.invoiceUrl });
    // Re-render to show pending state
    await reload();
    pollSubscription();
  }

  let pollTimer = null;
  function pollSubscription() {
    if (pollTimer) return;
    let interval = 5000; // 5s for first 60s, then back off
    let elapsed = 0;
    const tick = async function () {
      elapsed += interval;
      const r = await window.TrustyTier.refreshSubscription();
      if (!r.ok) {
        // network blip — keep trying
      } else if (r.status === "paid") {
        clearTimeout(pollTimer); pollTimer = null;
        await reload();
        return;
      } else if (r.status === "none") {
        // server cleaned up the pending entry (likely expired/cancelled)
        clearTimeout(pollTimer); pollTimer = null;
        await reload();
        return;
      }
      // Back off after 60s, give up after 30 min
      if (elapsed > 1_800_000) { clearTimeout(pollTimer); pollTimer = null; return; }
      if (elapsed > 60_000) interval = 15000;
      pollTimer = setTimeout(tick, interval);
    };
    pollTimer = setTimeout(tick, interval);
  }

  async function onSubCancel() {
    // Local cancel — clears the pending row in chrome.storage so the
    // user can pick a different plan. The NOWPayments invoice is left
    // alone (it'll auto-expire after 24h or whenever NOWP gives up).
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    await window.TrustyTier.refreshSubscription(); // ensure local state is current
    chrome.storage.local.remove("trusty_sub_v1", function () {
      reload();
    });
  }

  // ── Code redemption ──

  function showRedeemMsg(text, ok) {
    let el = $("redeemMsg");
    if (!el) {
      el = document.createElement("div");
      el.id = "redeemMsg";
      el.className = "redeem-msg";
      $("redeemSection").appendChild(el);
    }
    el.className = "redeem-msg " + (ok ? "ok" : "err");
    el.textContent = text;
  }

  function clearRedeemMsg() {
    const el = $("redeemMsg");
    if (el) el.remove();
  }

  async function onRedeemClick() {
    clearRedeemMsg();
    const input = $("redeemInput");
    const btn = $("redeemBtn");
    const code = (input.value || "").trim().toUpperCase();
    if (!code) {
      showRedeemMsg("Paste your code first.", false);
      return;
    }
    btn.disabled = true;
    btn.textContent = "…";
    try {
      const subId = await window.TrustyTier.getOrCreateSubId();
      const res = await fetch("https://api.trustyai.tech/api/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ code, subId }),
      });
      const data = await res.json().catch(function () { return null; });
      if (!res.ok || !data || !data.ok) {
        showRedeemMsg((data && data.error) || "Could not redeem this code.", false);
        return;
      }
      showRedeemMsg(
        "Redeemed! " + (data.type === "lifetime" ? "Lifetime access unlocked." :
                        "Paid for " + (data.durationDays || "—") + " days."),
        true
      );
      // Refresh subscription state from server, then re-render UI
      await window.TrustyTier.refreshSubscription();
      await reload();
      input.value = "";
    } catch (e) {
      showRedeemMsg("Network error — try again.", false);
    } finally {
      btn.disabled = false;
      btn.textContent = "Redeem";
    }
  }

  function onRedeemToggle() {
    const form = $("redeemForm");
    const toggle = $("redeemToggle");
    if (!form || !toggle) return;
    const open = form.style.display !== "none";
    form.style.display = open ? "none" : "flex";
    toggle.style.display = open ? "block" : "none";
    if (!open) $("redeemInput").focus();
  }

  function onRecoveryCopy() {
    const codeEl = $("recoveryCode");
    if (!codeEl) return;
    const code = codeEl.textContent.trim();
    try {
      navigator.clipboard.writeText(code);
      const btn = $("recoveryCopyBtn");
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = orig; }, 1200);
      }
    } catch (e) { /* clipboard not available — ignore */ }
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Subscription buttons
    document.querySelectorAll(".sub-plan").forEach(function (btn) {
      btn.addEventListener("click", onSubscribeClick);
    });
    const cancelBtn = $("subCancelBtn");
    if (cancelBtn) cancelBtn.addEventListener("click", onSubCancel);

    // Redeem code wiring
    const redeemToggle = $("redeemToggle");
    if (redeemToggle) redeemToggle.addEventListener("click", onRedeemToggle);
    const redeemBtn = $("redeemBtn");
    if (redeemBtn) redeemBtn.addEventListener("click", onRedeemClick);
    const redeemInput = $("redeemInput");
    if (redeemInput) redeemInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") onRedeemClick();
    });
    const recoveryCopy = $("recoveryCopyBtn");
    if (recoveryCopy) recoveryCopy.addEventListener("click", onRecoveryCopy);

    // Tab navigation — Home (default) vs Trending
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const target = btn.getAttribute("data-tab");
        switchTab(target);
      });
    });

    // How-it-works helper — show on first opens, dismissible per-device.
    // Storage key persists across popup re-opens via localStorage; chrome
    // extension popups have their own localStorage scope.
    setupHelpSection();

    // What's-new banner — shown once per version after an update lands.
    setupWhatsNew();

    init();
  });

  const WHATS_NEW_KEY = "trusty_whatsnew_dismissed";
  function setupWhatsNew() {
    const banner = $("whatsNew");
    if (!banner) return;
    // Tie the dismiss state to the manifest version. If user dismissed
    // v0.5.0's callout and v0.6.0 ships, the banner shows again automatically.
    const version = (chrome.runtime && chrome.runtime.getManifest)
      ? chrome.runtime.getManifest().version
      : "0.0.0";
    let dismissedVer = "";
    try { dismissedVer = localStorage.getItem(WHATS_NEW_KEY) || ""; } catch (_) {}
    if (dismissedVer === version) return; // already dismissed this version
    banner.style.display = "";
    const btn = $("whatsNewClose");
    if (btn) {
      btn.addEventListener("click", function () {
        try { localStorage.setItem(WHATS_NEW_KEY, version); } catch (_) {}
        banner.style.display = "none";
      });
    }
  }

  const HELP_DISMISSED_KEY = "trusty_help_dismissed_v1";
  function setupHelpSection() {
    const section = $("helpSection");
    if (!section) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(HELP_DISMISSED_KEY) === "1"; } catch (_) {}
    section.style.display = dismissed ? "none" : "";
    const btn = $("helpDismiss");
    if (btn) {
      btn.addEventListener("click", function () {
        try { localStorage.setItem(HELP_DISMISSED_KEY, "1"); } catch (_) {}
        section.style.display = "none";
      });
    }
  }

  /* ──────────────────────────────────────────────────────────────
     Trending tab — fetches data/trending.json from trustyai.tech.

     Reuses the same JSON the website uses, so the BNB list and the
     pinned $TRUSTY entry render identically across surfaces.

     Cached in module scope for the lifetime of the popup; popup
     re-opens are fast (no refetch within ~5 min) but always fresh
     enough since the cron updates every 15 min anyway.
     ────────────────────────────────────────────────────────────── */
  const TRENDING_URL = "https://trustyai.tech/data/trending.json";
  const TRENDING_CACHE_MS = 5 * 60 * 1000;
  const TRENDING_CHAIN_KEY = "trusty_popup_trending_chain";
  let trendingCache = { at: 0, data: null };

  function getSelectedChain() {
    const select = $("popupTrendingChain");
    if (select && select.value) return select.value;
    try { return localStorage.getItem(TRENDING_CHAIN_KEY) || "bnb"; }
    catch (_) { return "bnb"; }
  }

  function switchTab(target) {
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === target);
    });
    document.querySelectorAll(".tab-view").forEach(function (v) {
      v.style.display = v.getAttribute("data-view") === target ? "" : "none";
    });
    if (target === "scan") {
      const input = $("scanCaInput");
      if (!scanWired) {
        const btn = $("scanBtn");
        if (btn) btn.addEventListener("click", doScan);
        if (input) {
          input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") doScan();
          });
        }
        scanWired = true;
      }
      if (input) input.focus();
      return;
    }
    if (target === "trending") {
      // Restore last selected chain preference on first activation
      const select = $("popupTrendingChain");
      if (select && !select.dataset.wired) {
        try {
          const remembered = localStorage.getItem(TRENDING_CHAIN_KEY);
          if (remembered) select.value = remembered;
        } catch (_) {}
        select.addEventListener("change", function () {
          try { localStorage.setItem(TRENDING_CHAIN_KEY, select.value); } catch (_) {}
          // Re-render from cache if available, otherwise refetch
          if (trendingCache.data) {
            renderTrendingTab(trendingCache.data, $("popupTrendingList"), $("popupTrendingUpdated"));
          } else {
            loadTrendingTab();
          }
        });
        select.dataset.wired = "1";
      }
      loadTrendingTab();
    }
  }

  async function loadTrendingTab() {
    const listEl = $("popupTrendingList");
    const updatedEl = $("popupTrendingUpdated");
    if (!listEl) return;

    // Serve cached data if fresh.
    const now = Date.now();
    if (trendingCache.data && (now - trendingCache.at) < TRENDING_CACHE_MS) {
      renderTrendingTab(trendingCache.data, listEl, updatedEl);
      return;
    }

    try {
      const res = await fetch(TRENDING_URL + "?t=" + now);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      trendingCache = { at: now, data: data };
      renderTrendingTab(data, listEl, updatedEl);
    } catch (e) {
      listEl.innerHTML = '<div class="trending-tab-error">Could not load trending. Try again later.</div>';
      if (updatedEl) updatedEl.textContent = "error";
    }
  }

  function renderTrendingTab(data, listEl, updatedEl) {
    const chain = getSelectedChain();
    const coins = (data && data.categories && data.categories[chain]) || [];
    if (!coins.length) {
      listEl.innerHTML = '<div class="trending-tab-empty">No hot tokens on this chain right now.</div>';
      if (updatedEl) updatedEl.textContent = "—";
      return;
    }

    if (updatedEl && data.updatedAt) {
      updatedEl.textContent = "updated " + timeAgo(new Date(data.updatedAt).getTime());
    }

    listEl.innerHTML = coins.slice(0, 10).map(function (coin, i) {
      const isPinned = coin.pinned === true;
      const ca = coin.assetId || "";
      const change = Number(coin.priceChange24h) || 0;
      const changeClass = change >= 0 ? "up" : "down";
      const changeStr = (change >= 0 ? "+" : "") + change.toFixed(1) + "%";
      const mc = fmtCompactUsd(coin.marketCapUsd);
      const symbol = coin.symbol ? "$" + escapeHtml(coin.symbol) : "—";
      const name = escapeHtml(coin.name || "—");
      const rank = isPinned ? "★" : (i + 1);
      const logo = coin.logoUrl
        ? '<img src="' + escapeAttr(coin.logoUrl) + '" alt="" onerror="this.style.display=\'none\'">'
        : '🪙';
      const href = "https://trustyai.tech/?ca=" + encodeURIComponent(ca);
      return ''
        + '<a class="trending-tab-item' + (isPinned ? ' pinned' : '') + '" '
        +     'href="' + href + '" target="_blank" rel="noopener">'
        +   '<div class="trending-tab-rank">' + rank + '</div>'
        +   '<div class="trending-tab-icon">' + logo + '</div>'
        +   '<div class="trending-tab-info">'
        +     '<div class="trending-tab-symbol">' + symbol + '</div>'
        +     '<div class="trending-tab-name">' + name + '</div>'
        +   '</div>'
        +   '<div class="trending-tab-mc">' + mc + '</div>'
        +   '<div class="trending-tab-change ' + changeClass + '">' + changeStr + '</div>'
        + '</a>';
    }).join("");
  }

  function fmtCompactUsd(n) {
    if (!n || !isFinite(n)) return "—";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
    return "$" + n.toFixed(0);
  }

  function timeAgo(ts) {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return s + "s ago";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* ──────────────────────────────────────────────────────────────
     Scan tab — paste a contract address, get the same public safety
     verdict the pills use (/api/scan). Free feature; no tier gating.
     ────────────────────────────────────────────────────────────── */
  const SCAN_API = "https://api.trustyai.tech/api/scan";
  let scanWired = false;

  // Chains Trusty Swap covers → canonical ?chain= value (else no Trade btn).
  function scanSupportedSwapChain(chain) {
    var c = (chain || "").toLowerCase();
    if (c === "bsc") return "bsc";
    if (c === "ethereum") return "ethereum";
    if (c === "base") return "base";
    if (c === "polygon") return "polygon";
    return null;
  }

  async function doScan() {
    const input = $("scanCaInput");
    const chainSel = $("scanChain");
    const result = $("scanResult");
    const btn = $("scanBtn");
    if (!input || !result) return;
    const ca = (input.value || "").trim();
    if (!ca) {
      result.innerHTML = '<div class="scan-msg err">Paste a contract address first.</div>';
      return;
    }
    const chain = (chainSel && chainSel.value) || "bsc";
    if (btn) { btn.disabled = true; btn.textContent = "Scanning…"; }
    result.innerHTML = '<div class="scan-loading">Scanning…</div>';
    try {
      const res = await fetch(SCAN_API + "?ca=" + encodeURIComponent(ca) + "&chain=" + encodeURIComponent(chain));
      const d = await res.json().catch(function () { return null; });
      if (!d || d.error) {
        result.innerHTML = '<div class="scan-msg err">' + escapeHtml((d && d.error) || "Couldn't scan that address.") + '</div>';
        return;
      }
      renderScanResult(d, ca, chain, result);
    } catch (e) {
      result.innerHTML = '<div class="scan-msg err">Network error — try again.</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Scan"; }
    }
  }

  // 6-category sub-score labels — mirrors the pill's SUB_SCORE_LABELS.
  const SCAN_SUB_LABELS = [
    ["chainReputation", "Chain Reputation"],
    ["narrative", "Narrative"],
    ["ownership", "Ownership"],
    ["ageTiming", "Age / Timing"],
    ["socialPresence", "Social Presence"],
    ["supplySafety", "Supply Safety"],
  ];
  function scanScoreClass(v) { return v >= 70 ? "ape" : v >= 40 ? "cau" : "run"; }

  function renderSubScoreBars(subScores) {
    if (!subScores || typeof subScores !== "object") return "";
    const rows = SCAN_SUB_LABELS.map(function (pair) {
      let v = Number(subScores[pair[0]]);
      if (!isFinite(v)) v = 0;
      const w = Math.max(0, Math.min(100, v));
      return '<div class="scan-sub-row">' +
        '<span class="scan-sub-label">' + pair[1] + '</span>' +
        '<span class="scan-sub-bar"><span class="scan-sub-fill ' + scanScoreClass(v) + '" style="width:' + w + '%"></span></span>' +
        '<span class="scan-sub-val">' + v + '</span>' +
      '</div>';
    }).join("");
    return '<div class="scan-subs"><div class="scan-section-title">Score breakdown</div>' + rows + '</div>';
  }

  function renderScanResult(d, ca, chain, el) {
    const verdict = String(d.verdict || "").toUpperCase();
    const vClass = verdict === "APE" ? "ape" : verdict === "RUN" ? "run" : "cau";
    const score = (d.score == null ? "?" : d.score);
    const sym = d.symbol ? escapeHtml(d.symbol) : "—";
    const name = escapeHtml(d.name || "");
    const md = d.marketData || {};
    const ch = (md.change && typeof md.change.h24 !== "undefined") ? Number(md.change.h24) : null;
    const chStr = ch == null ? "" : (ch >= 0 ? "+" : "") + ch + "%";
    const chCls = ch == null ? "" : (ch >= 0 ? "up" : "down");
    const checks = Array.isArray(d.checks) ? d.checks : [];
    const checksHtml = checks.map(function (c) {
      return '<div class="scan-check ' + (c.ok ? "ok" : "no") + '">' +
        '<span class="scan-check-mark">' + (c.ok ? "✓" : "✗") + '</span>' +
        '<span>' + escapeHtml(c.label || "") + '</span></div>';
    }).join("");
    const reportUrl = "https://trustyai.tech/?ca=" + encodeURIComponent(ca) +
      "&chain=" + encodeURIComponent(chain) + "&utm_source=extension_scan";
    const swapChain = scanSupportedSwapChain(chain);
    const tradeBtn = swapChain
      ? '<a class="scan-cta trade" href="https://trustyai.tech/swap?ca=' + encodeURIComponent(ca) +
        '&chain=' + encodeURIComponent(swapChain) + '" target="_blank" rel="noopener">⚡ Trade</a>'
      : '';
    const metaBits = [];
    if (md.mcap) metaBits.push("MC " + escapeHtml(md.mcap));
    if (md.volume24h) metaBits.push("Vol " + escapeHtml(md.volume24h));
    if (chStr) metaBits.push('<span class="' + chCls + '">' + chStr + '</span>');
    el.innerHTML =
      '<div class="scan-card ' + vClass + '">' +
        '<div class="scan-card-top">' +
          '<div class="scan-card-sym">' + sym + (name ? ' <span class="scan-card-name">' + name + '</span>' : '') + '</div>' +
          '<div class="scan-verdict ' + vClass + '">' + escapeHtml(verdict || "—") + ' ' + score + '/100</div>' +
        '</div>' +
        (metaBits.length ? '<div class="scan-card-meta">' + metaBits.join(" · ") + '</div>' : '') +
        (checksHtml ? '<div class="scan-checks">' + checksHtml + '</div>' : '') +
        renderSubScoreBars(d.subScores) +
        '<div class="scan-paid" id="scanPaidArea"></div>' +
        '<div class="scan-ctas">' +
          '<a class="scan-cta report" href="' + reportUrl + '" target="_blank" rel="noopener">Full report ↗</a>' +
          tradeBtn +
        '</div>' +
      '</div>';
    // Paid sections (or a locked tease for free users) fill in after.
    fillScanPaidArea(d, ca, chain);
  }

  // Tier-gated extras — matches the pill's paid panel. Free users see a
  // locked tease; paid users get paidChecks, Topaz, and live KOL/X/Square.
  async function fillScanPaidArea(d, ca, chain) {
    const area = document.getElementById("scanPaidArea");
    if (!area) return;
    let paid = false;
    try {
      const rec = await window.TrustyTier.getTier();
      paid = !!(rec && rec.tier === "paid");
    } catch (e) { paid = false; }

    if (!paid) {
      area.innerHTML =
        '<div class="scan-locked">' +
          '<div class="scan-locked-title">🔒 Unlock with Paid</div>' +
          '<div class="scan-locked-list">KOL activity · X velocity · Binance Square sentiment · Topaz pool · coord-shill detection</div>' +
          '<div class="scan-locked-hint">Subscribe on the Home tab — $5/mo.</div>' +
        '</div>';
      return;
    }

    let html = "";
    const paidChecks = Array.isArray(d.paidChecks) ? d.paidChecks : [];
    if (paidChecks.length) {
      html += '<div class="scan-section-title">Pro checks</div><div class="scan-checks">' +
        paidChecks.map(function (c) {
          return '<div class="scan-check ' + (c.ok ? "ok" : "no") + '">' +
            '<span class="scan-check-mark">' + (c.ok ? "✓" : "✗") + '</span>' +
            '<span>' + escapeHtml(c.label || "") + '</span></div>';
        }).join("") + '</div>';
    }
    if (d.topaz) {
      if (d.topaz.hasPool) {
        const bits = [];
        if (d.topaz.tvl) bits.push("TVL " + escapeHtml(String(d.topaz.tvl)));
        if (d.topaz.feeApr) bits.push("APR " + escapeHtml(String(d.topaz.feeApr)));
        html += '<div class="scan-topaz has">🔷 Topaz Dex pool' + (bits.length ? ' · ' + bits.join(" · ") : "") + '</div>';
      } else {
        html += '<div class="scan-topaz">🔷 No Topaz Dex pool</div>';
      }
    }
    html += '<div class="scan-section-title">Social</div><div id="scanSocial"><div class="scan-loading">Loading KOL &amp; X activity…</div></div>';
    area.innerHTML = html;

    try {
      const sym = d.symbol ? String(d.symbol).replace(/^\$/, "") : "";
      const k = await fetch("https://api.trustyai.tech/api/kols?ca=" + encodeURIComponent(ca) +
        "&chain=" + encodeURIComponent(chain) + "&symbol=" + encodeURIComponent(sym))
        .then(function (r) { return r.json(); });
      renderScanSocial(k, document.getElementById("scanSocial"));
    } catch (e) {
      const s = document.getElementById("scanSocial");
      if (s) s.innerHTML = '<div class="scan-msg err">Couldn\'t load social data.</div>';
    }
  }

  function renderScanSocial(k, el) {
    if (!el) return;
    k = k || {};
    const act = k.activity || {};
    const sq = k.squareActivity || {};
    const kols = Array.isArray(k.kols) ? k.kols : [];
    let html = '<div class="scan-stat-grid">' +
      '<div class="scan-stat"><div class="scan-stat-num">' + (Number(act.tweets24h) || 0).toLocaleString() + '</div><div class="scan-stat-lbl">tweets / 24h</div></div>' +
      '<div class="scan-stat"><div class="scan-stat-num">' + escapeHtml(act.sentiment || "—") + '</div><div class="scan-stat-lbl">X sentiment</div></div>' +
      '<div class="scan-stat"><div class="scan-stat-num">' + (Number(sq.mentions7d) || 0).toLocaleString() + '</div><div class="scan-stat-lbl">Square / 7d</div></div>' +
      '<div class="scan-stat"><div class="scan-stat-num ' + (act.coordShill ? "down" : "up") + '">' + (act.coordShill ? "DETECTED" : "Clean") + '</div><div class="scan-stat-lbl">coord. shill</div></div>' +
    '</div>';
    if (kols.length) {
      html += '<div class="scan-kols">' + kols.slice(0, 4).map(function (t) {
        const handle = escapeHtml(t.handle || "");
        const eng = (Number(t.likes) || 0) + (Number(t.retweets) || 0);
        const txt = escapeHtml(String(t.text || "").slice(0, 90));
        const url = t.tweetUrl ? escapeAttr(t.tweetUrl) : "";
        const inner = '<div class="scan-kol-top"><span class="scan-kol-handle">' + handle + '</span><span class="scan-kol-eng">♥ ' + eng + '</span></div>' +
          (txt ? '<div class="scan-kol-text">' + txt + '</div>' : '');
        return url
          ? '<a class="scan-kol" href="' + url + '" target="_blank" rel="noopener">' + inner + '</a>'
          : '<div class="scan-kol">' + inner + '</div>';
      }).join("") + '</div>';
    } else {
      html += '<div class="scan-hint">No KOL tweets in the last 24h.</div>';
    }
    el.innerHTML = html;
  }
})();
