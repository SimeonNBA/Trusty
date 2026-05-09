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

    init();
  });
})();
