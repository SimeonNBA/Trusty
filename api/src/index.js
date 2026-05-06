/* ================================================================
   Trusty AI — /api/scan worker

   GET /api/scan?ca=0x...&chain=bsc

   Pulls token-security signals from GoPlus and market data from
   Dexscreener, scores them, and returns the same shape the extension
   stub returns. The shape MUST match extension/lib/api.js so the
   client is a drop-in swap.
   ================================================================ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const ZERO = "0x0000000000000000000000000000000000000000";
const DEAD = "0x000000000000000000000000000000000000dead";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "trusty-api" });
    }
    if (url.pathname !== "/api/scan") {
      return json({ error: "not found" }, 404);
    }
    if (request.method !== "GET") {
      return json({ error: "method not allowed" }, 405);
    }

    const ca = (url.searchParams.get("ca") || "").toLowerCase();
    const chain = (url.searchParams.get("chain") || "bsc").toLowerCase();

    if (!/^0x[a-f0-9]{40}$/.test(ca)) {
      return json({ error: "invalid ca" }, 400);
    }

    const cacheKey = `scan:${chain}:${ca}`;
    if (env.SCAN_KV) {
      const cached = await env.SCAN_KV.get(cacheKey, "json");
      if (cached) return json(cached);
    }

    const result = await scanToken(ca, chain);

    if (env.SCAN_KV) {
      const ttl = parseInt(env.SCAN_TTL_SECONDS || "300", 10);
      // fire-and-forget; don't block response on KV write
      try {
        await env.SCAN_KV.put(cacheKey, JSON.stringify(result), {
          expirationTtl: ttl,
        });
      } catch (_) {}
    }

    return json(result);
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}

// ── chain → goplus chain id ──
function chainId(chain) {
  const map = { bsc: "56", evm: "56", eth: "1", base: "8453", polygon: "137" };
  return map[chain] || "56";
}

async function scanToken(ca, chain) {
  const [gpRes, dxRes] = await Promise.allSettled([
    fetchGoPlus(chainId(chain), ca),
    fetchDex(ca),
  ]);
  const g = gpRes.status === "fulfilled" ? gpRes.value : null;
  const d = dxRes.status === "fulfilled" ? dxRes.value : null;

  const checks = buildChecks(g);
  const paidChecks = buildPaidChecks(g);
  const score = computeScore(g, checks, paidChecks);
  const verdict = score >= 70 ? "APE" : score >= 40 ? "CAUTION" : "RUN";

  const rawSym = (d?.symbol || g?.token_symbol || ca.slice(2, 6)).toString();
  const symbol = "$" + rawSym.replace(/^\$/, "").toUpperCase();
  const name = d?.name || g?.token_name || "Token " + shortAddr(ca);

  return {
    ca,
    chain,
    score,
    verdict,
    symbol,
    name,
    checks,
    paidChecks,
    // KOLs and X activity stay zeroed until TweetScout integration (task #2).
    kols: [],
    activity: {
      tweets24h: 0,
      deltaPct: 0,
      sentiment: "—",
      coordShill: false,
    },
    marketData: marketData(d, g),
  };
}

// ── GoPlus token-security ──
async function fetchGoPlus(cid, ca) {
  const url = `https://api.gopluslabs.io/api/v1/token_security/${cid}?contract_addresses=${ca}`;
  const r = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "trusty-ai/0.1" },
  });
  if (!r.ok) throw new Error("goplus " + r.status);
  const data = await r.json();
  const entry = data?.result?.[ca] || data?.result?.[ca.toLowerCase()] || null;
  return entry && Object.keys(entry).length ? entry : null;
}

// ── Dexscreener ──
async function fetchDex(ca) {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, {
    headers: { Accept: "application/json", "User-Agent": "trusty-ai/0.1" },
  });
  if (!r.ok) throw new Error("dex " + r.status);
  const data = await r.json();
  if (!Array.isArray(data?.pairs) || !data.pairs.length) return null;
  const bsc = data.pairs.filter((p) => p.chainId === "bsc");
  const sorted = (bsc.length ? bsc : data.pairs).sort(
    (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  );
  const top = sorted[0];
  return {
    symbol: top.baseToken?.symbol,
    name: top.baseToken?.name,
    priceUsd: parseFloat(top.priceUsd) || 0,
    mcap: top.marketCap || top.fdv || 0,
    liquidityUsd: top.liquidity?.usd || 0,
    volume24h: top.volume?.h24 || 0,
    pairCreatedAt: top.pairCreatedAt || 0,
  };
}

// ── checks ──
function buildChecks(g) {
  if (!g) {
    return [
      { ok: false, label: "Not a honeypot" },
      { ok: false, label: "Tax data unavailable" },
      { ok: false, label: "LP locked" },
      { ok: false, label: "Mint disabled" },
      { ok: false, label: "Contract renounced" },
    ];
  }
  const buyTax = parseFloat(g.buy_tax || "0");
  const sellTax = parseFloat(g.sell_tax || "0");
  const taxLabel =
    buyTax === 0 && sellTax === 0
      ? "Tax 0% / 0%"
      : `Tax ${(buyTax * 100).toFixed(1)}% / ${(sellTax * 100).toFixed(1)}%`;

  const notHoneypot =
    g.is_honeypot !== "1" && g.cannot_buy !== "1" && g.cannot_sell_all !== "1";

  return [
    { ok: notHoneypot, label: "Not a honeypot" },
    { ok: buyTax <= 0.05 && sellTax <= 0.05, label: taxLabel },
    { ok: lpLocked(g), label: "LP locked" },
    { ok: g.is_mintable !== "1", label: "Mint disabled" },
    { ok: isRenounced(g), label: "Contract renounced" },
  ];
}

function lpLocked(g) {
  const holders = g.lp_holders || [];
  if (!holders.length) return false;
  let lockedShare = 0;
  for (const h of holders) {
    const addr = (h.address || "").toLowerCase();
    const tag = (h.tag || "").toLowerCase();
    const pct = parseFloat(h.percent || "0");
    const isBurn = addr === ZERO || addr === DEAD || /burn/i.test(tag);
    const isLocked = h.is_locked === 1 || h.is_locked === "1";
    if (isBurn || isLocked) lockedShare += pct;
  }
  return lockedShare >= 0.95;
}

function isRenounced(g) {
  const owner = (g.owner_address || "").toLowerCase();
  if (!owner) return true; // owner field empty == renounced per GoPlus docs
  return owner === ZERO || owner === DEAD;
}

function buildPaidChecks(g) {
  if (!g) {
    return [
      { ok: false, label: "Top wallets: data unavailable" },
      { ok: false, label: "Dev wallet: data unavailable" },
    ];
  }
  // Top non-contract, non-LP, non-burn holders
  const holders = g.holders || [];
  let topShare = 0;
  let counted = 0;
  for (const h of holders) {
    if (counted >= 5) break;
    const tag = (h.tag || "").toLowerCase();
    const addr = (h.address || "").toLowerCase();
    if (addr === ZERO || addr === DEAD) continue;
    if (/burn|liquidity|lp|locker/i.test(tag)) continue;
    if (h.is_contract === 1 || h.is_contract === "1") continue;
    topShare += parseFloat(h.percent || "0");
    counted++;
  }
  const creatorPct = parseFloat(g.creator_percent || "0");

  return [
    {
      ok: topShare < 0.10,
      label:
        topShare < 0.10
          ? "Top 5 wallets hold <10%"
          : `Top 5 wallets hold ${(topShare * 100).toFixed(0)}%`,
    },
    {
      ok: creatorPct < 0.05,
      label:
        creatorPct < 0.05
          ? "Dev wallet: clean"
          : `Dev wallet: holds ${(creatorPct * 100).toFixed(0)}%`,
    },
  ];
}

// ── score: weights sum to 100 ──
function computeScore(g, checks, paidChecks) {
  if (!g) return 0;
  const w = {
    "Not a honeypot": 25,
    tax: 15,
    "LP locked": 15,
    "Mint disabled": 10,
    "Contract renounced": 10,
    topWallets: 15,
    dev: 10,
  };
  let s = 0;
  for (const c of checks) {
    if (!c.ok) continue;
    if (c.label.startsWith("Tax")) s += w.tax;
    else s += w[c.label] || 0;
  }
  for (const c of paidChecks) {
    if (!c.ok) continue;
    if (/^Top \d+ wallets/i.test(c.label)) s += w.topWallets;
    else if (/^Dev wallet/i.test(c.label)) s += w.dev;
  }
  return Math.max(0, Math.min(100, s));
}

// ── market data formatting (matches mock shape) ──
function marketData(d, g) {
  const mcap = d?.mcap || 0;
  const liq = d?.liquidityUsd || 0;
  const vol = d?.volume24h || 0;
  const ageDays = d?.pairCreatedAt
    ? Math.max(1, Math.floor((Date.now() - d.pairCreatedAt) / 86400000))
    : 0;
  const holders = g?.holder_count ? parseInt(g.holder_count, 10) : 0;

  return {
    mcap: fmtUsd(mcap),
    liquidity: fmtUsd(liq),
    volume24h: fmtUsd(vol),
    age: ageDays ? ageDays + "d" : "—",
    holders,
  };
}

function fmtUsd(n) {
  if (!n || !isFinite(n)) return "—";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + Math.round(n);
}

function shortAddr(ca) {
  return ca.slice(0, 6) + "..." + ca.slice(-4);
}
