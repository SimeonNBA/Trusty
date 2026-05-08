/* ================================================================
   Trusty AI — Tier verification

   Two paths to paid tier (whichever resolves first wins):
     1) Hold path  — paste wallet address, we check $TRUSTY balance
     2) Crypto-pay — NOWPayments subscription ($5/mo or $50/yr)

   Storage shape (chrome.storage.local):
     trusty_tier_v1 = {
       tier: "free" | "paid",
       address: "0x...",
       balance: 325000,
       verifiedAt, expiresAt
     }
     trusty_subid_v1 = "uuid-string"             // persistent identifier
     trusty_sub_v1 = {                            // local copy of server state
       plan: "monthly" | "yearly",
       status: "none" | "pending" | "paid" | "expired",
       expiresAt, paidAt, invoiceId, orderId
     }
   ================================================================ */

(function () {
  "use strict";

  const KEY = "trusty_tier_v1";
  const SUBID_KEY = "trusty_subid_v1";
  const SUB_KEY = "trusty_sub_v1";
  const WL_KEY = "trusty_watchlist_v1";
  const WL_FREE_CAP = 5;
  const TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 days
  const PAID_THRESHOLD = 325000;              // ~$50 of $TRUSTY at current price
  const TRUSTY_CONTRACT = "0x65aea108c21439693468FCD542D81C29E8df4444";
  const API_BASE = "https://api.trustyai.tech";

  /* ── Storage helpers ─────────────────────────────────────── */

  function loadKey(k) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([k], function (data) {
          resolve(data && data[k] != null ? data[k] : null);
        });
      } catch (e) { resolve(null); }
    });
  }

  function saveKey(k, v) {
    return new Promise(function (resolve) {
      try {
        const obj = {};
        obj[k] = v;
        chrome.storage.local.set(obj, function () { resolve(); });
      } catch (e) { resolve(); }
    });
  }

  function load() { return loadKey(KEY); }
  function save(rec) { return saveKey(KEY, rec); }
  function loadSub() { return loadKey(SUB_KEY); }
  function saveSub(rec) { return saveKey(SUB_KEY, rec); }

  /* ── Persistent subscription identifier ──
     Generated once per install, stored in chrome.storage.local.
     Uniquely identifies this user to our /api/subscribe endpoint
     without requiring an account or wallet. */
  async function getOrCreateSubId() {
    let id = await loadKey(SUBID_KEY);
    if (id && /^[a-zA-Z0-9_-]{8,64}$/.test(id)) return id;
    id = newSubId();
    await saveKey(SUBID_KEY, id);
    return id;
  }

  function newSubId() {
    // 16 bytes of randomness, base64url-encoded → 22 char ID
    const buf = new Uint8Array(16);
    (self.crypto || window.crypto).getRandomValues(buf);
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

  /* ── Subscription path (NOWPayments) ─────────────────────────
     The popup creates an invoice and opens NOWPayments hosted
     checkout. After payment, the IPN webhook updates the server
     state. The extension polls /api/subscription to detect the
     status flip and caches the result locally so other surfaces
     (content scripts) can read it without hitting the network. */

  async function startSubscription(plan) {
    if (plan !== "monthly" && plan !== "yearly") {
      return { ok: false, error: "Invalid plan" };
    }
    const subId = await getOrCreateSubId();
    try {
      const r = await fetch(
        API_BASE + "/api/subscribe?plan=" + encodeURIComponent(plan) +
        "&subId=" + encodeURIComponent(subId),
        { method: "POST", headers: { Accept: "application/json" } }
      );
      const data = await r.json().catch(function () { return null; });
      if (!r.ok || !data || !data.invoiceUrl) {
        return { ok: false, error: (data && data.error) || "Could not start subscription" };
      }
      // Track local pending state immediately so the UI can show "waiting for payment"
      await saveSub({
        plan: plan,
        status: "pending",
        invoiceId: data.invoiceId,
        orderId: data.orderId,
        createdAt: Date.now()
      });
      return { ok: true, invoiceUrl: data.invoiceUrl, plan: plan };
    } catch (e) {
      return { ok: false, error: (e && e.message) || "Network error" };
    }
  }

  async function refreshSubscription() {
    const subId = await getOrCreateSubId();
    try {
      const r = await fetch(
        API_BASE + "/api/subscription?subId=" + encodeURIComponent(subId),
        { headers: { Accept: "application/json" } }
      );
      if (!r.ok) return { ok: false };
      const data = await r.json();
      if (!data || data.status === "none") {
        await saveSub(null);
        return { ok: true, status: "none" };
      }
      // Persist latest server view
      await saveSub({
        plan: data.plan,
        status: data.status,
        invoiceId: data.invoiceId,
        orderId: data.orderId,
        paidAt: data.paidAt,
        expiresAt: data.expiresAt,
        refreshedAt: Date.now()
      });
      return { ok: true, status: data.status, expiresAt: data.expiresAt };
    } catch (e) {
      return { ok: false };
    }
  }

  /* ── Watchlist ─────────────────────────────────────────────
     Local mirror of the server-side cloud list. Optimistic writes:
     mutation hits chrome.storage.local immediately, then syncs to
     /api/watchlist in the background. Free users get a 5-item cap;
     paid (either path) is unlimited (server soft-caps at 100). */

  async function getWatchlist() {
    const local = await loadKey(WL_KEY);
    return Array.isArray(local) ? local : [];
  }

  async function setWatchlistLocal(items) {
    await saveKey(WL_KEY, items);
  }

  async function refreshWatchlist() {
    const subId = await getOrCreateSubId();
    try {
      const r = await fetch(
        API_BASE + "/api/watchlist?subId=" + encodeURIComponent(subId),
        { headers: { Accept: "application/json" } }
      );
      if (!r.ok) return { ok: false };
      const data = await r.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      await setWatchlistLocal(items);
      return { ok: true, items: items };
    } catch (e) {
      return { ok: false };
    }
  }

  async function watchlistAdd(item) {
    if (!item || !item.ca) return { ok: false, error: "missing ca" };
    const tier = await getTier();
    const list = await getWatchlist();
    const key = (item.chain || "evm") + ":" + item.ca.toLowerCase();
    // Already in list? No-op.
    if (list.some((x) => ((x.chain || "evm") + ":" + x.ca.toLowerCase()) === key)) {
      return { ok: true, items: list, alreadyWatched: true };
    }
    if (tier.tier !== "paid" && list.length >= WL_FREE_CAP) {
      return { ok: false, error: "cap_reached", cap: WL_FREE_CAP };
    }
    const newItem = {
      ca: item.ca,
      chain: item.chain || "evm",
      symbol: item.symbol || "",
      name: item.name || "",
      addedAt: Date.now()
    };
    const next = [newItem].concat(list);
    await setWatchlistLocal(next);
    // Fire-and-forget cloud sync
    syncWatchlistAdd(newItem).catch(function () { /* will reconcile on next refresh */ });
    return { ok: true, items: next };
  }

  async function watchlistRemove(ca, chain) {
    const list = await getWatchlist();
    const key = (chain || "evm") + ":" + (ca || "").toLowerCase();
    const next = list.filter((x) => ((x.chain || "evm") + ":" + x.ca.toLowerCase()) !== key);
    await setWatchlistLocal(next);
    syncWatchlistRemove({ ca, chain: chain || "evm" }).catch(function () {});
    return { ok: true, items: next };
  }

  async function watchlistContains(ca, chain) {
    const list = await getWatchlist();
    const key = (chain || "evm") + ":" + (ca || "").toLowerCase();
    return list.some((x) => ((x.chain || "evm") + ":" + x.ca.toLowerCase()) === key);
  }

  async function syncWatchlistAdd(item) {
    const subId = await getOrCreateSubId();
    return fetch(API_BASE + "/api/watchlist?subId=" + encodeURIComponent(subId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", item: item })
    });
  }

  async function syncWatchlistRemove(item) {
    const subId = await getOrCreateSubId();
    return fetch(API_BASE + "/api/watchlist?subId=" + encodeURIComponent(subId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", item: item })
    });
  }

  /* ── Public API ──────────────────────────────────────────── */

  async function getTier() {
    // Check both paths; whichever is "paid" and not expired wins.
    const wallet = await load();
    const sub = await loadSub();

    const now = Date.now();
    const walletPaid = wallet && wallet.tier === "paid" && wallet.expiresAt > now;
    const subPaid = sub && sub.status === "paid" && sub.expiresAt > now;

    if (walletPaid || subPaid) {
      return {
        tier: "paid",
        via: subPaid && (!walletPaid || sub.expiresAt > wallet.expiresAt) ? "subscription" : "wallet",
        wallet: wallet,
        subscription: sub
      };
    }
    // Free state — surface any local context the popup might want
    const expired = (wallet && wallet.expiresAt && wallet.expiresAt <= now) ||
                    (sub && sub.expiresAt && sub.expiresAt <= now);
    return {
      tier: "free",
      expired: !!expired,
      wallet: wallet,
      subscription: sub
    };
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
    await save(null);
    await saveSub(null);
  }

  window.TrustyTier = {
    getTier: getTier,
    verifyWallet: verifyWallet,
    clearTier: clearTier,
    startSubscription: startSubscription,
    refreshSubscription: refreshSubscription,
    getOrCreateSubId: getOrCreateSubId,
    // Watchlist API
    getWatchlist: getWatchlist,
    refreshWatchlist: refreshWatchlist,
    watchlistAdd: watchlistAdd,
    watchlistRemove: watchlistRemove,
    watchlistContains: watchlistContains,
    WL_FREE_CAP: WL_FREE_CAP,
    PAID_THRESHOLD: PAID_THRESHOLD,
    TRUSTY_CONTRACT: TRUSTY_CONTRACT,
    TTL_MS: TTL_MS
  };
})();
