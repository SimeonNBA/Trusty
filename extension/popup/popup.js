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

    if (!rec || rec.tier !== "paid") {
      pill.textContent = "FREE";
      pill.classList.remove("paid");
      // Show the actual balance vs threshold if we just verified
      if (rec && typeof rec.balance === "number" && rec.address) {
        label.textContent = "Found " + fmtBalance(rec.balance) +
          " — need 325K $TRUSTY";
      } else {
        label.textContent = rec && rec.expired
          ? "Tier expired — re-verify to renew"
          : "Hold $TRUSTY to unlock paid features";
      }
      body.style.display = "block";
      verified.style.display = "none";
      // pre-fill the address if we have one
      if (rec && rec.address) {
        $("walletInput").value = rec.address;
      }
      return;
    }

    // Paid state
    pill.textContent = "PAID";
    pill.classList.add("paid");
    label.textContent = "Unlimited scans · KOLs · X activity unlocked";
    body.style.display = "none";
    verified.style.display = "block";
    $("tierAddr").textContent = shortAddr(rec.address);
    $("tierAddr").title = rec.address;
    $("tierBalance").textContent = fmtBalance(rec.balance) + " $TRUSTY";
    $("tierExpires").textContent = fmtDate(rec.expiresAt);
  }

  async function init() {
    const rec = await window.TrustyTier.getTier();
    renderTier(rec);
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
    init();
  });
})();
