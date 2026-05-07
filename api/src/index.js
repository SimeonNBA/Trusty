/* ================================================================
   Trusty AI — Worker

   GET /api/scan?ca=0x...&chain=bsc
     Token-security (GoPlus) + market data (Dexscreener), scored 0-100.
     Cached 5 min. Public, no quota concerns.

   GET /api/kols?ca=0x...&chain=bsc
     KOL mentions + X activity from Sorsa (formerly TweetScout).
     Lazy-loaded only by the paid panel — free-tier hovers never hit.
     Cached 6 hr per CA to stretch the 10K-req/mo Sorsa tier.
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
    if (request.method !== "GET") {
      return json({ error: "method not allowed" }, 405);
    }

    const ca = (url.searchParams.get("ca") || "").toLowerCase();
    const chain = (url.searchParams.get("chain") || "bsc").toLowerCase();

    if (!/^0x[a-f0-9]{40}$/.test(ca)) {
      return json({ error: "invalid ca" }, 400);
    }

    if (url.pathname === "/api/scan") {
      return handleScan(ca, chain, env);
    }
    if (url.pathname === "/api/kols") {
      return handleKols(ca, chain, env);
    }
    return json({ error: "not found" }, 404);
  },
};

/* ── /api/scan ── token security + market data, 5min cache ── */
async function handleScan(ca, chain, env) {
  const cacheKey = `scan:${chain}:${ca}`;
  if (env.SCAN_KV) {
    const cached = await env.SCAN_KV.get(cacheKey, "json");
    if (cached) return json(cached);
  }

  const result = await scanToken(ca, chain);

  if (env.SCAN_KV) {
    const ttl = parseInt(env.SCAN_TTL_SECONDS || "300", 10);
    try {
      await env.SCAN_KV.put(cacheKey, JSON.stringify(result), {
        expirationTtl: ttl,
      });
    } catch (_) {}
  }

  return json(result);
}

/* ── /api/kols ── Sorsa-backed KOL mentions, 6h cache ── */
async function handleKols(ca, chain, env) {
  const cacheKey = `kols:${chain}:${ca}`;
  if (env.SCAN_KV) {
    const cached = await env.SCAN_KV.get(cacheKey, "json");
    if (cached) return json(cached);
  }

  const result = await fetchKols(ca, chain, env);

  if (env.SCAN_KV) {
    try {
      await env.SCAN_KV.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 21600, // 6 hours
      });
    } catch (_) {}
  }

  return json(result);
}

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

/* ================================================================
   Sorsa (formerly TweetScout) — KOL mentions + X activity
   ================================================================ */

const EMPTY_KOLS = {
  kols: [],
  activity: { tweets24h: 0, deltaPct: 0, sentiment: "—", coordShill: false },
};

async function fetchKols(ca, chain, env) {
  if (!env.SORSA_API_KEY) return EMPTY_KOLS;

  // 1) Search recent tweets mentioning the CA. Sorsa's query field uses
  //    Twitter Advanced Search syntax; we hand it the CA as plain text.
  const searchResult = await sorsaSearchTweets(ca, env.SORSA_API_KEY);
  const tweets = searchResult.tweets;
  const tweets24h = countWithin(tweets, 24 * 3600 * 1000);

  if (!tweets.length) return EMPTY_KOLS;

  // 2) Collect unique authors from the most recent 30 mentions.
  const authors = uniqueAuthorsFromTweets(tweets, 30);
  if (!authors.length) {
    return {
      kols: [],
      activity: {
        tweets24h,
        deltaPct: 0,
        sentiment: "—",
        coordShill: detectCoordShill(tweets),
      },
    };
  }

  // 3) Pull follower count for those handles in one batch.
  const enriched = await sorsaInfoBatch(authors, env.SORSA_API_KEY);

  // 4) Rank by follower count, take top 5, look up each one's most-recent
  //    mention from the search results. Filter out tiny accounts
  //    (<500 followers) — they're almost certainly bots/eggs.
  const tweetByAuthor = indexLatestByAuthor(tweets);
  const ranked = enriched
    .filter((u) => u && u.handle && u.followers >= 500)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 5)
    .map((u) => {
      const tw = tweetByAuthor[u.handle.toLowerCase()];
      const minsAgo = tw ? Math.max(1, Math.floor((Date.now() - tw.ts) / 60000)) : 0;
      const tweetUrl = tw && tw.id
        ? "https://x.com/" + encodeURIComponent(u.handle) + "/status/" + encodeURIComponent(tw.id)
        : null;
      return {
        handle: "@" + u.handle,
        followers: fmtCompact(u.followers),
        mins: minsAgo,
        tweetUrl,
      };
    });

  return {
    kols: ranked,
    activity: {
      tweets24h,
      deltaPct: 0, // requires a 2nd window-search; defer to save quota
      sentiment: "—", // Sorsa doesn't expose; leave honest
      coordShill: detectCoordShill(tweets),
    },
  };
}

async function sorsaSearchTweets(query, apiKey) {
  try {
    const r = await fetch("https://api.sorsa.io/v3/search-tweets", {
      method: "POST",
      headers: {
        ApiKey: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, order: "latest" }),
    });
    if (!r.ok) {
      console.warn("sorsa search-tweets", r.status);
      return { tweets: [] };
    }
    const data = await r.json();
    const list = Array.isArray(data?.tweets) ? data.tweets : [];
    const tweets = list
      .map((t) => ({
        id: t.id || "",
        text: t.full_text || t.text || "",
        ts: parseTs(t.created_at),
        author: pickAuthor(t),
      }))
      .filter((t) => t.author);
    return { tweets };
  } catch (e) {
    console.warn("sorsa search-tweets error", e?.message);
    return { tweets: [] };
  }
}

async function sorsaInfoBatch(handles, apiKey) {
  if (!handles.length) return [];
  try {
    // Sorsa expects REPEATED query keys: ?usernames=a&usernames=b&usernames=c
    // (Not comma-separated.) Field name is `usernames`, not `handles`.
    const params = handles
      .map((h) => "usernames=" + encodeURIComponent(h))
      .join("&");
    const url = "https://api.sorsa.io/v3/info-batch?" + params;
    const r = await fetch(url, {
      headers: { ApiKey: apiKey, Accept: "application/json" },
    });
    if (!r.ok) {
      console.warn("sorsa info-batch", r.status);
      return [];
    }
    const data = await r.json();
    const list = Array.isArray(data?.users) ? data.users : [];
    return list.map((u) => ({
      handle: u.username || "",
      followers: u.followers_count || 0,
      // Sorsa Score isn't in /info-batch; would need a /score call per
      // handle. We rank by follower count for v1 to stay quota-friendly.
    }));
  } catch (e) {
    console.warn("sorsa info-batch error", e?.message);
    return [];
  }
}

/* ── Sorsa helpers ── */

function pickAuthor(t) {
  const a = t.author || t.user || {};
  const handle =
    a.handle || a.username || a.screen_name || t.username || t.handle;
  if (!handle) return null;
  return { handle: String(handle).replace(/^@/, "") };
}

function parseTs(v) {
  if (!v) return 0;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}

function uniqueAuthorsFromTweets(tweets, limit) {
  const seen = new Set();
  const handles = [];
  for (const t of tweets) {
    const h = t.author?.handle?.toLowerCase();
    if (!h || seen.has(h)) continue;
    seen.add(h);
    handles.push(t.author.handle);
    if (handles.length >= limit) break;
  }
  return handles;
}

function indexLatestByAuthor(tweets) {
  const byAuthor = {};
  for (const t of tweets) {
    const h = t.author?.handle?.toLowerCase();
    if (!h) continue;
    if (!byAuthor[h] || t.ts > byAuthor[h].ts) byAuthor[h] = t;
  }
  return byAuthor;
}

function countWithin(tweets, windowMs) {
  const cutoff = Date.now() - windowMs;
  let n = 0;
  for (const t of tweets) if (t.ts >= cutoff) n++;
  return n;
}

// Crude coord-shill heuristic: 4+ mentions within 60 seconds with mostly-identical text.
function detectCoordShill(tweets) {
  if (tweets.length < 4) return false;
  const sorted = [...tweets].sort((a, b) => a.ts - b.ts);
  for (let i = 0; i + 3 < sorted.length; i++) {
    const burst = sorted.slice(i, i + 4);
    if (burst[3].ts - burst[0].ts > 60_000) continue;
    const texts = burst.map((t) => normalizeText(t.text));
    const uniq = new Set(texts);
    if (uniq.size <= 2) return true;
  }
  return false;
}

function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9$@]/g, "")
    .slice(0, 60);
}

function fmtCompact(n) {
  if (!n || !isFinite(n)) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}
