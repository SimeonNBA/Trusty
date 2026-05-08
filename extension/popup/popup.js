/* ================================================================
   Trusty AI popup — wallet verification + tier display
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

  function fmtBalance(n) {
    if (typeof n !== "number") return "—";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  function fmtDate(ms) {
    if (!ms) return "—";
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  function showError(msg) {
    let el = $("tierError");
    if (!el) {
      el = document.createElement("div");
      el.id = "tierError";
      el.className = "tier-error";
      $("tierBody").appendChild(el);
    }
    el.textContent = msg;
  }

  function clearError() {
    const el = $("tierError");
    if (el) el.remove();
  }

  function renderTier(rec) {
    const pill = $("tierPill");
    const label = $("tierLabel");
    const body = $("tierBody");
    const verified = $("tierVerified");
    const subSection = $("subSection");
    const subPending = $("subPending");

    const tier = rec && rec.tier;
    const sub = rec && rec.subscription;
    const wallet = rec && rec.wallet;

    if (tier !== "paid") {
      pill.textContent = "FREE";
      pill.classList.remove("paid");

      if (wallet && typeof wallet.balance === "number" && wallet.address) {
        label.textContent = "Found " + fmtBalance(wallet.balance) + " — need 325K $TRUSTY";
      } else if (rec && rec.expired) {
        label.textContent = "Tier expired — renew below";
      } else {
        label.textContent = "Hold $TRUSTY or subscribe to unlock paid";
      }
      body.style.display = "block";
      verified.style.display = "none";

      if (wallet && wallet.address) $("walletInput").value = wallet.address;

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

    // Paid state — could be via wallet, subscription, or both
    pill.textContent = "PAID";
    pill.classList.add("paid");
    label.textContent = "Unlimited scans · KOLs · X activity unlocked";
    body.style.display = "none";
    verified.style.display = "block";
    subSection.style.display = "none";

    if (rec.via === "subscription" && sub) {
      $("tierVerifiedLabel").textContent = "Plan";
      $("tierAddr").textContent = sub.plan === "yearly" ? "Yearly · $50" : "Monthly · $5";
      $("tierAddr").title = "Subscription via NOWPayments";
      $("tierBalanceRow").style.display = "none";
      $("tierExpires").textContent = fmtDate(sub.expiresAt);
    } else if (wallet) {
      $("tierVerifiedLabel").textContent = "Wallet";
      $("tierAddr").textContent = shortAddr(wallet.address);
      $("tierAddr").title = wallet.address;
      $("tierBalanceRow").style.display = "";
      $("tierBalance").textContent = fmtBalance(wallet.balance) + " $TRUSTY";
      $("tierExpires").textContent = fmtDate(wallet.expiresAt);
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

  async function onVerify() {
    clearError();
    const btn = $("verifyBtn");
    const input = $("walletInput");
    const addr = (input.value || "").trim();
    if (!addr) {
      showError("Paste a wallet address first.");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Checking…";
    const result = await window.TrustyTier.verifyWallet(addr);
    btn.disabled = false;
    btn.textContent = "Verify wallet";
    if (!result.ok) {
      showError(result.error || "Could not verify wallet.");
      return;
    }
    renderTier(result.record);
  }

  async function onRecheck() {
    const rec = await window.TrustyTier.getTier();
    if (!rec || !rec.address) return init();
    const result = await window.TrustyTier.verifyWallet(rec.address);
    if (result.ok) renderTier(result.record);
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("verifyBtn").addEventListener("click", onVerify);
    $("recheckBtn").addEventListener("click", onRecheck);
    $("walletInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") onVerify();
    });

    // Subscription buttons
    document.querySelectorAll(".sub-plan").forEach(function (btn) {
      btn.addEventListener("click", onSubscribeClick);
    });
    const cancelBtn = $("subCancelBtn");
    if (cancelBtn) cancelBtn.addEventListener("click", onSubCancel);

    init();
  });
})();
