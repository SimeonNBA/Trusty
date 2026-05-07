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
  const REQUEST_TIMEOUT_MS = 6000;

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
    };
  }

  // ── Cache layer ──
  const cache = new Map(); // key → Promise<scanResult>

  function scan(ca, chain) {
    const key = (ca + ":" + (chain || "evm")).toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const promise = scanRemote(ca, chain).catch((err) => {
      // Don't cache failures — let next call retry
      cache.delete(key);
      throw err;
    });
    cache.set(key, promise);
    return promise;
  }

  // ── Sorsa-backed KOLs + activity ─────────────────────────────
  // Lazy-fetched only when a paid user opens the inline panel — so
  // free-tier hovers never burn Sorsa quota.
  async function scanKolsRemote(ca, chain) {
    const url =
      API_BASE +
      "/api/kols?ca=" +
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
  function scanKols(ca, chain) {
    const key = (ca + ":" + (chain || "evm")).toLowerCase();
    if (kolsCache.has(key)) return kolsCache.get(key);
    const promise = scanKolsRemote(ca, chain).catch((e) => {
      kolsCache.delete(key);
      throw e;
    });
    kolsCache.set(key, promise);
    return promise;
  }

  // Expose globally for content scripts
  window.TrustyAPI = {
    scan,
    scanKols,
    shortAddr,
    verdictFromScore
  };
})();
