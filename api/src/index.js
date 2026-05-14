/* ================================================================
   Trusty AI — Worker

   GET /api/scan?ca=0x...&chain=bsc
     Token-security (GoPlus) + market data (Dexscreener), scored 0-100.
     Cached 5 min. Public, no quota concerns.

   GET /api/kols?ca=0x...&chain=bsc&symbol=…
     KOL mentions + X activity from Sorsa (formerly TweetScout).
     Lazy-loaded only by the paid panel — free-tier hovers never hit.
     Cached 6 hr per CA to stretch the 10K-req/mo Sorsa tier.

   POST /api/subscribe?plan=monthly|yearly&subId=…
     Creates a NOWPayments invoice for the chosen plan. Returns the
     hosted-checkout URL the extension opens in a new tab.

   POST /api/nowpayments-webhook
     IPN callback from NOWPayments. Verifies HMAC-SHA512 signature,
     marks the subscription paid in KV with an expiry timestamp.

   GET /api/subscription?subId=…
     Returns the current subscription state for a given subId.
     Polled by the popup after a checkout to detect payment.
   ================================================================ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
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

    // CA-based endpoints
    if (url.pathname === "/api/scan" || url.pathname === "/api/kols") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      const { ca, chain, error } = parseCaAndChain(url);
      if (error) return json({ error }, 400);
      if (url.pathname === "/api/scan") return handleScan(ca, chain, env);
      const symbol = (url.searchParams.get("symbol") || "").replace(/^\$/, "").trim();
      return handleKols(ca, chain, env, symbol);
    }

    // Subscription endpoints (no CA)
    if (url.pathname === "/api/subscribe") {
      if (request.method !== "POST" && request.method !== "GET") {
        return json({ error: "method not allowed" }, 405);
      }
      return handleSubscribe(url, env);
    }
    if (url.pathname === "/api/nowpayments-webhook") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleWebhook(request, env);
    }
    if (url.pathname === "/api/subscription") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleSubscriptionStatus(url, env);
    }
    if (url.pathname === "/api/redeem-code") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleRedeemCode(request, env);
    }
    if (url.pathname === "/api/admin/mint-code") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleAdminMintCode(request, env);
    }
    if (url.pathname === "/api/admin/stats") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleAdminStats(request, env);
    }
    if (url.pathname === "/api/admin/codes") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleAdminListCodes(request, env);
    }
    if (url.pathname === "/api/admin/revoke-code") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleAdminRevokeCode(request, env);
    }
    if (url.pathname === "/api/watchlist") {
      if (request.method === "GET") return handleWatchlistGet(url, env);
      if (request.method === "POST") return handleWatchlistPost(request, url, env);
      return json({ error: "method not allowed" }, 405);
    }
    if (url.pathname === "/api/event") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleEvent(request, env);
    }
    if (url.pathname === "/api/trending") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleTrending(url, env);
    }

    return json({ error: "not found" }, 404);
  },
};

function parseCaAndChain(url) {
  const rawCa = url.searchParams.get("ca") || "";
  const chain = (url.searchParams.get("chain") || "bsc").toLowerCase();
  const isSolanaChain = chain === "solana" || chain === "sol";
  // CAs are case-sensitive on Solana, case-insensitive on EVM. We
  // lowercase EVM for cache stability; preserve case for Solana.
  const ca = isSolanaChain ? rawCa : rawCa.toLowerCase();
  if (!isValidCa(ca, chain)) return { error: "invalid ca" };
  return { ca, chain };
}

/* ── /api/scan ── token security + market data, 5min cache ── */
async function handleScan(ca, chain, env) {
  // v2: invalidates pre-2026-05-09 cached scans so the new
  // liveness-penalty scoring (volume/liquidity/holders/age) takes
  // effect on every token immediately. Old cached entries had
  // dead tokens at 85/100; the v2 prefix flushes those.
  const cacheKey = `scan:v2:${chain}:${ca}`;
  if (env.SCAN_KV) {
    const cached = await env.SCAN_KV.get(cacheKey, "json");
    if (cached) return json(cached);
  }

  const result = await scanToken(ca, chain, env);

  // Only cache when GoPlus actually responded. The "Tax data
  // unavailable" / "Transfer fee data unavailable" labels only appear
  // when the GoPlus fetch failed. Caching those would mean every
  // scan for the next 5 min returns score 0 / RUN for legit tokens,
  // which is exactly what trending was just doing. Detect by label
  // rather than by score (a real rug correctly scores 0).
  const upstreamOk = isUpstreamOk(result);

  if (env.SCAN_KV && upstreamOk) {
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
async function handleKols(ca, chain, env, symbol) {
  // Cache key includes symbol so two calls for the same CA with
  // different symbols (rare, but possible) don't conflict. In practice
  // CAs are 1:1 with symbols so this just adds harmless precision.
  // The v2 suffix invalidates pre-2026-05-09 cache so the new
  // "Neutral" sentiment fallback takes effect immediately. Bump
  // again whenever sentiment / activity logic changes server-side.
  const sk = symbol ? "+" + symbol.toLowerCase() : "";
  const cacheKey = `kols:v2:${chain}:${ca}${sk}`;
  if (env.SCAN_KV) {
    const cached = await env.SCAN_KV.get(cacheKey, "json");
    if (cached) return json(cached);
  }

  const result = await fetchKols(ca, chain, env, symbol);

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
  const map = {
    bsc: "56", bnb: "56", binance: "56", evm: "56",
    eth: "1", ethereum: "1",
    base: "8453",
    polygon: "137", matic: "137",
    arbitrum: "42161", arb: "42161",
    avalanche: "43114", avax: "43114",
    optimism: "10", op: "10"
  };
  return map[(chain || "").toLowerCase()] || "56";
}

// Dexscreener `chainId` → our canonical chain key (for re-passing
// through the scan response so the frontend uses the right chain
// in trade-row UAI / launchpad detection / etc.).
function dexChainToCanonical(dxChain) {
  const c = (dxChain || "").toLowerCase();
  if (c === "bsc") return "bsc";
  if (c === "ethereum") return "ethereum";
  if (c === "base") return "base";
  if (c === "polygon") return "polygon";
  if (c === "arbitrum") return "arbitrum";
  if (c === "avalanche") return "avalanche";
  if (c === "optimism") return "optimism";
  return null;
}

// When chain is generic "evm", quickly sniff which EVM chain the
// token actually lives on by looking at Dexscreener's pair distribution.
// Returns the canonical chain key (e.g. "ethereum") with the highest
// 24h volume, or null if no pairs exist.
async function detectEvmChain(ca) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, {
      headers: { Accept: "application/json", "User-Agent": "trusty-ai/0.1" },
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (!Array.isArray(data?.pairs) || !data.pairs.length) return null;
    // Score each chain by 24h volume, fall back to liquidity if vol is 0
    const byChain = {};
    for (const p of data.pairs) {
      const c = dexChainToCanonical(p.chainId);
      if (!c) continue;
      const score = (p.volume?.h24 || 0) || (p.liquidity?.usd || 0);
      byChain[c] = (byChain[c] || 0) + score;
    }
    let best = null, bestScore = 0;
    for (const c in byChain) {
      if (byChain[c] > bestScore) { best = c; bestScore = byChain[c]; }
    }
    return best;
  } catch (e) { return null; }
}

function isSolana(chain) {
  return chain === "solana" || chain === "sol";
}

// ── CA shape validation per chain ──
const SOLANA_CA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58, no 0OIl
const EVM_CA = /^0x[a-f0-9]{40}$/;

function isValidCa(ca, chain) {
  if (isSolana(chain)) return SOLANA_CA.test(ca);
  return EVM_CA.test(ca);
}

async function scanToken(ca, chain, env) {
  if (isSolana(chain)) return scanTokenSolana(ca, chain);
  return scanTokenEvm(ca, chain, env);
}

async function scanTokenEvm(ca, chain, env) {
  // The extension's CA detector tags every 0x… address as generic
  // "evm" because it can't tell BSC from ETH from Base from a regex.
  // For generic-evm scans we sniff the actual chain from Dexscreener's
  // pair distribution before calling GoPlus, otherwise GoPlus runs
  // against BSC for an ETH token and returns nothing.
  let resolvedChain = chain;
  if (chain === "evm" || !chain) {
    const detected = await detectEvmChain(ca);
    if (detected) resolvedChain = detected;
  }

  const [gpRes, dxRes, fmRes] = await Promise.allSettled([
    fetchGoPlus(chainId(resolvedChain), ca),
    fetchDex(ca, resolvedChain === "ethereum" ? "ethereum"
                : resolvedChain === "base"    ? "base"
                : resolvedChain === "polygon" ? "polygon"
                : "bsc"),
    fetchFourMemeOrigin(ca, resolvedChain, env),
  ]);
  const g = gpRes.status === "fulfilled" ? gpRes.value : null;
  const d = dxRes.status === "fulfilled" ? dxRes.value : null;
  const fm = fmRes.status === "fulfilled" ? fmRes.value : null;

  const checks = buildChecks(g);
  const paidChecks = buildPaidChecks(g);
  const score = computeScore(g, checks, paidChecks, d);
  const verdict = score >= 70 ? "APE" : score >= 40 ? "CAUTION" : "RUN";

  // Track whether we have a REAL symbol from upstream sources or whether
  // we fell back to deriving one from the contract address. The hex
  // fallback ("$LFDM" from 0xLFDM…) looks like a real ticker but isn't —
  // exposing it in trending/discovery surfaces is embarrassing. The
  // `symbolFallback: true` flag lets consumers (e.g. the trending feed)
  // filter these out.
  const realSym = d?.symbol || g?.token_symbol;
  const rawSym = (realSym || ca.slice(2, 6)).toString();
  const symbol = "$" + rawSym.replace(/^\$/, "").toUpperCase();
  const name = d?.name || g?.token_name || "Token " + shortAddr(ca);
  const symbolFallback = !realSym;

  // Return the resolved chain so the frontend uses the right chain
  // for trade-row UAI / launchpad-badge link / future logic.
  const shape = baseScanShape(ca, resolvedChain, score, verdict, symbol, name, checks, paidChecks, marketData(d, g), fm);
  if (symbolFallback) shape.symbolFallback = true;
  return shape;
}

async function scanTokenSolana(ca, chain) {
  const [gpRes, dxRes, rcRes] = await Promise.allSettled([
    fetchGoPlusSolana(ca),
    fetchDex(ca, "solana"),
    fetchRugCheck(ca),
  ]);
  const g = gpRes.status === "fulfilled" ? gpRes.value : null;
  const d = dxRes.status === "fulfilled" ? dxRes.value : null;
  const rc = rcRes.status === "fulfilled" ? rcRes.value : null;

  const checks = buildChecksSolana(g, rc);
  const paidChecks = buildPaidChecksSolana(g);
  const score = computeScore(g, checks, paidChecks, d);
  const verdict = score >= 70 ? "APE" : score >= 40 ? "CAUTION" : "RUN";

  // Same symbolFallback flag as the EVM path — see scanTokenEvm comment.
  const realSym = d?.symbol || g?.metadata?.symbol;
  const rawSym = (realSym || ca.slice(0, 4)).toString();
  const symbol = "$" + rawSym.replace(/^\$/, "").toUpperCase();
  const name = d?.name || g?.metadata?.name || "Token " + shortAddrSol(ca);
  const symbolFallback = !realSym;

  const shape = baseScanShape(ca, chain, score, verdict, symbol, name, checks, paidChecks, marketDataSolana(d, g));
  if (symbolFallback) shape.symbolFallback = true;
  return shape;
}

function baseScanShape(ca, chain, score, verdict, symbol, name, checks, paidChecks, md, origin) {
  const out = {
    ca, chain, score, verdict, symbol, name,
    checks, paidChecks,
    // KOLs/activity hydrated by /api/kols on demand
    kols: [],
    activity: { tweets24h: 0, deltaPct: 0, sentiment: "—", coordShill: false },
    marketData: md,
  };
  if (origin && origin.launchedOn) out.launchedOn = origin.launchedOn;
  return out;
}

// ── GoPlus token-security ──
// Retries with backoff on transient failures (429 rate-limit, 5xx, or
// empty result). Without retries, a single rate-limit hit produces a
// scan with `g = null`, which buildChecks renders as all-checks-failed.
// That false-negative pattern was the root of the "$TRUSTY shows 0/100
// RUN with everything ❌" bug — GoPlus was returning legitimate data,
// but we were giving up on the first 429 and showing the all-failed
// fallback to users.
async function fetchGoPlus(cid, ca) {
  const url = `https://api.gopluslabs.io/api/v1/token_security/${cid}?contract_addresses=${ca}`;
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 400ms, 1000ms
      await new Promise(r => setTimeout(r, attempt === 1 ? 400 : 1000));
    }
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "trusty-ai/0.1" },
      });
      if (!r.ok) {
        // Retry transients (429 / 5xx). Don't retry 4xx (probably bad CA).
        if (r.status === 429 || r.status >= 500) {
          lastErr = new Error("goplus " + r.status);
          continue;
        }
        throw new Error("goplus " + r.status);
      }
      const data = await r.json();
      const entry = data?.result?.[ca] || data?.result?.[ca.toLowerCase()] || null;
      if (entry && Object.keys(entry).length) return entry;
      // Empty result — could be soft-throttle. Retry once or twice.
      lastErr = new Error("goplus empty result");
      continue;
    } catch (e) {
      lastErr = e;
      // Network errors / aborts — retry.
    }
  }
  // All retries exhausted. Throw so Promise.allSettled records it as
  // rejected and buildChecks falls back to the "data unavailable" path.
  throw lastErr || new Error("goplus exhausted retries");
}

// ── Dexscreener (works for both EVM and Solana — just filter chainId) ──
async function fetchDex(ca, preferredChain) {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, {
    headers: { Accept: "application/json", "User-Agent": "trusty-ai/0.1" },
  });
  if (!r.ok) throw new Error("dex " + r.status);
  const data = await r.json();
  if (!Array.isArray(data?.pairs) || !data.pairs.length) return null;
  const filtered = preferredChain
    ? data.pairs.filter((p) => p.chainId === preferredChain)
    : [];
  const candidates = filtered.length ? filtered : data.pairs;

  // Choose the canonical pair by 24h volume (with a $1k liquidity floor
  // to avoid wash-trade fake pools) — but aggregate liquidity + volume
  // across ALL pairs of the same chain so the user sees the token's
  // real market depth, not a single thin pool.
  const principal = candidates
    .filter((p) => (p.liquidity?.usd || 0) >= 1000)
    .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0]
    || candidates.sort(
      (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];

  let totalLiq = 0, totalVol = 0;
  for (const p of candidates) {
    totalLiq += p.liquidity?.usd || 0;
    totalVol += p.volume?.h24 || 0;
  }

  return {
    symbol: principal.baseToken?.symbol,
    name: principal.baseToken?.name,
    priceUsd: parseFloat(principal.priceUsd) || 0,
    mcap: principal.marketCap || principal.fdv || 0,
    liquidityUsd: totalLiq,
    volume24h: totalVol,
    pairCreatedAt: principal.pairCreatedAt || 0,
  };
}

// ── RugCheck.xyz: Solana-specific LP analysis (free, no key) ──
// GoPlus's Solana endpoint frequently omits the dex/lp_holders arrays,
// especially for Pump.fun graduates whose LP is auto-burned on
// migration. RugCheck explicitly reports lpLockedPct per market, so we
// use it as the authoritative LP-locked source on Solana.
async function fetchRugCheck(ca) {
  const r = await fetch(`https://api.rugcheck.xyz/v1/tokens/${ca}/report`, {
    headers: { Accept: "application/json", "User-Agent": "trusty-ai/0.1" },
  });
  if (!r.ok) throw new Error("rugcheck " + r.status);
  const data = await r.json();
  const markets = Array.isArray(data?.markets) ? data.markets : [];
  // Use the maximum lpLockedPct across all markets as the headline
  // signal — if any major pool has LP locked ≥95%, the token is
  // effectively rug-resistant on that pool.
  let maxLockedPct = 0;
  for (const m of markets) {
    const pct = parseFloat(m?.lp?.lpLockedPct || 0);
    if (pct > maxLockedPct) maxLockedPct = pct;
  }
  return {
    lpLockedPct: maxLockedPct,
    rugScore: data?.score_normalised ?? data?.score ?? null,
    risks: Array.isArray(data?.risks) ? data.risks : [],
  };
}

// ── four.meme launchpad origin ──
// If a BSC contract was deployed via the four.meme exchange proxy
// (0x5c952063c7fc8610ffdb798152d69f0b9550762b), tag it so the UI can
// surface a "Launched on four.meme" badge with a deep link to the
// token's four.meme detail page. Origin is immutable per CA, so we
// cache the result (positive or negative) in KV for 30 days.
const FOUR_MEME_PROXY = "0x5c952063c7fc8610ffdb798152d69f0b9550762b";

async function fetchFourMemeOrigin(ca, chain, env) {
  // BSC only
  if (chain !== "bsc" && chain !== "evm" && chain !== "bnb") return null;
  if (!/^0x[a-f0-9]{40}$/i.test(ca)) return null;

  const cacheKey = `fourmeme:${ca.toLowerCase()}`;
  if (env.SCAN_KV) {
    const cached = await env.SCAN_KV.get(cacheKey, "json");
    if (cached !== null && cached !== undefined) {
      return cached.launched ? { launchedOn: "fourmeme" } : null;
    }
  }

  const apiKey = env.BSCSCAN_API_KEY ? `&apikey=${env.BSCSCAN_API_KEY}` : "";
  let launched = false;

  try {
    // Step 1: get the contract creation tx hash
    const ccUrl = `https://api.bscscan.com/api?module=contract&action=getcontractcreation&contractaddresses=${ca}${apiKey}`;
    const cr = await fetch(ccUrl, {
      headers: { Accept: "application/json", "User-Agent": "trusty-ai/0.1" },
    });
    if (cr.ok) {
      const cd = await cr.json();
      if (cd?.status === "1" && Array.isArray(cd.result) && cd.result.length) {
        const txHash = cd.result[0].txHash;
        if (txHash) {
          // Step 2: read the creation transaction's `to` field. If it was
          // sent to the four.meme proxy, the contract was deployed via
          // four.meme.
          const txUrl = `https://api.bscscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}${apiKey}`;
          const tr = await fetch(txUrl, {
            headers: { Accept: "application/json", "User-Agent": "trusty-ai/0.1" },
          });
          if (tr.ok) {
            const td = await tr.json();
            const to = (td?.result?.to || "").toLowerCase();
            if (to === FOUR_MEME_PROXY) launched = true;
          }
        }
      }
    }
  } catch (_) { /* graceful: no badge if lookup fails */ }

  if (env.SCAN_KV) {
    try {
      await env.SCAN_KV.put(cacheKey, JSON.stringify({ launched }), {
        expirationTtl: 30 * 24 * 60 * 60, // 30 days
      });
    } catch (_) {}
  }

  return launched ? { launchedOn: "fourmeme" } : null;
}

// ── GoPlus Solana token-security ──
// Same retry pattern as the EVM fetcher — see fetchGoPlus for rationale.
async function fetchGoPlusSolana(ca) {
  const url = `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${ca}`;
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, attempt === 1 ? 400 : 1000));
    }
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "trusty-ai/0.1" },
      });
      if (!r.ok) {
        if (r.status === 429 || r.status >= 500) {
          lastErr = new Error("goplus-sol " + r.status);
          continue;
        }
        throw new Error("goplus-sol " + r.status);
      }
      const data = await r.json();
      // Solana endpoint returns a result keyed by the original-case CA.
      let entry =
        data?.result?.[ca] ||
        data?.result?.[ca.toLowerCase()] ||
        data?.result?.[ca.toUpperCase()] ||
        null;
      // Fallback: take first key in the result map (case-insensitive lookup didn't hit)
      if (!entry && data?.result) {
        const keys = Object.keys(data.result);
        if (keys.length) entry = data.result[keys[0]];
      }
      if (entry && Object.keys(entry).length) return entry;
      lastErr = new Error("goplus-sol empty result");
      continue;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("goplus-sol exhausted retries");
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

/* ──────────────── Solana check builders ──────────────── */

function buildChecksSolana(g, rc) {
  if (!g) {
    return [
      { ok: false, label: "Not a honeypot" },
      { ok: false, label: "Transfer fee data unavailable" },
      { ok: !!(rc && rc.lpLockedPct >= 95), label: "LP locked" },
      { ok: false, label: "Mint disabled" },
      { ok: false, label: "Authorities renounced" },
    ];
  }

  // Honeypot equivalents on Solana: token marked non-transferable, OR
  // an active freeze authority that could brick balances.
  const nonTransferable = g.non_transferable === "1";
  const freezeActive = g.freezable?.status === "1" && (g.freezable.authority || []).length > 0;
  const notHoneypot = !nonTransferable && !freezeActive;

  // Transfer fee: SPL Token-2022 fee object. Empty object = no fee. If
  // it has bps > 0, that's the equivalent of EVM tax.
  const tfRaw = g.transfer_fee || {};
  const tfFutureRisk = g.transfer_fee_upgradable?.status === "1" && (g.transfer_fee_upgradable.authority || []).length > 0;
  const feeBps = parseFloat(tfRaw.transfer_fee_bps || tfRaw.bps || tfRaw.fee_rate || "0");
  const feePct = feeBps > 1 ? feeBps / 100 : feeBps; // bps→%
  const feeLabel = feePct === 0 ? "No transfer fee" : `Transfer fee ${feePct.toFixed(2)}%`;
  const feeOk = feePct === 0 && !tfFutureRisk;

  // Mint authority: empty/0 = mint revoked
  const mintDisabled = g.mintable?.status === "0";

  // "Renounced" composite: all major authorities are gone.
  const freezeRenounced = g.freezable?.status === "0";
  const closeRenounced = g.closable?.status === "0";
  const balanceMutRenounced = g.balance_mutable_authority?.status === "0";
  const transferHookSafe = !Array.isArray(g.transfer_hook) || g.transfer_hook.length === 0;
  const renounced = freezeRenounced && closeRenounced && balanceMutRenounced && transferHookSafe;

  // LP locked: layered detection — RugCheck lpLockedPct is the most
  // reliable Solana signal. Falls back to GoPlus dex burn_percent and
  // then lp_holders.is_locked when RugCheck is unavailable.
  const lpLocked = lpLockedSolana(g, rc);

  return [
    { ok: notHoneypot, label: "Not a honeypot" },
    { ok: feeOk, label: feeLabel },
    { ok: lpLocked, label: "LP locked" },
    { ok: mintDisabled, label: "Mint disabled" },
    { ok: renounced, label: "Authorities renounced" },
  ];
}

function lpLockedSolana(g, rc) {
  // Path 0 (best signal): RugCheck reports explicit lpLockedPct per
  // market. If any pool has ≥95% locked, treat as locked.
  if (rc && rc.lpLockedPct >= 95) return true;

  // Path 1: GoPlus dex array burn_percent — share of LP tokens burned
  // (rug-proof) per pool. If any meaningful-TVL pool has most LP tokens
  // burned, LP is effectively locked.
  const dex = g.dex || [];
  for (const pool of dex) {
    const tvl = parseFloat(pool.tvl || "0");
    const burn = parseFloat(pool.burn_percent || "0");
    if (tvl >= 10000 && burn >= 50) return true;
  }

  // Path 2 (fallback): explicit lp_holders is_locked flags. Used by
  // Solana lockers like Streamflow / Jup-Lock when a project locks
  // LP tokens via a vesting contract instead of burning.
  const holders = g.lp_holders || [];
  if (holders.length) {
    const totalPct = holders.reduce((s, h) => s + parseFloat(h.percent || "0"), 0);
    if (totalPct > 0) {
      const lockedPct = holders.reduce((s, h) => {
        const isLocked = h.is_locked === 1 || h.is_locked === "1";
        return s + (isLocked ? parseFloat(h.percent || "0") : 0);
      }, 0);
      if (lockedPct / totalPct >= 0.95) return true;
    }
  }

  return false;
}

function buildPaidChecksSolana(g) {
  if (!g) {
    return [
      { ok: false, label: "Top wallets: data unavailable" },
      { ok: false, label: "Dev wallet: data unavailable" },
    ];
  }
  // Top non-LP holder concentration. Solana doesn't tag LP/burn the same
  // way EVM does, so we filter by skipping locked holders (which are
  // typically LP positions).
  const holders = g.holders || [];
  let topShare = 0;
  let counted = 0;
  for (const h of holders) {
    if (counted >= 5) break;
    const isLocked = h.is_locked === 1 || h.is_locked === "1";
    if (isLocked) continue;
    topShare += parseFloat(h.percent || "0");
    counted++;
  }
  // Dev/creator concentration
  const creators = g.creators || [];
  const creatorPct = creators.reduce((sum, c) => sum + parseFloat(c.percent || c.balance_pct || "0"), 0);

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

function marketDataSolana(d, g) {
  // Same shape as EVM marketData(). Holder count comes from GoPlus.
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

function shortAddrSol(ca) {
  return ca.slice(0, 4) + "..." + ca.slice(-4);
}

/* ──────────────── End Solana ──────────────── */

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
function computeScore(g, checks, paidChecks, d) {
  if (!g) return 0;
  const w = {
    "Not a honeypot": 25,
    fee: 15, // EVM "Tax …" or Solana "No transfer fee" / "Transfer fee …"
    "LP locked": 15,
    "Mint disabled": 10,
    renounced: 10, // EVM "Contract renounced" or Solana "Authorities renounced"
    topWallets: 15,
    dev: 10,
  };
  let s = 0;
  for (const c of checks) {
    if (!c.ok) continue;
    if (c.label === "Not a honeypot") s += w["Not a honeypot"];
    else if (c.label.startsWith("Tax") || c.label === "No transfer fee" || c.label.startsWith("Transfer fee")) s += w.fee;
    else if (c.label === "LP locked") s += w["LP locked"];
    else if (c.label === "Mint disabled") s += w["Mint disabled"];
    else if (c.label === "Contract renounced" || c.label === "Authorities renounced") s += w.renounced;
  }
  for (const c of paidChecks) {
    if (!c.ok) continue;
    if (/^Top \d+ wallets/i.test(c.label)) s += w.topWallets;
    else if (/^Dev wallet/i.test(c.label)) s += w.dev;
  }

  // Liveness penalty — a token can pass every safety check and
  // still be totally dead (no volume, no liquidity, abandoned).
  // Without this penalty, $2-volume tokens score APE 85/100, which
  // is misleading. We apply a graduated penalty based on real
  // market activity from Dexscreener + holder count from GoPlus.
  s -= livenessPenalty(d, g);

  return Math.max(0, Math.min(100, s));
}

// Returns 0 (lively token) up to ~60 (clearly abandoned). Tuned so
// a token with $2/24h volume drops out of APE territory even with
// pristine safety checks.
function livenessPenalty(d, g) {
  // No Dexscreener data at all means no tradeable pair — the token
  // either isn't listed yet or has been delisted. High dead signal.
  if (!d) return 35;

  let penalty = 0;
  const vol = d.volume24h || 0;
  const liq = d.liquidityUsd || 0;
  const holders = g?.holder_count ? parseInt(g.holder_count, 10) : 0;
  const pairAgeMs = d.pairCreatedAt ? (Date.now() - d.pairCreatedAt) : 0;
  const ageDays = Math.floor(pairAgeMs / 86400000);

  // Volume signals (dominant deadness indicator)
  if (vol < 100) penalty += 35;
  else if (vol < 1000) penalty += 18;
  else if (vol < 10000) penalty += 6;

  // Liquidity signals (thin pool = exit risk)
  if (liq < 5000) penalty += 15;
  else if (liq < 20000) penalty += 6;

  // Holders (only EVM exposes holder_count via GoPlus)
  if (holders > 0 && holders < 50) penalty += 10;
  else if (holders > 0 && holders < 200) penalty += 4;

  // Abandoned signal: old pair with no current activity. Strong
  // because "high score on a 2-year-old token nobody trades" is
  // exactly the misleading case the user flagged.
  if (ageDays > 180 && vol < 1000) penalty += 15;

  // Cap so a fully-loaded penalty can't fully erase a perfectly
  // legitimate token's safety credit.
  return Math.min(60, penalty);
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

/* ── Did GoPlus actually respond? ──
   When the upstream fetchGoPlus / fetchGoPlusSolana call returns
   null, buildChecks emits placeholder labels containing the word
   "data unavailable". A real rug-scoring scan never produces those
   strings — even an all-failing scan returns "Tax 0% / 0%" or
   "Transfer fee 5%". So labels are the cleanest tell. */
function isUpstreamOk(scan) {
  if (!scan || !Array.isArray(scan.checks)) return false;
  for (const c of scan.checks) {
    if (typeof c.label === "string" && /data unavailable/i.test(c.label)) {
      return false;
    }
  }
  for (const c of scan.paidChecks || []) {
    if (typeof c.label === "string" && /data unavailable/i.test(c.label)) {
      return false;
    }
  }
  return true;
}

/* ================================================================
   Sorsa (formerly TweetScout) — KOL mentions + X activity
   ================================================================ */

const EMPTY_KOLS = {
  kols: [],
  activity: { tweets24h: 0, deltaPct: 0, sentiment: "—", coordShill: false },
};

async function fetchKols(ca, chain, env, symbol) {
  if (!env.SORSA_API_KEY) return EMPTY_KOLS;

  // 1) Search recent tweets mentioning the token. If we have a symbol,
  //    use it (most tweets say "$TRUSTY" not the 42-char hex). Combine
  //    cashtag, hashtag, and the raw CA with Twitter's OR operator
  //    to catch all the ways people reference the token in one call.
  const query = buildSearchQuery(ca, symbol);
  const searchResult = await sorsaSearchTweets(query, env.SORSA_API_KEY);
  const tweets = searchResult.tweets;
  const tweets24h = countWithin(tweets, 24 * 3600 * 1000);

  if (!tweets.length) return EMPTY_KOLS;

  // 2) Rank tweets by engagement (likes + 3×retweets + 5×replies). Real
  //    engagement is a much stronger signal of influence than follower
  //    count — follower counts are heavily botted on crypto Twitter,
  //    while a tweet that earned actual replies took someone's attention.
  //    This also lets us drop the second /info-batch call entirely,
  //    halving our Sorsa quota usage per scan.
  const ranked = tweets
    .map((t) => ({ ...t, engagement: engagementScore(t) }))
    .filter((t) => t.engagement > 0) // zero-engagement = bot/dead tweet
    .sort((a, b) => b.engagement - a.engagement);

  // 3) Top 5 *unique authors* — same author may have multiple tweets;
  //    keep only their highest-engagement one.
  const seenAuthors = new Set();
  const top = [];
  for (const t of ranked) {
    const h = t.author?.handle?.toLowerCase();
    if (!h || seenAuthors.has(h)) continue;
    seenAuthors.add(h);
    top.push(t);
    if (top.length >= 5) break;
  }

  const kols = top.map((t) => {
    const minsAgo = t.ts ? Math.max(1, Math.floor((Date.now() - t.ts) / 60000)) : 0;
    const tweetUrl = t.id
      ? "https://x.com/" + encodeURIComponent(t.author.handle) + "/status/" + encodeURIComponent(t.id)
      : null;
    return {
      handle: "@" + t.author.handle,
      likes: t.likes || 0,
      retweets: t.retweets || 0,
      replies: t.replies || 0,
      mins: minsAgo,
      tweetUrl,
      // Truncated text for hover-preview. Cap at 280 chars (X limit).
      text: (t.text || "").slice(0, 280),
    };
  });

  return {
    kols,
    activity: {
      tweets24h,
      deltaPct: 0, // 2nd window-search would double quota; defer
      sentiment: scoreSentiment(tweets),
      coordShill: detectCoordShill(tweets),
    },
  };
}

function engagementScore(t) {
  return (t.likes || 0) + 3 * (t.retweets || 0) + 5 * (t.replies || 0);
}

/* ── Sorsa search: build query, broadening with symbol/hashtag if known ── */
function buildSearchQuery(ca, symbol) {
  const parts = [];
  if (symbol && /^[A-Za-z0-9_]{2,12}$/.test(symbol)) {
    parts.push("$" + symbol);
    parts.push("#" + symbol);
  }
  parts.push(ca);
  // Twitter OR is uppercase-required and space-padded.
  return parts.join(" OR ");
}

/* ── Sentiment heuristic: bullish vs bearish word counts across tweets ── */
const BULL_WORDS = /\b(moon(?:ing)?|pump(?:ing)?|bull(?:ish)?|ape(?:in|ing)?|send(?:ing|er)?|gem|rocket|rugproof|lfg|x(?:1\d|\d{2,})|wagmi|10x|100x|undervalued|legit|strong|mooning|gainz?)\b/gi;
const BEAR_WORDS = /\b(rug(?:ged|pull)?|scam(?:my)?|honeypot|dump(?:ing|ed)?|dead|exit liquidity|ponzi|bear(?:ish)?|jeet|red flag|avoid|fake|sus|sketchy)\b/gi;

function scoreSentiment(tweets) {
  if (!tweets.length) return "—";
  let bull = 0, bear = 0;
  for (const t of tweets) {
    const text = t.text || "";
    bull += (text.match(BULL_WORDS) || []).length;
    bear += (text.match(BEAR_WORDS) || []).length;
  }
  const total = bull + bear;
  // Lowered threshold from 3 → 2 to surface signal on smaller token
  // chatter. Fall through to "Neutral" when tweets exist but no
  // bullish/bearish words land — better UX than "—" for a token that
  // clearly has activity but mundane / news-style chatter.
  if (total < 2) return "Neutral";
  const bullPct = Math.round((bull / total) * 100);
  if (bullPct >= 60) return bullPct + "% bullish";
  if (bullPct <= 40) return 100 - bullPct + "% bearish";
  return "Mixed";
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
        likes: numOr0(t.likes_count),
        retweets: numOr0(t.retweet_count ?? t.retweets_count),
        replies: numOr0(t.reply_count ?? t.replies_count),
      }))
      .filter((t) => t.author);
    return { tweets };
  } catch (e) {
    console.warn("sorsa search-tweets error", e?.message);
    return { tweets: [] };
  }
}

function numOr0(v) {
  const n = parseInt(v, 10);
  return isFinite(n) && n >= 0 ? n : 0;
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

/* ================================================================
   NOWPayments — crypto-pay subscriptions ($5/mo, $50/yr)

   Plans:
     monthly: $5  →  30 days
     yearly:  $50 → 365 days

   Flow:
     1. Extension calls /api/subscribe with subId + plan.
     2. Worker creates NOWPayments invoice, stores `sub:<subId>` in KV
        with status="pending".
     3. User pays via NOWPayments hosted checkout in a new tab.
     4. NOWPayments fires IPN to /api/nowpayments-webhook.
     5. Worker verifies HMAC-SHA512 signature, marks paid in KV with
        an expiry timestamp.
     6. Extension polls /api/subscription and flips its tier locally.
   ================================================================ */

const PLAN_MONTHLY = { id: "monthly", price: 5, days: 30 };
const PLAN_YEARLY = { id: "yearly", price: 50, days: 365 };

function planFor(id) {
  if (id === "monthly") return PLAN_MONTHLY;
  if (id === "yearly") return PLAN_YEARLY;
  return null;
}

async function handleSubscribe(url, env) {
  if (!env.NOWPAYMENTS_API_KEY) {
    return json({ error: "subscriptions not configured" }, 503);
  }
  const subId = (url.searchParams.get("subId") || "").trim();
  const planId = (url.searchParams.get("plan") || "").trim().toLowerCase();
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(subId)) {
    return json({ error: "invalid subId" }, 400);
  }
  const plan = planFor(planId);
  if (!plan) return json({ error: "invalid plan" }, 400);

  const orderId = `trusty-${plan.id}-${subId}-${Date.now()}`;
  const body = {
    price_amount: plan.price,
    price_currency: "usd",
    order_id: orderId,
    order_description: `Trusty AI ${plan.id} subscription`,
    ipn_callback_url: "https://api.trustyai.tech/api/nowpayments-webhook",
    success_url: "https://trustyai.tech/?upgrade=success",
    cancel_url: "https://trustyai.tech/?upgrade=cancel",
  };

  let invoice;
  try {
    const r = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": env.NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.warn("nowpayments invoice", r.status, txt.slice(0, 200));
      return json({ error: "invoice creation failed", status: r.status }, 502);
    }
    invoice = await r.json();
  } catch (e) {
    console.warn("nowpayments invoice error", e?.message);
    return json({ error: "invoice creation failed" }, 502);
  }

  if (!invoice?.id || !invoice?.invoice_url) {
    return json({ error: "invoice creation failed" }, 502);
  }

  // Store pending state — 24h TTL gives the user a day to complete payment
  // before the pending entry self-cleans. Webhook will overwrite with
  // longer TTL on successful payment.
  if (env.SCAN_KV) {
    try {
      await env.SCAN_KV.put(
        `sub:${subId}`,
        JSON.stringify({
          plan: plan.id,
          status: "pending",
          invoiceId: String(invoice.id),
          orderId,
          createdAt: Date.now(),
        }),
        { expirationTtl: 86400 }
      );
    } catch (_) {}
  }

  return json({
    invoiceUrl: invoice.invoice_url,
    invoiceId: String(invoice.id),
    orderId,
    plan: plan.id,
    priceUsd: plan.price,
  });
}

async function handleWebhook(request, env) {
  const signature = request.headers.get("x-nowpayments-sig");
  if (!signature) return json({ error: "no signature" }, 401);
  if (!env.NOWPAYMENTS_IPN_SECRET) return json({ error: "ipn not configured" }, 503);

  const rawBody = await request.text();
  const valid = await verifyIpnSignature(rawBody, signature, env.NOWPAYMENTS_IPN_SECRET);
  if (!valid) {
    console.warn("nowpayments webhook: invalid signature");
    return json({ error: "invalid signature" }, 401);
  }

  let data;
  try { data = JSON.parse(rawBody); } catch (_) { return json({ error: "bad body" }, 400); }

  // order_id format: trusty-<plan>-<subId>-<timestamp>
  const m = String(data.order_id || "").match(
    /^trusty-(monthly|yearly)-([a-zA-Z0-9_-]+)-(\d+)$/
  );
  if (!m) {
    console.warn("nowpayments webhook: unrecognized order_id", data.order_id);
    return json({ ok: true, ignored: "unrecognized order_id" });
  }
  const planId = m[1];
  const subId = m[2];
  const plan = planFor(planId);
  if (!plan) return json({ ok: true, ignored: "unknown plan" });

  const status = String(data.payment_status || data.status || "").toLowerCase();

  if (env.SCAN_KV) {
    if (status === "finished" || status === "confirmed" || status === "sending") {
      const durationMs = plan.days * 86400000;
      const now = Date.now();
      // Renewal: if there's an existing paid sub still active, extend
      // from the current expiry instead of resetting to now+duration.
      let baseTime = now;
      try {
        const existing = await env.SCAN_KV.get(`sub:${subId}`, "json");
        if (existing && existing.status === "paid" && existing.expiresAt > now) {
          baseTime = existing.expiresAt;
        }
      } catch (_) {}
      const expiresAt = baseTime + durationMs;
      try {
        await env.SCAN_KV.put(
          `sub:${subId}`,
          JSON.stringify({
            plan: plan.id,
            status: "paid",
            invoiceId: String(data.invoice_id || data.id || ""),
            orderId: data.order_id,
            paidAt: now,
            expiresAt,
            paidAmount: data.actually_paid || data.pay_amount,
            payCurrency: data.pay_currency,
          }),
          // Grace period of 1 day past expiry so an early-renewal flow
          // can read the previous plan even after expiry.
          { expirationTtl: Math.floor(durationMs / 1000) + 86400 }
        );
      } catch (_) {}
      // Issue (or reuse) a recovery code so the user can activate this
      // sub on a backup device. Surfaced via /api/subscription.
      try { await ensureRecoveryCode(env, subId); } catch (_) {}
    } else if (status === "expired" || status === "failed" || status === "refunded") {
      try { await env.SCAN_KV.delete(`sub:${subId}`); } catch (_) {}
    }
    // For other statuses (waiting, confirming, partially_paid) keep the
    // existing pending row.
  }

  return json({ ok: true });
}

async function handleSubscriptionStatus(url, env) {
  const subId = (url.searchParams.get("subId") || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(subId)) {
    return json({ error: "invalid subId" }, 400);
  }
  if (!env.SCAN_KV) return json({ status: "none" });
  const sub = await env.SCAN_KV.get(`sub:${subId}`, "json");
  if (!sub) return json({ status: "none" });

  // Surface expiry as a derived field
  if (sub.status === "paid" && sub.expiresAt && sub.expiresAt < Date.now()) {
    sub.status = "expired";
  }

  // Surface the recovery code if one exists for this subId — used by
  // the popup to display "save this for your backup device".
  // Recovery codes are only issued for paid subs (not code-redeemed
  // subs — those don't generate sub-codes).
  if (sub.status === "paid" && sub.via !== "code") {
    try {
      const recovery = await env.SCAN_KV.get(`recovery:${subId}`, "text");
      if (recovery && isValidCodeShape(recovery)) {
        const rec = await env.SCAN_KV.get(`code:${recovery}`, "json");
        if (rec && !rec.revoked) {
          sub.recoveryCode = recovery;
          sub.recoveryUsed = (rec.uses || 0) >= (rec.maxUses || 1);
        }
      }
    } catch (_) {}
  }

  return json(sub);
}

/* ================================================================
   Redemption codes — single feature that handles:

     - Recovery codes (auto-issued on payment, lets user activate
       same sub on one backup device)
     - Lifetime codes (admin-minted, hand-given to whales via TG)
     - Monthly codes (admin-minted, promo for $TRUSTY holders)
     - Trial codes (admin-minted, time-bounded access for testing)

   KV schema:
     code:<CODE> = {
       type: "recovery"|"lifetime"|"monthly"|"yearly"|"trial-7d",
       maxUses: number,
       uses: number,
       redeemedBy: [subId, ...],
       parentSubId?: subId,    // for recovery codes — the original
                               // payment's subId, so we can mirror its
                               // expiresAt onto the redeeming device
       notes?: string,         // admin reference (e.g. "whale 0x123")
       createdAt: timestamp,
       revoked?: boolean
     }
   ================================================================ */

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0,O,1,I,L

function generateCode() {
  // TRUSTY-XXXX-XXXX (10 chars + 7 prefix/dashes = 17 total).
  // ~32^8 ≈ 1.1 trillion combos.
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return "TRUSTY-" + s.slice(0, 4) + "-" + s.slice(4);
}

function isValidCodeShape(code) {
  return /^TRUSTY-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(code);
}

async function handleAdminMintCode(request, env) {
  const secret = request.headers.get("x-admin-secret") || "";
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.SCAN_KV) return json({ error: "kv not configured" }, 503);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "bad json" }, 400); }

  const allowed = ["lifetime", "monthly", "yearly", "trial-7d"];
  const type = String(body?.type || "");
  if (!allowed.includes(type)) {
    return json({ error: "invalid type — allowed: " + allowed.join(", ") }, 400);
  }
  const maxUses = Math.max(1, Math.min(parseInt(body?.maxUses || "1", 10) || 1, 1000));
  const notes = String(body?.notes || "").slice(0, 200);

  const code = generateCode();
  const now = Date.now();
  const record = {
    type,
    maxUses,
    uses: 0,
    redeemedBy: [],
    notes,
    createdAt: now,
  };
  // Codes themselves don't expire — just the resulting subscription
  // does (per the type's duration). Admin can revoke if needed.
  try {
    await env.SCAN_KV.put(`code:${code}`, JSON.stringify(record));
  } catch (_) {
    return json({ error: "kv write failed" }, 503);
  }

  return json({ code, type, maxUses, notes, createdAt: now });
}

async function handleRedeemCode(request, env) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "bad json" }, 400); }

  const code = String(body?.code || "").trim().toUpperCase();
  const subId = String(body?.subId || "").trim();

  if (!isValidCodeShape(code)) return json({ error: "invalid code format" }, 400);
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(subId)) return json({ error: "invalid subId" }, 400);
  if (!env.SCAN_KV) return json({ error: "kv not configured" }, 503);

  const rec = await env.SCAN_KV.get(`code:${code}`, "json");
  if (!rec) return json({ error: "code not found" }, 404);
  if (rec.revoked) return json({ error: "code revoked" }, 410);
  if (rec.uses >= rec.maxUses) return json({ error: "code already fully redeemed" }, 410);
  if ((rec.redeemedBy || []).includes(subId)) {
    return json({ error: "already redeemed by this device" }, 409);
  }

  // Compute the resulting subscription's expiresAt based on code type
  const now = Date.now();
  let expiresAt, planId;
  if (rec.type === "lifetime") {
    expiresAt = now + 100 * 365 * 86400000; // ~100 years
    planId = "lifetime";
  } else if (rec.type === "yearly") {
    expiresAt = now + 365 * 86400000;
    planId = "yearly";
  } else if (rec.type === "monthly") {
    expiresAt = now + 30 * 86400000;
    planId = "monthly";
  } else if (rec.type === "trial-7d") {
    expiresAt = now + 7 * 86400000;
    planId = "trial-7d";
  } else if (rec.type === "recovery") {
    // Recovery code mirrors the parent sub's expiresAt so the backup
    // device gets exactly the remaining time of the original.
    if (!rec.parentSubId) return json({ error: "recovery code missing parent" }, 500);
    const parent = await env.SCAN_KV.get(`sub:${rec.parentSubId}`, "json");
    if (!parent || !parent.expiresAt) return json({ error: "original subscription not found" }, 410);
    if (parent.expiresAt <= now) return json({ error: "original subscription expired" }, 410);
    expiresAt = parent.expiresAt;
    planId = parent.plan || "recovered";
  } else {
    return json({ error: "unknown code type" }, 500);
  }

  // Renewal-friendly: if the redeeming subId already has an active sub,
  // extend from that expiry instead of overriding (so codes stack with
  // existing time, never shorten).
  let baseTime = now;
  try {
    const existing = await env.SCAN_KV.get(`sub:${subId}`, "json");
    if (existing && existing.status === "paid" && existing.expiresAt > now) {
      // For lifetime, take the max. For time-bounded, extend.
      if (rec.type === "lifetime") {
        // Lifetime always wins; expiresAt stays at the 100-year mark.
      } else {
        baseTime = existing.expiresAt;
        const durationMs = expiresAt - now;
        expiresAt = baseTime + durationMs;
      }
    }
  } catch (_) {}

  // Apply the subscription
  const subRecord = {
    plan: planId,
    status: "paid",
    paidAt: now,
    expiresAt,
    via: "code",
    codeType: rec.type,
  };
  try {
    // Cloudflare KV caps expirationTtl around 1 year; for lifetime
    // codes (100-year expiry) we just skip the TTL entirely so the
    // record persists forever. Other types fit fine.
    const durationDays = (expiresAt - now) / 86400000;
    const putOpts = (rec.type === "lifetime" || durationDays > 360)
      ? undefined
      : { expirationTtl: Math.floor((expiresAt - now) / 1000) + 86400 };
    await env.SCAN_KV.put(`sub:${subId}`, JSON.stringify(subRecord), putOpts);
  } catch (e) {
    return json({ error: "could not apply subscription: " + (e?.message || "kv error") }, 503);
  }

  // Mark code as used
  try {
    rec.uses = (rec.uses || 0) + 1;
    rec.redeemedBy = [...(rec.redeemedBy || []), subId];
    rec.lastRedeemedAt = now;
    await env.SCAN_KV.put(`code:${code}`, JSON.stringify(rec));
  } catch (_) {
    // Non-fatal — sub is already applied. Worst case: code might be
    // redeemable again in a race. Rare given KV's eventual consistency.
  }

  return json({
    ok: true,
    type: rec.type,
    plan: planId,
    expiresAt,
    durationDays: Math.round((expiresAt - now) / 86400000),
  });
}

// Aggregate counts across the major KV prefixes. Used by the
// /admin/ web page to surface "active subs / total installs /
// scans last 24h" without exposing any per-user data. KV list is
// paginated (1000 keys/page) and we cap at 5 pages each (5k items)
// to keep latency bounded — at launch scale that's plenty.
async function handleAdminStats(request, env) {
  const secret = request.headers.get("x-admin-secret") || "";
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.SCAN_KV) return json({ error: "kv not configured" }, 503);

  const now = Date.now();

  async function listAll(prefix, maxPages = 5) {
    const out = [];
    let cursor;
    for (let i = 0; i < maxPages; i++) {
      const page = await env.SCAN_KV.list({ prefix, cursor, limit: 1000 });
      out.push(...page.keys);
      if (page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }
    return out;
  }

  // Subscriptions: count paid (active) vs expired vs pending
  const subKeys = await listAll("sub:");
  let paidActive = 0, paidExpired = 0, pending = 0;
  let viaCode = 0, viaPayment = 0;
  let monthly = 0, yearly = 0, lifetime = 0, trial = 0;
  for (const k of subKeys) {
    try {
      const rec = await env.SCAN_KV.get(k.name, "json");
      if (!rec) continue;
      if (rec.status === "pending") { pending++; continue; }
      if (rec.status === "paid") {
        if (rec.expiresAt && rec.expiresAt > now) {
          paidActive++;
          if (rec.via === "code") viaCode++; else viaPayment++;
          if (rec.plan === "monthly") monthly++;
          else if (rec.plan === "yearly") yearly++;
          else if (rec.plan === "lifetime") lifetime++;
          else if (rec.plan === "trial-7d") trial++;
        } else {
          paidExpired++;
        }
      }
    } catch (_) {}
  }

  // Installs (proxy via watchlist keys — each install creates one)
  const wlKeys = await listAll("wl:");

  // Codes
  const codeKeys = await listAll("code:");
  let codesByType = { lifetime: 0, yearly: 0, monthly: 0, "trial-7d": 0, recovery: 0 };
  let codesUnused = 0, codesPartial = 0, codesFullyUsed = 0;
  for (const k of codeKeys) {
    try {
      const rec = await env.SCAN_KV.get(k.name, "json");
      if (!rec) continue;
      if (codesByType[rec.type] !== undefined) codesByType[rec.type]++;
      const uses = rec.uses || 0;
      const max = rec.maxUses || 1;
      if (uses === 0) codesUnused++;
      else if (uses < max) codesPartial++;
      else codesFullyUsed++;
    } catch (_) {}
  }

  // Last 24h activity — sum the hourly buckets in evt:*
  // Bucket key: evt:<type>:<chain>:<ca>:<hour>
  const cutoff = Math.floor(now / 3600000) - 24;
  const evtKeys = await listAll("evt:");
  let scans24h = 0, saves24h = 0;
  for (const k of evtKeys) {
    const parts = k.name.split(":");
    if (parts.length < 5) continue;
    const type = parts[1];
    const hour = parseInt(parts[parts.length - 1], 10);
    if (!Number.isFinite(hour) || hour < cutoff) continue;
    try {
      const v = await env.SCAN_KV.get(k.name);
      const n = parseInt(v || "0", 10) || 0;
      if (type === "scan") scans24h += n;
      else if (type === "watchlist_add") saves24h += n;
    } catch (_) {}
  }

  // Distinct CAs scanned in last 24h (proxy for breadth of activity)
  const evtIdxKeys = await listAll("evtidx:");

  return json({
    generatedAt: now,
    subscriptions: {
      paidActive,
      paidExpired,
      pending,
      byPlan: { monthly, yearly, lifetime, trial },
      byVia: { payment: viaPayment, code: viaCode },
    },
    installs: {
      // wlKeys.length is a lower bound — only counts installs that
      // saved at least one token. Real installs include people who
      // never used the watchlist.
      withWatchlist: wlKeys.length,
    },
    activity24h: {
      scans: scans24h,
      saves: saves24h,
      distinctTokens: evtIdxKeys.length,
    },
    codes: {
      total: codeKeys.length,
      byType: codesByType,
      unused: codesUnused,
      partiallyUsed: codesPartial,
      fullyUsed: codesFullyUsed,
    },
  });
}

async function handleAdminListCodes(request, env) {
  const secret = request.headers.get("x-admin-secret") || "";
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.SCAN_KV) return json({ error: "kv not configured" }, 503);

  // List all code:* keys (paginated, capped at 5k)
  const out = [];
  let cursor;
  for (let i = 0; i < 5; i++) {
    const page = await env.SCAN_KV.list({ prefix: "code:", cursor, limit: 1000 });
    for (const k of page.keys) {
      try {
        const rec = await env.SCAN_KV.get(k.name, "json");
        if (!rec) continue;
        out.push({
          code: k.name.replace(/^code:/, ""),
          type: rec.type,
          maxUses: rec.maxUses || 1,
          uses: rec.uses || 0,
          redeemedBy: rec.redeemedBy || [],
          notes: rec.notes || "",
          createdAt: rec.createdAt || 0,
          revoked: !!rec.revoked,
          parentSubId: rec.parentSubId || null,
        });
      } catch (_) {}
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  // Sort newest first
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return json({ codes: out });
}

async function handleAdminRevokeCode(request, env) {
  const secret = request.headers.get("x-admin-secret") || "";
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.SCAN_KV) return json({ error: "kv not configured" }, 503);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "bad json" }, 400); }
  const code = String(body?.code || "").trim().toUpperCase();
  if (!isValidCodeShape(code)) return json({ error: "invalid code format" }, 400);

  const rec = await env.SCAN_KV.get(`code:${code}`, "json");
  if (!rec) return json({ error: "code not found" }, 404);

  // Mark revoked so future redemptions fail
  rec.revoked = true;
  rec.revokedAt = Date.now();
  try {
    await env.SCAN_KV.put(`code:${code}`, JSON.stringify(rec));
  } catch (_) {
    return json({ error: "kv write failed" }, 503);
  }

  // Tear down access for everyone who already redeemed this code.
  // Only deletes subs whose `via:"code"` came from this exact code
  // type — so we don't accidentally nuke a paid user who later
  // happened to reuse the same subId.
  let revokedSubs = 0;
  for (const subId of (rec.redeemedBy || [])) {
    try {
      const sub = await env.SCAN_KV.get(`sub:${subId}`, "json");
      if (sub && sub.via === "code" && sub.codeType === rec.type) {
        await env.SCAN_KV.delete(`sub:${subId}`);
        revokedSubs++;
      }
    } catch (_) {}
  }

  return json({ ok: true, revokedSubs });
}

// Auto-issue a recovery code linked to a subscription. Called from the
// payment webhook when a sub first goes paid. The returned code is
// surfaced to the user via /api/subscription so the popup can display
// "Save this for your backup device".
async function ensureRecoveryCode(env, subId) {
  if (!env.SCAN_KV) return null;
  // Reuse if one already exists (e.g. on renewal).
  const existing = await env.SCAN_KV.get(`recovery:${subId}`, "text");
  if (existing && isValidCodeShape(existing)) {
    // Re-fetch the code record to confirm it's still valid
    const rec = await env.SCAN_KV.get(`code:${existing}`, "json");
    if (rec && !rec.revoked) return existing;
  }
  // Mint a new recovery code
  const code = generateCode();
  const record = {
    type: "recovery",
    maxUses: 1, // one backup device
    uses: 0,
    redeemedBy: [],
    parentSubId: subId,
    createdAt: Date.now(),
  };
  try {
    await env.SCAN_KV.put(`code:${code}`, JSON.stringify(record));
    await env.SCAN_KV.put(`recovery:${subId}`, code);
  } catch (_) { return null; }
  return code;
}

/* ================================================================
   Watchlist — cloud-synced per subId, soft cap at 100 items.

   The client (extension) enforces the *tier-aware* cap (5 for free,
   unlimited for paid) since it knows the user's local tier across
   both wallet and subscription paths. The server keeps a 100-item
   anti-abuse ceiling and trusts whatever the client sends within
   that. Watchlist is small data — full-list replace on every change
   is fine and avoids merge complexity.
   ================================================================ */

const WATCHLIST_HARD_CAP = 100;

async function handleWatchlistGet(url, env) {
  const subId = (url.searchParams.get("subId") || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(subId)) {
    return json({ error: "invalid subId" }, 400);
  }
  if (!env.SCAN_KV) return json({ items: [] });
  const stored = await env.SCAN_KV.get(`wl:${subId}`, "json");
  return json({ items: Array.isArray(stored?.items) ? stored.items : [] });
}

async function handleWatchlistPost(request, url, env) {
  const subId = (url.searchParams.get("subId") || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(subId)) {
    return json({ error: "invalid subId" }, 400);
  }
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "bad json" }, 400); }

  const action = body?.action;
  if (action !== "replace" && action !== "add" && action !== "remove") {
    return json({ error: "invalid action" }, 400);
  }

  // Load current
  let current = { items: [] };
  if (env.SCAN_KV) {
    const stored = await env.SCAN_KV.get(`wl:${subId}`, "json");
    if (stored && Array.isArray(stored.items)) current = stored;
  }

  let next;
  if (action === "replace") {
    if (!Array.isArray(body.items)) return json({ error: "items array required" }, 400);
    next = body.items.map(normalizeWatchlistItem).filter(Boolean);
  } else {
    if (!body.item || typeof body.item !== "object") return json({ error: "item required" }, 400);
    const item = normalizeWatchlistItem(body.item);
    if (!item) return json({ error: "invalid item" }, 400);
    const key = item.chain + ":" + item.ca.toLowerCase();
    if (action === "add") {
      const without = current.items.filter((x) => (x.chain + ":" + x.ca.toLowerCase()) !== key);
      next = [item, ...without];
    } else { // remove
      next = current.items.filter((x) => (x.chain + ":" + x.ca.toLowerCase()) !== key);
    }
  }

  // Anti-abuse hard cap
  if (next.length > WATCHLIST_HARD_CAP) next = next.slice(0, WATCHLIST_HARD_CAP);

  if (env.SCAN_KV) {
    try {
      await env.SCAN_KV.put(
        `wl:${subId}`,
        JSON.stringify({ items: next, updatedAt: Date.now() }),
        // No TTL — watchlist is durable. Eviction only on user-side
        // delete or explicit purge.
      );
    } catch (_) {}
  }

  return json({ items: next });
}

function normalizeWatchlistItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ca = String(raw.ca || "").trim();
  const chain = String(raw.chain || "bsc").toLowerCase();
  if (!ca) return null;
  // Light shape — enough to render a row + re-fetch a fresh scan.
  return {
    ca,
    chain,
    symbol: typeof raw.symbol === "string" ? raw.symbol.slice(0, 16) : "",
    name: typeof raw.name === "string" ? raw.name.slice(0, 64) : "",
    addedAt: Number.isFinite(raw.addedAt) ? raw.addedAt : Date.now(),
  };
}

/* ================================================================
   Trending feed — anonymous activity-based ranking.

   The extension and website POST to /api/event whenever a CA gets
   real attention (a scan, a watchlist add). We bucket counts in KV
   under hourly keys per CA. /api/trending reads the rolling 24h
   window, aggregates, and returns the top-ranked CAs with their
   live scan data inline.

   Privacy: events are CA-only. No subId, no IP, no user agent. We
   capture *what tokens* the network is paying attention to — never
   *who* is paying attention.
   ================================================================ */

const TRENDING_HARD_LIMIT = 30; // we expose at most this many trending CAs
const EVENT_TYPES = new Set(["scan", "watchlist_add"]);

async function handleEvent(request, env) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "bad json" }, 400); }

  const type = String(body?.type || "").toLowerCase();
  if (!EVENT_TYPES.has(type)) return json({ error: "invalid type" }, 400);

  const rawCa = String(body?.ca || "").trim();
  const chain = String(body?.chain || "bsc").toLowerCase();
  const isSol = isSolana(chain);
  const ca = isSol ? rawCa : rawCa.toLowerCase();
  if (!isValidCa(ca, chain)) return json({ error: "invalid ca" }, 400);

  if (!env.SCAN_KV) return json({ ok: true, recorded: false });

  // Bucket by UTC hour. Keys roll off naturally via 25h TTL, so the
  // 24h window is always populated with at most 25 hour-buckets.
  const hour = Math.floor(Date.now() / 3600000); // hours since epoch
  const bucketKey = `evt:${type}:${chain}:${ca}:${hour}`;

  // Increment: KV doesn't support atomic counters, so we read-modify-
  // write. Race conditions cause occasional under-counting — fine for
  // a "trending" leaderboard, no money at stake.
  let current = 0;
  try {
    const existing = await env.SCAN_KV.get(bucketKey);
    current = parseInt(existing || "0", 10) || 0;
  } catch (_) {}
  try {
    await env.SCAN_KV.put(bucketKey, String(current + 1), {
      expirationTtl: 25 * 3600, // 25h, slightly longer than the read window
    });
  } catch (_) {}

  // Also maintain a registry of recently-active CAs so the trending
  // aggregator can find them without a full KV list scan (which would
  // be expensive). One key per (chain,ca), refreshed on each event.
  const indexKey = `evtidx:${chain}:${ca}`;
  try {
    await env.SCAN_KV.put(
      indexKey,
      JSON.stringify({ chain, ca, lastSeen: Date.now() }),
      { expirationTtl: 25 * 3600 }
    );
  } catch (_) {}

  return json({ ok: true });
}

async function handleTrending(url, env) {
  const window = parseInt(url.searchParams.get("window") || "24", 10) || 24;
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "10", 10) || 10,
    TRENDING_HARD_LIMIT
  );
  // v2: invalidates pre-2026-05-09 cache so the new symbolFallback
  // filter flushes hex-named ($LFDM/$0A43-style) tokens immediately.
  const cacheKey = `trending:v2:w${window}:l${limit}`;

  if (env.SCAN_KV) {
    const cached = await env.SCAN_KV.get(cacheKey, "json");
    if (cached) return json(cached);
  }

  const items = await computeTrending(env, window);
  const top = items.slice(0, limit);

  // Hydrate top entries with live scan data so the website can render
  // a real card per row in one round-trip. Call the scan logic
  // directly — Workers can't reliably fetch their own custom domain.
  // We reuse the same KV cache too, so this is just a cache lookup
  // for any token already scanned in the last 5 min.
  const hydrated = await Promise.all(
    top.map(async (it) => {
      try {
        const cacheKey = `scan:v2:${it.chain}:${it.ca}`;
        let scan = null;
        if (env.SCAN_KV) {
          scan = await env.SCAN_KV.get(cacheKey, "json");
        }
        // Trending hydration uses ONLY cached scans. Triggering 10
        // fresh scanToken calls per trending request hammers GoPlus
        // and gets us throttled — every check comes back empty. If a
        // CA isn't cached yet, it'll get cached the next time someone
        // legitimately scans it; until then the row just renders
        // without a score.
        return { ...it, scan: scan && isUpstreamOk(scan) ? scan : null };
      } catch (_) {
        return { ...it, scan: null };
      }
    })
  );

  // Filter out tokens we don't have a real symbol for. The
  // hex-derived fallback ($LFDM, $0A43) looks like a fake ticker
  // and makes the homepage look broken. We catch these two ways:
  //   1. The new symbolFallback:true flag (fresh scans)
  //   2. Pattern detection — symbol matches "$" + first-4-hex(ca)
  //      (catches OLD cached entries from before the flag existed)
  const filtered = hydrated.filter((it) => {
    if (!it.scan) return false;
    if (it.scan.symbolFallback) return false;
    const sym = it.scan.symbol || "";
    const evmFallback = "$" + (it.ca || "").slice(2, 6).toUpperCase();
    const solFallback = "$" + (it.ca || "").slice(0, 4).toUpperCase();
    if (sym === evmFallback || sym === solFallback) return false;
    return true;
  });

  const result = { window, items: filtered, generatedAt: Date.now() };

  if (env.SCAN_KV) {
    try {
      // 5-min cache so the homepage carousel doesn't re-aggregate per
      // visitor. Eventually fresh after evictions.
      await env.SCAN_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 300 });
    } catch (_) {}
  }

  return json(result);
}

async function computeTrending(env, windowHours) {
  if (!env.SCAN_KV) return [];

  // 1) Pull the index of recently-active CAs. KV `list` returns up to
  //    1000 keys per call — fine at our scale; we'd paginate later.
  let activeKeys = [];
  try {
    const listed = await env.SCAN_KV.list({ prefix: "evtidx:", limit: 1000 });
    activeKeys = listed.keys.map((k) => k.name);
  } catch (_) {}

  if (!activeKeys.length) return [];

  const nowHour = Math.floor(Date.now() / 3600000);
  const windowStartHour = nowHour - windowHours;

  // 2) For each active CA, sum its scan + watchlist_add bucket counts
  //    across the window. Watchlist-add weighs more than a scan
  //    (intentional save signal > drive-by curiosity).
  const tallies = await Promise.all(
    activeKeys.map(async (idxKey) => {
      try {
        const meta = await env.SCAN_KV.get(idxKey, "json");
        if (!meta || !meta.ca || !meta.chain) return null;
        let scans = 0, saves = 0;
        // Sample the last `windowHours` hourly buckets in parallel.
        const promises = [];
        for (let h = nowHour; h > windowStartHour; h--) {
          promises.push(
            env.SCAN_KV.get(`evt:scan:${meta.chain}:${meta.ca}:${h}`)
              .then((v) => { scans += parseInt(v || "0", 10) || 0; })
          );
          promises.push(
            env.SCAN_KV.get(`evt:watchlist_add:${meta.chain}:${meta.ca}:${h}`)
              .then((v) => { saves += parseInt(v || "0", 10) || 0; })
          );
        }
        await Promise.all(promises);
        const score = scans + 5 * saves; // weight saves heavily
        if (score === 0) return null;
        return { ca: meta.ca, chain: meta.chain, scans, saves, score };
      } catch (_) {
        return null;
      }
    })
  );

  return tallies
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

/* ── NOWPayments IPN signature verification ──
   They HMAC-SHA512 the request body's *sorted* JSON keys (recursively)
   with your IPN secret. Compare hex digest to the x-nowpayments-sig
   header in constant time. */
async function verifyIpnSignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  let parsed;
  try { parsed = JSON.parse(rawBody); } catch (_) { return false; }
  const sortedJson = JSON.stringify(sortObjectKeys(parsed));

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(sortedJson));
  const expected = bufToHex(sigBuf);
  return constantTimeEqualHex(expected, signature.toLowerCase());
}

function sortObjectKeys(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return v;
  const out = {};
  for (const k of Object.keys(v).sort()) out[k] = sortObjectKeys(v[k]);
  return out;
}

function bufToHex(buf) {
  const arr = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < arr.length; i++) {
    s += arr[i].toString(16).padStart(2, "0");
  }
  return s;
}

function constantTimeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
