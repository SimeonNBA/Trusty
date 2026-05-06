/* ================================================================
   Trusty AI — API client

   Day 2: STUBBED with deterministic mock data. The real backend
   endpoint at trustyai.tech/api/scan can drop in later by replacing
   the body of scanRemote() — the response shape stays identical.

   Cache: in-memory Map keyed by ca+chain. Lifetime = page session.
   Future days: persist to chrome.storage.local with TTL.
   ================================================================ */

(function () {
  "use strict";

  const TRUSTY_CA = "0x65aea108c21439693468FCD542D81C29E8df4444";

  // ── Deterministic pseudo-hash for consistent mock scores ──
  // Same CA always produces same score; lets you A/B test the UI without
  // chaotic results.
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

  // ── MOCK scanner ──
  async function scanRemote(ca, chain) {
    // Simulate network latency for realistic UX testing
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 350));

    const score = caScore(ca);
    const verdict = verdictFromScore(score);

    // Mock symbol/name from address — real API will return real metadata
    const stub = ca.startsWith("0x") ? ca.slice(2, 6) : ca.slice(0, 4);

    return {
      ca,
      chain,
      score,
      verdict,
      symbol: "$" + stub.toUpperCase(),
      name: "Token " + shortAddr(ca),
      // Free-tier checks (5 plain-English signals)
      checks: [
        { ok: score >= 50, label: "Not a honeypot" },
        { ok: score >= 55, label: "Tax 0% / 0%" },
        { ok: score >= 60, label: "LP locked" },
        { ok: score >= 65, label: "Mint disabled" },
        { ok: score >= 70, label: "Contract renounced" }
      ],
      // ─── Paid-tier extras (only rendered in the paid panel) ───
      paidChecks: [
        { ok: score >= 75, label: "Snipers: 0% of supply" },
        { ok: score >= 78, label: "Dev wallet: clean (no rug history)" }
      ],
      kols: score >= 60 ? [
        { handle: "@cz_binance", followers: "9.2M", mins: 30 },
        { handle: "@runecrypto_", followers: "280K", mins: 120 },
        { handle: "@MarcellxMarcell", followers: "145K", mins: 240 }
      ] : [],
      activity: {
        tweets24h: 200 + (score * 12),
        deltaPct: score >= 70 ? 340 : score >= 50 ? 80 : -40,
        sentiment: score >= 70 ? "78% bullish" : score >= 50 ? "Mixed" : "62% bearish",
        coordShill: score < 40
      },
      marketData: {
        mcap: "$" + (score * 0.18).toFixed(1) + "M",
        liquidity: "$" + (score * 22).toFixed(0) + "K",
        age: (3 + Math.floor(score / 10)) + "d",
        holders: 250 + (score * 28)
      }
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

  // Expose globally for content scripts
  window.TrustyAPI = {
    scan,
    shortAddr,
    verdictFromScore
  };
})();
