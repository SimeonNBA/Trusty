/* ================================================================
   Trusty AI — Tier verification

   Two paths to paid tier:
     1) Hold path  — paste wallet address, we check $TRUSTY balance
     2) Crypto pay — redeem an access code from NOWPayments (later)

   Day 4: hold path only, with a stubbed BscScan check. Replacing the
   stub with the real call is a one-line change in checkBalance().

   Storage shape (chrome.storage.local):
     trusty_tier_v1 = {
       tier: "free" | "paid",
       address: "0x...",
       balance: 325000,
       verifiedAt: 1714712345000,   // ms epoch
       expiresAt: 1717304345000     // 30 days later
     }
   ================================================================ */

(function () {
  "use strict";

  const KEY = "trusty_tier_v1";
  const TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days
  const PAID_THRESHOLD = 325000;              // ~$50 of $TRUSTY at current price
  const TRUSTY_CONTRACT = "0x65aea108c21439693468FCD542D81C29E8df4444";

  /* ── Storage helpers ─────────────────────────────────────── */

  function load() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([KEY], function (data) {
          resolve(data && data[KEY] ? data[KEY] : null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function save(record) {
    return new Promise(function (resolve) {
      try {
        const obj = {};
        obj[KEY] = record;
        chrome.storage.local.set(obj, function () { resolve(); });
      } catch (e) {
        resolve();
      }
    });
  }

  /* ── Public BSC RPC balance check ────────────────────────────
     We call the BEP-20 contract directly via JSON-RPC eth_call to
     balanceOf(address). No API key required, multiple endpoint
     fallbacks for reliability.
     ────────────────────────────────────────────────────────────── */
  const RPC_ENDPOINTS = [
    "https://bsc-dataseed.binance.org/",
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc.publicnode.com/",
    "https://bsc-dataseed1.ninicoin.io/"
  ];

  // ERC-20 balanceOf(address) — first 4 bytes of keccak256("balanceOf(address)")
  const BALANCE_OF_SELECTOR = "0x70a08231";

  async function checkBalance(address) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return { ok: false, error: "Not a valid BNB Smart Chain address" };
    }

    // Build the eth_call data: selector + 32-byte-padded address
    const paddedAddr = address.slice(2).toLowerCase().padStart(64, "0");
    const callData = BALANCE_OF_SELECTOR + paddedAddr;

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: TRUSTY_CONTRACT, data: callData }, "latest"]
    };

    let lastError = "Unknown";
    for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
      const endpoint = RPC_ENDPOINTS[i];
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) { lastError = "HTTP " + res.status; continue; }
        const json = await res.json();
        if (json.error) { lastError = (json.error.message || "RPC error"); continue; }
        const hex = json.result;
        if (!hex || hex === "0x") { lastError = "Empty RPC result"; continue; }

        // hex is the raw token balance in base units (18 decimals).
        // Divide by 10^14 in BigInt space (keeps result < Number.MAX_SAFE_INTEGER
        // for any realistic supply), then by 10^4 in Number space.
        const raw = BigInt(hex);
        const balance = Number(raw / 100000000000000n) / 10000;

        return { ok: true, balance: balance };
      } catch (e) {
        lastError = (e && e.message) || "Network error";
      }
    }

    return { ok: false, error: "Could not reach BNB Chain RPC — " + lastError };
  }

  /* ── Public API ──────────────────────────────────────────── */

  async function getTier() {
    const rec = await load();
    if (!rec) return { tier: "free" };
    if (rec.expiresAt && Date.now() > rec.expiresAt) {
      return { tier: "free", expired: true, address: rec.address };
    }
    return rec;
  }

  async function verifyWallet(address) {
    const trimmed = (address || "").trim();
    const result = await checkBalance(trimmed);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    const tier = result.balance >= PAID_THRESHOLD ? "paid" : "free";
    const now = Date.now();
    const record = {
      tier: tier,
      address: trimmed,
      balance: result.balance,
      verifiedAt: now,
      expiresAt: now + TTL_MS
    };
    await save(record);
    return { ok: true, record: record };
  }

  async function clearTier() {
    return save(null);
  }

  window.TrustyTier = {
    getTier: getTier,
    verifyWallet: verifyWallet,
    clearTier: clearTier,
    PAID_THRESHOLD: PAID_THRESHOLD,
    TRUSTY_CONTRACT: TRUSTY_CONTRACT,
    TTL_MS: TTL_MS
  };
})();
