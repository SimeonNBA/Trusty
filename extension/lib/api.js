/* ================================================================
   Trusty AI — API client

   Calls the real backend at api.trustyai.tech/api/scan (Cloudflare
   Worker — see /api in the repo). On network failure, falls back to
   a deterministic mock so the UI still renders sanely offline.

   Cache: in-memory Map keyed by ca+chain. Lifetime = page session.
   Server-side cache (KV, 5min) handles cross-session repetition.
   ================================================================ */

(function () {
  "use strict";

  const API_BASE = "https://api.trustyai.tech";
  // Cold-cache scans hit GoPlus + Dexscreener (sometimes RugCheck) on the
  // worker and routinely take 7-12s. 6s was too aggressive — we were
  // timing out and falling back to mock data on the FIRST scan of any
  // fresh CA, even though the worker would finish ~3s later and cache
  // the real result in KV. 15s covers nearly all real-world cold scans.
  // Subsequent scans of the same CA within 5min hit the worker's KV
  // cache and return in ~100ms.
  const REQUEST_TIMEOUT_MS = 15000;

  const TRUSTY_CA = "0x65aea108c21439693468FCD542D81C29E8df4444";

  // ── Deterministic pseudo-hash, used only for the offline fallback ──
  function caScore(ca) {
    if (ca.toLowerCase() === TRUSTY_CA.toLowerCase()) return 92;
    let h = 0;
    for (let i = 0; i < ca.length; i++) {
      h = (h * 31 + ca.charCodeAt(i)) >>> 0;
    }
    return h % 101; // 0-100
  }

  function shortAddr(ca) {
    if (!ca) return "";
    return ca.slice(0, 6) + "..." + ca.slice(-4);
  }

  function verdictFromScore(score) {
    if (score >= 70) return "APE";
    if (score >= 40) return "CAUTION";
    return "RUN";
  }

  // ── Real scanner — Cloudflare Worker at api.trustyai.tech ──
  async function scanRemote(ca, chain) {
    const url =
      API_BASE +
      "/api/scan?ca=" +
      encodeURIComponent(ca) +
      "&chain=" +
      encodeURIComponent(chain || "bsc");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error("scan http " + r.status);
      const data = await r.json();
      if (!data || !data.ca) throw new Error("scan invalid response");
      return data;
    } catch (err) {
      console.warn("[Trusty] scan fallback (offline mock):", err && err.message);
      return mockScan(ca, chain);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Offline fallback so dev mode + transient outages don't break the UI ──
  // _isMock flag lets the cache layer skip storing this (so next call
  // retries the live worker) and lets pill renderers detect "this is
  // fake data, schedule a retry."
  function mockScan(ca, chain) {
    const score = caScore(ca);
    const verdict = verdictFromScore(score);
    const stub = ca.startsWith("0x") ? ca.slice(2, 6) : ca.slice(0, 4);
    return {
      ca,
      chain,
      score,
      verdict,
      symbol: "$" + stub.toUpperCase(),
      name: "Token " + shortAddr(ca),
      checks: [
        { ok: score >= 50, label: "Not a honeypot" },
        { ok: score >= 55, label: "Tax 0% / 0%" },
        { ok: score >= 60, label: "LP locked" },
        { ok: score >= 65, label: "Mint disabled" },
        { ok: score >= 70, label: "Contract renounced" },
      ],
      paidChecks: [
        { ok: score >= 75, label: "Snipers: 0% of supply" },
        { ok: score >= 78, label: "Dev wallet: clean (no rug history)" },
      ],
      kols: [],
      activity: {
        tweets24h: 0,
        deltaPct: 0,
        sentiment: "—",
        coordShill: false,
      },
      marketData: {
        mcap: "—",
        liquidity: "—",
        volume24h: "—",
        age: "—",
        holders: 0,
      },
      _isMock: true,
    };
  }

  // ── Cache layer ──
  // Real worker results are cached for the page session (worker also
  // has its own 5min KV cache server-side). Mock fallback results are
  // NEVER cached long-term — once the worker recovers / cache warms,
  // the next call gets real data instead of staying stuck on a mock.
  const cache = new Map(); // key → Promise<scanResult>

  function scan(ca, chain) {
    const key = (ca + ":" + (chain || "evm")).toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const promise = scanRemote(ca, chain)
      .then((result) => {
        // If this resolved to a mock fallback, evict from cache so the
        // next call retries the live worker (which has likely cached the
        // real result in KV by then).
        if (result && result._isMock) {
          cache.delete(key);
        }
        return result;
      })
      .catch((err) => {
        // Don't cache hard failures either — let next call retry.
        cache.delete(key);
        throw err;
      });
    cache.set(key, promise);
    return promise;
  }

  // ── Sorsa-backed KOLs + activity ─────────────────────────────
  // Lazy-fetched only when a paid user opens the inline panel — so
  // free-tier hovers never burn Sorsa quota.
  async function scanKolsRemote(ca, chain, symbol) {
    let url =
      API_BASE +
      "/api/kols?ca=" +
      encodeURIComponent(ca) +
      "&chain=" +
      encodeURIComponent(chain || "bsc");
    if (symbol) url += "&symbol=" + encodeURIComponent(symbol);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error("kols http " + r.status);
      const data = await r.json();
      return {
        kols: Array.isArray(data?.kols) ? data.kols : [],
        activity: data?.activity || {
          tweets24h: 0,
          deltaPct: 0,
          sentiment: "—",
          coordShill: false,
        },
      };
    } catch (err) {
      console.warn("[Trusty] kols fetch failed:", err && err.message);
      return {
        kols: [],
        activity: { tweets24h: 0, deltaPct: 0, sentiment: "—", coordShill: false },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  const kolsCache = new Map();
  function scanKols(ca, chain, symbol) {
    const key = (ca + ":" + (chain || "evm")).toLowerCase();
    if (kolsCache.has(key)) return kolsCache.get(key);
    const promise = scanKolsRemote(ca, chain, symbol).catch((e) => {
      kolsCache.delete(key);
      throw e;
    });
    kolsCache.set(key, promise);
    return promise;
  }

  // ── Event reporting ─────────────────────────────────────────
  // Anonymous CA-only events feed the /api/trending leaderboard.
  // Fire-and-forget, never blocks the UI.
  function reportEvent(type, ca, chain) {
    if (!type || !ca) return;
    try {
      fetch(API_BASE + "/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ca, chain: chain || "evm" }),
      }).catch(function () { /* swallow */ });
    } catch (e) { /* never block */ }
  }

  // ── Binance Square mention reporting ─────────────────────────
  // Posted by binance-content.js whenever a Square post containing a
  // CA scrolls into view. Worker classifies sentiment server-side
  // and aggregates per CA — raw post text is not persisted long-term,
  // only the derived sentiment class. See /api/square-mention.
  function reportSquareMention(ca, chain, postId, text, engagement) {
    if (!ca || !postId) return;
    try {
      fetch(API_BASE + "/api/square-mention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ca: ca,
          chain: chain || "evm",
          postId: postId,
          text: text || "",
          engagement: engagement || 0,
        }),
      }).catch(function () { /* swallow */ });
    } catch (e) { /* never block */ }
  }

  // Ticker-based mention reporting — $SYMBOL or #symbol detected in
  // a Square post. Worker resolves the ticker against known scans
  // (symref table) and aggregates against any CAs that match. Same
  // privacy properties as reportSquareMention — text is classified
  // and discarded, only the derived sentiment class is stored.
  function reportSquareTicker(ticker, postId, text, engagement) {
    if (!ticker || !postId) return;
    try {
      fetch(API_BASE + "/api/square-mention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: String(ticker).toUpperCase(),
          postId: postId,
          text: text || "",
          engagement: engagement || 0,
        }),
      }).catch(function () { /* swallow */ });
    } catch (e) { /* never block */ }
  }

  // ── Swap-quote enrichment for the paid-panel Trade row ─────
  // Read-only — fetches an indicative quote (expected output, price
  // impact, provider) for "native → token" on the resolved chain.
  // The actual swap still executes in the user's wallet UI; we never
  // sign or broadcast. Silent null return on any failure so the
  // Trade button keeps working without the enrichment.
  async function getSwapQuoteRemote(ca, chain) {
    if (!ca) return null;
    const url =
      API_BASE +
      "/api/swap-quote?ca=" +
      encodeURIComponent(ca) +
      "&chain=" +
      encodeURIComponent(chain || "bsc");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      if (!r.ok) return null;
      const data = await r.json();
      if (!data || data.ok !== true) return null;
      return data;
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  const quoteCache = new Map();
  function getSwapQuote(ca, chain) {
    const key = (ca + ":" + (chain || "evm")).toLowerCase();
    if (quoteCache.has(key)) return quoteCache.get(key);
    const promise = getSwapQuoteRemote(ca, chain);
    quoteCache.set(key, promise);
    return promise;
  }

  // Expose globally for content scripts
  window.TrustyAPI = {
    scan,
    scanKols,
    getSwapQuote,
    reportEvent,
    reportSquareMention,
    reportSquareTicker,
    shortAddr,
    verdictFromScore
  };
})();
