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
      const { ca, chain, caOriginal, error } = parseCaAndChain(url);
      if (error) return json({ error }, 400);
      if (url.pathname === "/api/scan") {
        // _diag_force_pending=1 bypasses GoPlus to deterministically
        // exercise the PENDING fallback (substitute checks + TWAK
        // security signal). Used during integration to verify the
        // fallback path without waiting for natural GoPlus throttle.
        const forcePending = url.searchParams.get("_diag_force_pending") === "1";
        return handleScan(ca, chain, env, { forcePending, caOriginal });
      }
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
    if (url.pathname === "/api/admin/warm-goplus") {
      // Bootstrap GoPlus cache from a non-Cloudflare IP (GitHub Actions
      // runner / ops machine) — CF Worker IPs are throttled by GoPlus,
      // so the worker can't always populate its own cache. Caller pre-
      // fetches GoPlus data and POSTs it here. We write it to the same
      // KV key fetchGoPlus reads from, so the next scan returns instantly.
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleAdminWarmGoPlus(request, env);
    }
    if (url.pathname === "/api/admin/codes") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleAdminListCodes(request, env);
    }
    if (url.pathname === "/api/admin/publish-receipt") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleAdminPublishReceipt(url, request, env);
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
    if (url.pathname === "/api/square-mention") {
      // Anonymous Square post → classified sentiment aggregated per CA.
      // Posted by the extension's binance-content.js content script.
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleSquareMention(request, env);
    }
    if (url.pathname === "/api/trending") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleTrending(url, env);
    }
    // Debug-only: returns the raw gateway response for a CA so we can
    // verify HMAC signing works + inspect actual response shapes before
    // wiring parsers more deeply. Admin-secret protected — not public.
    if (url.pathname === "/api/twak-test") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleTwakTest(url, request, env);
    }
    // Swap-quote enrichment for the paid-panel Trade row. Read-only —
    // returns expected output amount, price impact, and provider name
    // so the user sees what they'd get before they click through to
    // execute. We never sign or broadcast anything; the actual swap
    // still happens in the user's wallet UI after redirect.
    if (url.pathname === "/api/swap-build") {
      // Builds an EXECUTABLE swap for a real wallet address: route +
      // route/step → ready-to-sign transaction(s). Used by the
      // trustyai.tech/swap page. Unlike /api/swap-quote (display only,
      // DEAD address), this needs the user's connected address because
      // the executable tx data is address-specific.
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleSwapBuild(url, env);
    }
    if (url.pathname === "/api/swap-quote") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleSwapQuote(url, env);
    }
    // Trusty Trader (Beta) — paper-trading simulation. /state is a public
    // KV-only read; /run is an admin-triggered manual cycle for testing.
    if (url.pathname === "/api/sim/state") {
      if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
      return handleSimState(env);
    }
    if (url.pathname === "/api/sim/run") {
      if (request.method !== "GET" && request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleSimRun(url, request, env);
    }

    return json({ error: "not found" }, 404);
  },

  // Cron (see [triggers] in wrangler.toml) drives the paper-trader. Errors
  // are swallowed so a bad cycle never throws out of the scheduled handler.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      Promise.allSettled([
        runSimCycle(env).catch((e) => console.log("sim cycle error:", String((e && e.message) || e))),
        updateScanPeaks(env).catch((e) => console.log("peak update error:", String((e && e.message) || e))),
      ]),
    );
  },
};

// Debug endpoint — protected by ADMIN_SECRET header. Lets the operator
// inspect what TWAK actually returns for known CAs, so parsers can be
// adjusted to match observed field names. Strip after launch if desired.
async function handleTwakTest(url, request, env) {
  const provided = request.headers.get("X-Admin-Secret") || url.searchParams.get("admin");
  if (!env.ADMIN_SECRET || provided !== env.ADMIN_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!twakConfigured(env)) {
    return json({ error: "twak not configured — set TWAK_ACCESS_ID and TWAK_HMAC_SECRET" }, 503);
  }
  const ca = (url.searchParams.get("ca") || "").trim();
  const chain = (url.searchParams.get("chain") || "bsc").trim();
  const assetId = ca ? twakAssetId(chain, ca) : `c${twakChainCoinId(chain) || 714}`;
  if (!assetId) return json({ error: "unsupported chain for twak" }, 400);

  // Isolate WHY all market/asset/search endpoints returned empty for
  // CAKE — by probing known-working docs examples alongside our actual
  // token. If even the exact docs example (ETH native c60 + USDC
  // checksummed) returns empty, our API key has no market access and
  // we need a different data source. If docs examples work but BSC
  // tokens don't, it's case/format/coverage specific to BSC.
  const wrap = (p) => p.status === "fulfilled"
    ? { ok: true, response: p.value }
    : { ok: false, error: String(p.reason?.message || p.reason) };

  // EIP-55 checksum CAKE address for case-sensitivity probe
  const CAKE_CHECKSUM = "c714_t0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
  // The exact USDC asset ID from /v2/market/tickers docs example
  const USDC_ETH_DOCS = "c60_t0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  const [
    coinstatusOurs, assetsOurs, tickersOurs,
    tickersEthNative, tickersBnbNative, tickersUsdcDocs,
    tickersCakeChecksum,
    listingsBnb,
    searchByCaUpper,
  ] = await Promise.allSettled([
    // Our token, current behaviour
    twakGet(`/v2/coinstatus/${assetId}`, { version: "2", include_security_info: "true", include_solana_security_info: "true" }, env),
    twakGet(`/v1/assets`, { assetId }, env),
    twakPost(`/v2/market/tickers`, { currency: "USD", assets: [assetId] }, env),
    // Native chain assets — isolate if BSC works at all vs ETH
    twakPost(`/v2/market/tickers`, { currency: "USD", assets: ["c60"] }, env),
    twakPost(`/v2/market/tickers`, { currency: "USD", assets: ["c714"] }, env),
    // The exact docs example — if THIS returns empty, our key has no market access
    twakPost(`/v2/market/tickers`, { currency: "USD", assets: [USDC_ETH_DOCS] }, env),
    // CAKE with EIP-55 checksum — isolate case sensitivity
    twakPost(`/v2/market/tickers`, { currency: "USD", assets: [CAKE_CHECKSUM] }, env),
    // Listings endpoint — does it work for BSC ecosystem at all
    twakGet(`/v1/assets/listings`, { version: "27", currency: "USD", category_id: "bnb-ecosystem", sort: "mcap", limit: "5" }, env),
    // Search using uppercase CA (some indexes care)
    twakGet(`/v1/search/assets`, { query: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", networks: "714" }, env),
  ]);

  return json({
    assetId, chain,
    note: "If tickersUsdcDocs is empty → API key has no market access. If tickersBnbNative is empty but tickersEthNative isn't → BSC not in our tier. If tickersCakeChecksum has data but tickersOurs doesn't → case sensitivity.",
    coinstatusOurs: wrap(coinstatusOurs),
    assetsOurs: wrap(assetsOurs),
    tickersOurs: wrap(tickersOurs),
    tickersEthNative: wrap(tickersEthNative),
    tickersBnbNative: wrap(tickersBnbNative),
    tickersUsdcDocs: wrap(tickersUsdcDocs),
    tickersCakeChecksum: wrap(tickersCakeChecksum),
    listingsBnb: wrap(listingsBnb),
    searchByCaUpper: wrap(searchByCaUpper),
  });
}

// Admin-protected probe of arbitrary upstream paths. Used during
// initial TWAK integration to learn the actual response shapes and
// valid IDs. Remove or restrict further before launch.
// Chain key → upstream amber-api domain ID. Discovered empirically
// from GET /amber-api/v1/domains — the upstream uses string slugs
// (e.g. "smartchain" for BNB), not numeric EVM chain IDs.
function swapDomainForChain(chain) {
  const c = (chain || "").toLowerCase();
  if (c === "bsc" || c === "bnb" || c === "binance" || c === "evm") return "smartchain";
  if (c === "eth" || c === "ethereum") return "ethereum";
  if (c === "base") return "base";
  if (c === "polygon" || c === "matic") return "polygon";
  if (c === "arbitrum" || c === "arb") return "arbitrum";
  if (c === "optimism" || c === "op") return "optimism";
  if (c === "avalanche" || c === "avax") return "avalanche";
  return null;
}

// Returns a display-friendly swap quote. Read-only — no signing, no
// broadcast. We use the DEAD address as `fromAddress` since we don't
// hold user wallets; the upstream just needs a syntactically-valid
// EVM address to compute a route. If the upstream rejects DEAD we
// degrade silently — the existing Trade button still works without
// the quote enrichment.
async function handleSwapQuote(url, env) {
  const chain = (url.searchParams.get("chain") || "bsc").trim();
  const ca = (url.searchParams.get("ca") || "").trim().toLowerCase();
  const slippage = (url.searchParams.get("slippage") || "1").trim();
  const amountIn = (url.searchParams.get("amount") || "").trim();

  if (!twakConfigured(env)) return json({ ok: false, error: "quote unavailable" }, 503);
  if (!isValidCa(ca, chain)) return json({ ok: false, error: "invalid ca" }, 400);

  const domain = swapDomainForChain(chain);
  if (!domain) return json({ ok: false, error: "unsupported chain" }, 400);

  // Default to 0.1 of native (1e17 wei) so we get a meaningful quote
  // even when the extension doesn't pass an amount. Users see this as
  // an indicative rate; they choose their own amount in their wallet.
  const amount = amountIn || "100000000000000000";

  // Native EVM marker per upstream conventions (per swap-quote.md).
  const NATIVE_EVM = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

  // KV cache 30s — quotes go stale fast, but caching deduplicates when
  // multiple users open the same paid panel and protects the 1 req/s
  // quota under load.
  const cacheKey = `swap-q:v1:${chain}:${ca}:${amount}:${slippage}`;
  if (env.SCAN_KV) {
    try {
      const cached = await env.SCAN_KV.get(cacheKey, "json");
      if (cached) return json(cached);
    } catch (_) {}
  }

  try {
    const data = await twakPost("/amber-api/v1/route", {
      fromAsset: NATIVE_EVM,
      toAsset: ca,
      fromAddress: DEAD,
      toAddress: DEAD,
      fromDomain: domain,
      toDomain: domain,
      amount: amount,
      slippage: slippage,
      contractCall: false,
      sortBy: "outcome",
    }, env);

    const route = data?.routes?.[0] || null;
    if (!route || !Array.isArray(route.steps) || !route.steps.length) {
      const out = { ok: false, error: "no route" };
      return json(out);
    }

    const last = route.steps[route.steps.length - 1];
    const first = route.steps[0];
    let totalImpact = 0;
    for (const s of route.steps) {
      const imp = parseFloat(s.priceImpact || 0);
      if (!isNaN(imp)) totalImpact += imp;
    }

    const out = {
      ok: true,
      chain: chain,
      ca: ca,
      fromAmount: amount,
      toAmount: last?.to?.amount || null,
      minOut: last?.to?.minAmountOut || null,
      priceImpactPct: totalImpact,
      provider: first?.provider?.name || first?.provider?.id || null,
      slippage: slippage,
      expiresAt: route.expirationDate || null,
      steps: route.steps.length,
    };

    if (env.SCAN_KV) {
      try {
        await env.SCAN_KV.put(cacheKey, JSON.stringify(out), { expirationTtl: 30 });
      } catch (_) {}
    }
    return json(out);
  } catch (e) {
    // 200 + ok:false rather than 502: from the caller's POV the
    // worker did its job (asked the upstream, got "no route" or
    // "unsupported asset"). 502 falsely implies our gateway is
    // broken and creates noisy red errors in browser consoles +
    // Cloudflare monitoring for what's really a normal "this token
    // isn't indexed by TWAK's swap router" case.
    return json({ ok: false, error: String(e && e.message || e) });
  }
}

// Builds an executable native-BNB→token swap for a specific wallet.
// Calls /amber-api/v1/route with the user's real fromAddress (the
// executable tx is address-specific), then /amber-api/v1/route/step
// for each step to get the ready-to-sign evmTx. Returns the quote +
// the transaction(s) the page signs via the wallet. NOT cached —
// executable tx data is per-address/amount and must be fresh.
//
// For native BNB → token there's no ERC-20 approval (approvals only
// apply to spending tokens), so `approve` is typically null and we
// return a single swap tx.
async function handleSwapBuild(url, env) {
  const chain = (url.searchParams.get("chain") || "bsc").trim();
  const ca = (url.searchParams.get("ca") || "").trim().toLowerCase();
  const slippage = (url.searchParams.get("slippage") || "1").trim();
  const amount = (url.searchParams.get("amount") || "").trim();
  const from = (url.searchParams.get("from") || "").trim();

  if (!twakConfigured(env)) return json({ ok: false, error: "swap unavailable" }, 503);
  if (!isValidCa(ca, chain)) return json({ ok: false, error: "invalid ca" }, 400);
  if (!/^0x[a-fA-F0-9]{40}$/.test(from)) return json({ ok: false, error: "invalid from address" }, 400);
  if (!/^\d+$/.test(amount) || amount === "0") return json({ ok: false, error: "invalid amount" }, 400);

  const domain = swapDomainForChain(chain);
  if (!domain) return json({ ok: false, error: "unsupported chain" }, 400);

  const NATIVE_EVM = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

  try {
    const routeData = await twakPost("/amber-api/v1/route", {
      fromAsset: NATIVE_EVM,
      toAsset: ca,
      fromAddress: from,
      toAddress: from,
      fromDomain: domain,
      toDomain: domain,
      amount: amount,
      slippage: slippage,
      contractCall: false,
      sortBy: "outcome",
    }, env);

    const route = routeData?.routes?.[0] || null;
    if (!route || !Array.isArray(route.steps) || !route.steps.length) {
      return json({ ok: false, error: "no route" });
    }

    const first = route.steps[0];
    const last = route.steps[route.steps.length - 1];
    let totalImpact = 0;
    for (const s of route.steps) {
      const imp = parseFloat(s.priceImpact || 0);
      if (!isNaN(imp)) totalImpact += imp;
    }

    // Fetch the executable tx for each step. Sequential to respect the
    // 1 req/s TWAK quota. For a simple BNB→token swap this is one step.
    const transactions = [];
    let approve = null;
    for (const step of route.steps) {
      const stepData = await twakPost("/amber-api/v1/route/step", { stepId: step.id }, env);
      const evmTx = stepData?.transaction?.evmTx || null;
      if (evmTx && evmTx.to && evmTx.data) {
        transactions.push({
          to: evmTx.to,
          value: evmTx.value || "0",
          data: evmTx.data,
          gasLimit: evmTx.gasLimit || null,
        });
      }
      if (stepData?.approve) approve = stepData.approve;
    }

    if (!transactions.length) return json({ ok: false, error: "no executable tx" });

    return json({
      ok: true,
      chain, ca,
      fromAmount: amount,
      toAmount: last?.to?.amount || null,
      minOut: last?.to?.minAmountOut || null,
      priceImpactPct: totalImpact,
      provider: first?.provider?.name || first?.provider?.id || null,
      slippage,
      approve,
      transactions,
    });
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) });
  }
}

/* ================================================================
   Trusty Trader (Beta) — paper-trading simulation

   A virtual portfolio that trades BSC memecoins on Trusty's own
   signals. NO real funds, NO wallet, NO on-chain tx — it records
   what it WOULD have done at real market prices, so the strategy can
   be validated before any real capital is risked.

   Discovery: Trust Wallet listings API (BSC memes, ranked by volume)
   Entry:     Trusty scan verdict = APE  AND  social confirmation
              (X tweets/24h > 0  OR  Binance Square mentions > 0)
   Exit:      +50% TP · -30% SL · 48h timeout · or verdict flips to RUN
   Sizing:    $1,000 start · $100 (10%) per trade · ~10 positions
   Costs:     2% slippage + $0.30 gas each side (so P&L is honest)
   Engine:    cron every 10 min (scheduled handler) → runSimCycle
   Storage:   KV (SCAN_KV) — keys sim:state, sim:closed, sim:equity

   NOTE on asset IDs: we never construct the TW asset_id ourselves
   (BSC tokens use the c20000714_t… prefix on /v2/market/tickers, not
   c714_t…). Instead we store the asset_id the listings API returns and
   pass it back verbatim for price marking — self-consistent, no prefix
   guessing.
   ================================================================ */

const SIM = {
  START_CASH: 1000,
  POSITION_USD: 100, // 10% of start, fixed notional → ~10 positions
  TAKE_PROFIT: 0.5,
  STOP_LOSS: -0.3,
  MAX_HOLD_MS: 48 * 3600 * 1000,
  SLIPPAGE: 0.02,
  GAS_USD: 0.3,
  MAX_NEW_PER_CYCLE: 3, // bound entries (and Sorsa/scan load) per run
  EVAL_CAP: 12, // max candidates scanned per cycle, to be gentle on GoPlus
  DISCOVERY_LIMIT: 50,
  BSC_COIN_ID: 20000714, // TW internal network id for BSC (NOT SLIP-44 714)
  EQUITY_MIN_GAP_MS: 60 * 60 * 1000, // append an equity snapshot at most hourly
};

function simRound(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function simLoadState(env) {
  let st = null;
  try {
    st = await env.SCAN_KV.get("sim:state", "json");
  } catch (_) {}
  if (!st || typeof st.cash !== "number") {
    st = { startedAt: Date.now(), cash: SIM.START_CASH, equity: SIM.START_CASH, positions: [], updatedAt: Date.now() };
  }
  if (!Array.isArray(st.positions)) st.positions = [];
  return st;
}

async function simSave(env, st, closed, equity) {
  st.updatedAt = Date.now();
  const ops = [env.SCAN_KV.put("sim:state", JSON.stringify(st))];
  if (closed) ops.push(env.SCAN_KV.put("sim:closed", JSON.stringify(closed.slice(0, 200))));
  if (equity) ops.push(env.SCAN_KV.put("sim:equity", JSON.stringify(equity.slice(-500))));
  await Promise.allSettled(ops);
}

// Discovery: top BSC meme coins by 24h volume, via the TW listings API.
async function simDiscover(env) {
  let data = null;
  try {
    data = await twakGet(
      "/v1/assets/listings",
      {
        version: 27,
        currency: "USD",
        category_id: "memes",
        sort: "volume",
        networks: String(SIM.BSC_COIN_ID),
        limit: SIM.DISCOVERY_LIMIT,
      },
      env,
    );
  } catch (e) {
    console.log("simDiscover error:", String((e && e.message) || e));
    return [];
  }
  const docs = (data && data.docs) || [];
  const out = [];
  for (const d of docs) {
    const a = d.asset || {};
    const id = a.asset_id || "";
    // Identify an EVM token purely by the asset_id's `_t<address>` form
    // (don't filter on a.type — BSC tokens report type "BEP20", not
    // "token"). This also naturally excludes natives (e.g. "c714"). We
    // rely on the `networks` query filter to scope to BSC.
    const m = id.match(/_t(0x[a-fA-F0-9]{40})/);
    if (!m) continue;
    out.push({
      ca: m[1].toLowerCase(),
      assetId: id,
      symbol: (a.symbol || "").replace(/^\$/, ""),
      volume24h: (d.market && d.market.volume_24h) || 0,
    });
  }
  return out;
}

// Bulk USD price marking via /v2/market/tickers (≤50 ids per call). Keyed
// by the same asset_id the listings API gave us.
async function simMarkPrices(assetIds, env) {
  const prices = {};
  const uniq = [...new Set(assetIds.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 50) {
    const batch = uniq.slice(i, i + 50);
    try {
      const r = await twakPost("/v2/market/tickers", { currency: "USD", assets: batch }, env);
      for (const t of (r && r.tickers) || []) {
        if (t && t.id && typeof t.price === "number") prices[t.id] = t.price;
      }
    } catch (_) {}
  }
  return prices;
}

// Trusty's own safety verdict (reuses the 5-min scan cache).
async function simScan(ca, env) {
  try {
    return await handleScan(ca, "bsc", env, {}).then((r) => r.json());
  } catch (_) {
    return null;
  }
}

// Social confirmation: any X velocity OR any Binance Square mentions.
async function simSocialOk(ca, symbol, env) {
  try {
    const k = await handleKols(ca, "bsc", env, symbol).then((r) => r.json());
    const tweets = (k && k.activity && k.activity.tweets24h) || 0;
    const sq = (k && k.squareActivity && k.squareActivity.mentions7d) || 0;
    return tweets > 0 || sq > 0;
  } catch (_) {
    return false;
  }
}

// One engine cycle: mark/exit open positions, then discover + enter.
async function runSimCycle(env) {
  if (!env.SCAN_KV || !twakConfigured(env)) return { ok: false, error: "not configured" };
  const st = await simLoadState(env);
  let closed = (await env.SCAN_KV.get("sim:closed", "json")) || [];
  let equity = (await env.SCAN_KV.get("sim:equity", "json")) || [];
  const now = Date.now();

  // 1) Mark + manage existing positions.
  const openPrices = await simMarkPrices(st.positions.map((p) => p.assetId), env);
  const survivors = [];
  for (const p of st.positions) {
    const px = openPrices[p.assetId];
    if (typeof px !== "number" || px <= 0) {
      survivors.push(p); // can't price right now → hold
      continue;
    }
    const pnlPct = (px - p.entryPrice) / p.entryPrice;
    let reason = null;
    if (pnlPct >= SIM.TAKE_PROFIT) reason = "take-profit";
    else if (pnlPct <= SIM.STOP_LOSS) reason = "stop-loss";
    else if (now - p.entryAt >= SIM.MAX_HOLD_MS) reason = "timeout";
    else {
      const s = await simScan(p.ca, env);
      if (s && String(s.verdict).toUpperCase() === "RUN") reason = "verdict-RUN";
    }
    if (!reason) {
      survivors.push(p);
      continue;
    }
    // Exit: proceeds net of slippage + gas. P&L vs the $100 we committed.
    const proceeds = p.tokenQty * px * (1 - SIM.SLIPPAGE) - SIM.GAS_USD;
    st.cash += proceeds;
    const pnlUsd = proceeds - SIM.POSITION_USD;
    closed.unshift({
      ca: p.ca,
      symbol: p.symbol,
      entryPrice: p.entryPrice,
      exitPrice: px,
      entryAt: p.entryAt,
      exitAt: now,
      pnlUsd: simRound(pnlUsd),
      pnlPct: simRound((pnlUsd / SIM.POSITION_USD) * 100),
      reason,
    });
  }
  st.positions = survivors;

  // 2) Discover + enter (bounded by cash, MAX_NEW_PER_CYCLE, EVAL_CAP).
  let added = 0;
  let evaluated = 0;
  const candPrices = {};
  if (st.cash >= SIM.POSITION_USD) {
    const held = new Set(st.positions.map((p) => p.ca));
    const candidates = await simDiscover(env);
    // Price all candidates once up front (one batched call).
    Object.assign(candPrices, await simMarkPrices(candidates.map((c) => c.assetId), env));
    for (const c of candidates) {
      if (added >= SIM.MAX_NEW_PER_CYCLE || evaluated >= SIM.EVAL_CAP) break;
      if (st.cash < SIM.POSITION_USD) break;
      if (held.has(c.ca)) continue;
      const entryPrice = candPrices[c.assetId];
      if (typeof entryPrice !== "number" || entryPrice <= 0) continue;
      evaluated++;
      const s = await simScan(c.ca, env);
      if (!s || String(s.verdict).toUpperCase() !== "APE") continue;
      if (!(await simSocialOk(c.ca, c.symbol || s.symbol || "", env))) continue;
      // Buy $100 notional; friction (slippage + gas) reduces tokens received.
      const effUsd = SIM.POSITION_USD * (1 - SIM.SLIPPAGE) - SIM.GAS_USD;
      st.cash -= SIM.POSITION_USD;
      st.positions.push({
        ca: c.ca,
        assetId: c.assetId,
        symbol: c.symbol || s.symbol || "",
        entryPrice,
        tokenQty: effUsd / entryPrice,
        entryAt: now,
        score: typeof s.score === "number" ? s.score : null,
        lastPrice: entryPrice,
        lastPnlPct: 0,
      });
      held.add(c.ca);
      added++;
    }
  }

  // 3) Recompute equity from a merged price map (survivors priced in step 1,
  // new entries in step 2 — no extra TW call). Stamp each position's last
  // mark so the viewer shows unrealized P&L without hitting the quota.
  const allPrices = Object.assign({}, openPrices, candPrices);
  let posValue = 0;
  for (const p of st.positions) {
    const px = typeof allPrices[p.assetId] === "number" ? allPrices[p.assetId] : p.entryPrice;
    p.lastPrice = px;
    p.lastPnlPct = simRound(((px - p.entryPrice) / p.entryPrice) * 100);
    posValue += p.tokenQty * px;
  }
  st.equity = st.cash + posValue;
  const last = equity[equity.length - 1];
  if (!last || now - last.t >= SIM.EQUITY_MIN_GAP_MS) equity.push({ t: now, equity: simRound(st.equity) });

  await simSave(env, st, closed, equity);
  return { ok: true, equity: simRound(st.equity), cash: simRound(st.cash), open: st.positions.length, added, closedTotal: closed.length };
}

// GET /api/sim/state — public, KV-only read of the current paper portfolio.
async function handleSimState(env) {
  if (!env.SCAN_KV) return json({ ok: false, error: "kv unavailable" }, 503);
  const st = (await env.SCAN_KV.get("sim:state", "json")) || {
    cash: SIM.START_CASH,
    equity: SIM.START_CASH,
    positions: [],
    startedAt: null,
  };
  const closed = (await env.SCAN_KV.get("sim:closed", "json")) || [];
  const equity = (await env.SCAN_KV.get("sim:equity", "json")) || [];
  const wins = closed.filter((t) => t.pnlUsd > 0).length;
  const eq = typeof st.equity === "number" ? st.equity : st.cash;
  return json({
    ok: true,
    startedAt: st.startedAt || null,
    updatedAt: st.updatedAt || null,
    startCash: SIM.START_CASH,
    cash: simRound(st.cash),
    equity: simRound(eq),
    roiPct: simRound(((eq - SIM.START_CASH) / SIM.START_CASH) * 100),
    open: st.positions || [],
    openCount: (st.positions || []).length,
    closed: closed.slice(0, 50),
    closedCount: closed.length,
    winRatePct: closed.length ? simRound((wins / closed.length) * 100) : null,
    equityCurve: equity,
    config: {
      positionUsd: SIM.POSITION_USD,
      takeProfitPct: SIM.TAKE_PROFIT * 100,
      stopLossPct: SIM.STOP_LOSS * 100,
      maxHoldHours: SIM.MAX_HOLD_MS / 3600000,
    },
  });
}

// GET/POST /api/sim/run?admin=… — manual cycle trigger for testing.
async function handleSimRun(url, request, env) {
  const provided = request.headers.get("X-Admin-Secret") || url.searchParams.get("admin");
  if (!env.ADMIN_SECRET || provided !== env.ADMIN_SECRET) return json({ error: "unauthorized" }, 401);
  try {
    return json(await runSimCycle(env));
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e) }, 500);
  }
}

/* ================================================================
   Narrative classifier (server-side, free — no LLM)

   Maps a scanned token to a meta/narrative + our flavored playbook.
   Returned as `narrative` on /api/scan so the extension just renders
   it (and we can tune narratives by redeploying the worker — no
   extension re-upload, works for any client version that reads it).

   Tiers (cheapest first):
     1. seed-token exact match
     2. CJK characters in symbol/name → Chinese
     3. keyword regex over symbol + name + DESCRIPTION (priority order)
   Description comes from CoinGecko → GeckoTerminal (free, cached 30d).
   Unmatched returns null (we show nothing rather than guess). The
   description fetch only happens when steps 1–2 + name-only keywords
   miss, so most tokens cost zero network.
   ================================================================ */
const NARRATIVES = {
  political: { id: "political", name: "Political Meta", subtitle: "The Event Trader", emoji: "🇺🇸", risk: "EXTREME", riskColor: "red", avgReturn: "1,000–50,000%", rugRate: "Very High (~70%)", lifespan: "Hours", bestEntry: "Before the event peaks", kw: "trump|biden|maga|melania|kamala|harris|election|politifi|obama|potus", tokens: ["TRUMP","MELANIA","BODEN","MAGA"], whenToApe: "Only BEFORE the political event, hours ahead of mainstream coverage, tiny size.", whenToAvoid: "After the event peaks. Any 'official endorsement' claim is a lie.", keySignal: "Google Trends spike on the political term + Polymarket activity." },
  elon: { id: "elon", name: "Elon Meta", subtitle: "The Tweet Trigger", emoji: "🚀", risk: "HIGH", riskColor: "red", avgReturn: "500–20,000%", rugRate: "High (~55%)", lifespan: "Hours–Days", bestEntry: "Minutes after an Elon post", kw: "elon|musk|tesla|grok|starlink|neuralink|spacex|mars|doge ?to ?the", tokens: ["GROK","KEKIUS","MARS"], whenToApe: "Right after Elon posts a word/image/meme — find the token spun from it before CT piles in. Speed is everything.", whenToAvoid: "Hours after the tweet when 20 copies exist. Anything claiming Elon 'endorsed' it.", keySignal: "@elonmusk post → matching ticker minting within minutes." },
  cz: { id: "cz", name: "CZ Meta", subtitle: "The BNB Season", emoji: "🟡", risk: "MED-HIGH", riskColor: "orange", avgReturn: "200–5,000%", rugRate: "Med-High (~45%)", lifespan: "Days–Weeks", bestEntry: "CZ tweet/post", kw: "\\bcz\\b|binance.?coin|bnb.?season|giggle|changpeng", tokens: ["GIGGLE","4","PAUL","SZN","PUP"], whenToApe: "CZ mentions a project/cause/number — find the BNB token tied to it before Binance makes it official.", whenToAvoid: "Coins claiming to be 'official CZ/Binance' — they never are. The clarification post is a sell signal.", keySignal: "Follow @cz_binance. BNB DEX volume spikes with no obvious cause = CZ season." },
  ai: { id: "ai", name: "AI Agents", subtitle: "The 2024/25 Wave", emoji: "🤖", risk: "MED", riskColor: "yellow", avgReturn: "1,000–10,000%", rugRate: "Med (~35%)", lifespan: "Weeks–Months", bestEntry: "New AI product launch", kw: "\\bai\\d?\\b|agent|gpt|llm|neural|autonomous|zerebro|virtuals?", tokens: ["GOAT","AI16Z","ZEREBRO","GRIFFAIN","FARTCOIN","VIRTUAL"], whenToApe: "AI projects with verifiable autonomous activity — real posts/txs from the agent. Early, before Binance lists.", whenToAvoid: "Generic memes with 'AI' tacked on. After the first wave — GOAT lost 70%+ from ATH.", keySignal: "Is the AI actually doing things? Real output = the narrative has legs." },
  brainrot: { id: "brainrot", name: "Brainrot Meta", subtitle: "The Gen-Z Absurd", emoji: "🧠", risk: "HIGH", riskColor: "red", avgReturn: "5,000–50,000%", rugRate: "High (~65%)", lifespan: "Hours–Days", bestEntry: "While the sound/phrase peaks on TikTok", kw: "skibidi|gyatt|sigma|rizz|fanum|brainrot|ohio|mewing|\\btung\\b|aura", tokens: ["SKIBIDI","TUNG","GYATT","SIGMA"], whenToApe: "An absurdist sound/phrase is everywhere on TikTok/Reels but barely tokenized. Pure attention play, tiny size.", whenToAvoid: "After 5 copycats of the same term exist, or once it hits crypto press — the move's done.", keySignal: "TikTok sound velocity. If your teenage cousin knows it, you're late." },
  knockoffs: { id: "knockoffs", name: "Knockoff Legends", subtitle: "The Copycat", emoji: "🃏", risk: "HIGH", riskColor: "red", avgReturn: "200–3,000%", rugRate: "High (~60%)", lifespan: "Hours–Days", bestEntry: "When the original is too expensive to entry", kw: "baby ?|\\bv2\\b|2\\.0|wrapped|clone|knockoff|\\bjr\\b|mini ?", tokens: [], whenToApe: "A blue-chip meme just ran and is 'too expensive' — the derivative catches the overflow on day one only.", whenToAvoid: "Day 2+. Knockoffs decay fast; the original almost always outlives them.", keySignal: "Parent token pumped 5x+ and is trending — the knockoff rides the spillover for hours." },
  celebrity: { id: "celebrity", name: "Celebrity Meta", subtitle: "The Influencer Play", emoji: "⭐", risk: "EXTREME", riskColor: "red", avgReturn: "500–30,000%", rugRate: "Very High (~70%)", lifespan: "Hours–Days", bestEntry: "At the moment of the launch/announcement", kw: "celebrity|influencer|\\bjake\\b|kardashian|drake|ronaldo|messi|caitlyn|hawk ?tuah|\\bhaliey\\b", tokens: ["HAWK","JENNER"], whenToApe: "A genuine celebrity launch with locked LP, in the first minutes. Treat as a pure pump-and-dump you exit fast.", whenToAvoid: "After the celebrity goes quiet or deletes posts. 'Official' coins with no LP lock.", keySignal: "Verified celeb posts the CA themselves + LP burned/locked." },
  "internet-animals": { id: "internet-animals", name: "Internet Animals", subtitle: "The Viral Critter", emoji: "🐾", risk: "HIGH", riskColor: "red", avgReturn: "1,000–40,000%", rugRate: "High (~55%)", lifespan: "Days–Weeks", bestEntry: "As the animal goes viral on normie platforms", kw: "moodeng|pesto|capybara|hippo|quokka|\\bowl\\b|raccoon|otter|seal|penguin", tokens: ["MOODENG","PESTO","PNUT"], whenToApe: "A real animal (zoo/wild) is going viral on TikTok/news but isn't fully tokenized. Cross-platform virality.", whenToAvoid: "After mainstream press; once the animal story fades the chart follows.", keySignal: "Same critter trending on TikTok + news + X at once." },
  tiktok: { id: "tiktok", name: "TikTok Meta", subtitle: "The Normie Pipeline", emoji: "📱", risk: "HIGH", riskColor: "red", avgReturn: "5,000–80,000%", rugRate: "High (~60%)", lifespan: "Hours–Days", bestEntry: "Before crypto press", kw: "tiktok|viral|chill ?guy|\\bpunch\\b|trend", tokens: ["CHILLGUY","PUNCH"], whenToApe: "After a social explosion but BEFORE crypto press. Everywhere on TikTok but not yet on CoinDesk = the window.", whenToAvoid: "After a Binance/Coinbase listing announce. Tiny LP on a big mcap = brutal exits.", keySignal: "Same meme trending on TikTok + X + Reddit simultaneously." },
  dogs: { id: "dogs", name: "Dog Meta", subtitle: "The OG", emoji: "🐶", risk: "LOW", riskColor: "green", avgReturn: "300–1,000%", rugRate: "Low (~15%)", lifespan: "Months–Years", bestEntry: "Early bull cycle", kw: "\\bdog|doge|\\binu\\b|shib|puppy|woof|bonk", tokens: ["DOGE","SHIB","WIF","BONK","FLOKI","NEIRO"], whenToApe: "Early in a bull cycle before DOGE 3x's. When Elon tweets. New dogs with LP burned + active community.", whenToAvoid: "After DOGE pumped 3x+. Bear markets. Copy-cat dogs with no identity.", keySignal: "DOGE volume spikes 10x+. Small dogs (BONK, WIF) often run first." },
  cats: { id: "cats", name: "Cat Meta", subtitle: "The Challenger", emoji: "🐱", risk: "MED", riskColor: "yellow", avgReturn: "500–5,000%", rugRate: "Med (~30%)", lifespan: "Weeks–Months", bestEntry: "After dogs pump", kw: "\\bcat\\b|kitty|popcat|michi|meow|\\bmew\\b", tokens: ["POPCAT","MOG","MEW","MICHI"], whenToApe: "After the dog meta has run 2-4 weeks. Cats lagging while dogs pump = your entry.", whenToAvoid: "First mover in a new cat launch. Cats with no cultural origin.", keySignal: "POPCAT/DOGE ratio. Cats lagging dogs by 2+ weeks in a bull run = rotation incoming." },
  mascot: { id: "mascot", name: "Mascot Meta", subtitle: "The Stickiest", emoji: "🎭", risk: "LOW", riskColor: "green", avgReturn: "200–2,000%", rugRate: "Low (~20%)", lifespan: "Months–Years", bestEntry: "When the meme goes viral", kw: "pepe|frog|brett|wojak|\\bchad\\b|andy|trusty|mascot|character", tokens: ["PEPE","BRETT","ANDY","TRUSTY"], whenToApe: "Character existed BEFORE the coin. Organic fan art + merch appearing without the team pushing.", whenToAvoid: "AI-generated mascots with no history. PEPE clones. Just a logo with no lore.", keySignal: "Search the character outside crypto. Real-world merch = real cultural weight." },
};

// Match order — most specific narratives first so generic ones don't
// swallow them (e.g. an "AI dog" resolves to AI, not Dog).
const NARRATIVE_ORDER = ["political", "elon", "cz", "ai", "brainrot", "knockoffs", "celebrity", "internet-animals", "tiktok", "dogs", "cats", "mascot"];

// CJK (Chinese/Japanese) characters — strong signal for the Chinese meta.
function hasCJK(s) { return /[㐀-鿿豈-﫿]/.test(s || ""); }

// Pure-rules classification. `description` optional (only passed on the
// second pass once we've fetched it). Returns a narrative object or null.
function classifyNarrative(symbol, name, description) {
  const sym = String(symbol || "").toUpperCase().replace(/^\$/, "").trim();
  // 1. seed-token exact match
  for (const k of NARRATIVE_ORDER) {
    if (NARRATIVES[k].tokens.includes(sym)) return NARRATIVES[k];
  }
  // 2. CJK → Chinese (the one bucket the DBs can't give us)
  if (hasCJK(symbol) || hasCJK(name)) return CHINESE_NARRATIVE;
  // 3. keyword regex over symbol + name + description
  const hay = (String(symbol || "") + " " + String(name || "") + " " + String(description || "")).toLowerCase();
  for (const k of NARRATIVE_ORDER) {
    try {
      if (new RegExp(NARRATIVES[k].kw, "i").test(hay)) return NARRATIVES[k];
    } catch (_) {}
  }
  return null;
}

const CHINESE_NARRATIVE = { id: "chinese", name: "Chinese Meta", subtitle: "The Asia Pump", emoji: "🀄", risk: "MED-HIGH", riskColor: "orange", avgReturn: "300–8,000%", rugRate: "Med-High (~45%)", lifespan: "Days–Weeks", bestEntry: "Asia hours / Square-CN buzz", tokens: [], whenToApe: "Buzzing in Chinese circles (Binance Square CN, WeChat) before Western CT notices. Asia session (00–08 UTC) volume spikes are the tell.", whenToAvoid: "Western-made 'China'-themed coins with no real CN community. After Western CT has posted it.", keySignal: "Chinese-character ticker + organic CN holders + Asia-hours volume." };

// Free token description from CoinGecko → GeckoTerminal. Cached 30d
// (descriptions are effectively static). Returns "" if neither has it.
async function fetchTokenDescription(ca, chain, env) {
  const cacheKey = `narr-desc:v1:${chain}:${ca}`;
  if (env.SCAN_KV) {
    try {
      const cached = await env.SCAN_KV.get(cacheKey);
      if (cached !== null) return cached;
    } catch (_) {}
  }
  const cgPlatform = chain === "ethereum" ? "ethereum" : chain === "base" ? "base"
    : chain === "polygon" ? "polygon-pos" : chain === "solana" ? "solana" : "binance-smart-chain";
  const gtNet = chain === "ethereum" ? "eth" : chain === "base" ? "base"
    : chain === "polygon" ? "polygon_pos" : chain === "solana" ? "solana" : "bsc";
  let desc = "";
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${cgPlatform}/contract/${ca}`, { headers: { accept: "application/json" } });
    if (r.ok) {
      const d = await r.json();
      desc = (d && d.description && d.description.en) || "";
    }
  } catch (_) {}
  if (!desc) {
    try {
      const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/${gtNet}/tokens/${ca}/info`, { headers: { accept: "application/json" } });
      if (r.ok) {
        const d = await r.json();
        desc = (d && d.data && d.data.attributes && d.data.attributes.description) || "";
      }
    } catch (_) {}
  }
  desc = String(desc).slice(0, 600);
  if (env.SCAN_KV) {
    try { await env.SCAN_KV.put(cacheKey, desc, { expirationTtl: 30 * 24 * 60 * 60 }); } catch (_) {}
  }
  return desc;
}

// Orchestrates: free name/seed/CJK pass first; only if that misses do we
// fetch a description and try keywords against it. Returns the narrative
// object (for the client to render) or null.
async function resolveNarrative(symbol, name, ca, chain, env) {
  let n = classifyNarrative(symbol, name, "");
  if (n) return n;
  const desc = await fetchTokenDescription(ca, chain, env);
  if (!desc) return null;
  return classifyNarrative(symbol, name, desc);
}

function parseCaAndChain(url) {
  const rawCa = (url.searchParams.get("ca") || "").trim();
  const chain = (url.searchParams.get("chain") || "bsc").toLowerCase();
  const isSolanaChain = chain === "solana" || chain === "sol";
  // CAs are case-sensitive on Solana, case-insensitive on EVM. We
  // lowercase EVM for cache stability; preserve case for Solana.
  const ca = isSolanaChain ? rawCa : rawCa.toLowerCase();
  if (!isValidCa(ca, chain)) return { error: "invalid ca" };
  // caOriginal: case-preserved for APIs that require EIP-55 checksum
  // (e.g. TWAK security lookup). Falls back to `ca` when caller didn't
  // pass a checksummed form.
  return { ca, chain, caOriginal: rawCa };
}

/* ── /api/scan ── token security + market data, 5min cache ── */
async function handleScan(ca, chain, env, opts) {
  const forcePending = !!(opts && opts.forcePending);
  // v2: invalidates pre-2026-05-09 cached scans so the new
  // liveness-penalty scoring (volume/liquidity/holders/age) takes
  // effect on every token immediately. Old cached entries had
  // dead tokens at 85/100; the v2 prefix flushes those.
  const cacheKey = `scan:v2:${chain}:${ca}`;
  // Skip cache when force-pending — we always want a fresh PENDING
  // path execution so the operator sees current TWAK behaviour.
  if (env.SCAN_KV && !forcePending) {
    const cached = await env.SCAN_KV.get(cacheKey, "json");
    if (cached) return json(cached);
  }

  const result = await scanToken(ca, chain, env, opts);

  // Server-side narrative classification (free: CJK + seed + keyword on
  // name/description). Attached here so both EVM + Solana paths get it.
  // Best-effort — never block or break a scan.
  try {
    result.narrative = await resolveNarrative(result.symbol, result.name, ca, chain, env);
  } catch (_) {
    result.narrative = null;
  }

  // Maintain a symbol → CA index so Square ticker mentions ($SYMBOL,
  // #symbol) can resolve to the right token. Fire-and-forget; never
  // blocks the scan response. Skips fallback/hex symbols.
  if (result && result.symbol && !result.symbolFallback) {
    try {
      await writeSymref(result.chain || chain, ca, result.symbol, env);
    } catch (_) {}
  }

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
  let result = null;
  if (env.SCAN_KV) {
    result = await env.SCAN_KV.get(cacheKey, "json");
  }

  if (!result) {
    result = await fetchKols(ca, chain, env, symbol);
    if (env.SCAN_KV) {
      try {
        await env.SCAN_KV.put(cacheKey, JSON.stringify(result), {
          expirationTtl: 21600, // 6 hours
        });
      } catch (_) {}
    }
  }

  // Square activity is read fresh on every call (not cached with KOLs)
  // because Square mention counts change faster than X velocity does.
  // The cost is one extra KV read per /api/kols call — negligible.
  // Symbol is passed through so the read can fall back to a server-
  // side scrape of Binance Square's hashtag page when our user-
  // reported aggregate is empty.
  result.squareActivity = await readSquareActivity(ca, chain, env, symbol || result.symbol);

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

// ═══════════════════════════════════════════════════════════════════
// Secondary signal provider — HMAC-SHA256 signed requests to a
// third-party crypto data gateway. Used only as a fallback when our
// primary sources (GoPlus, Dexscreener) rate-limit or return empty.
// Free tier is 1 req/s, so we never call from the hot path — only
// when something else has already failed.
//
// Set TWAK_ACCESS_ID + TWAK_HMAC_SECRET as Worker secrets to enable:
//   npx wrangler secret put TWAK_ACCESS_ID  --config api/wrangler.toml
//   npx wrangler secret put TWAK_HMAC_SECRET --config api/wrangler.toml
//
// When the secrets are absent the entire integration short-circuits
// to null, so the worker keeps working exactly as before.
// ═══════════════════════════════════════════════════════════════════
const TWAK_BASE = "https://tws.trustwallet.com";
const TWAK_CACHE_TTL = 24 * 60 * 60; // 24h — security flags are immutable per CA

function twakConfigured(env) {
  return !!(env && env.TWAK_ACCESS_ID && env.TWAK_HMAC_SECRET);
}

// HMAC-SHA256 over plaintext `METHOD;PATH;SORTED_QUERY;ACCESS_ID;NONCE;DATE`,
// base64-encoded. Matches the format documented in the upstream skill's
// setup.md reference.
async function twakSign(plaintext, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(plaintext));
  const bytes = new Uint8Array(sigBuf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function twakSortedQuery(query) {
  if (!query) return "";
  const keys = Object.keys(query).sort();
  if (!keys.length) return "";
  return keys.map((k) => `${k}=${query[k]}`).join("&");
}

async function twakHeaders(method, path, query, env) {
  const nonce = crypto.randomUUID();
  const date = new Date().toUTCString();
  const sortedQuery = twakSortedQuery(query);
  const plaintext = [
    method.toUpperCase(),
    path,
    sortedQuery,
    env.TWAK_ACCESS_ID,
    nonce,
    date,
  ].join(";");
  const signature = await twakSign(plaintext, env.TWAK_HMAC_SECRET);
  return {
    "X-TW-CREDENTIAL": env.TWAK_ACCESS_ID,
    "X-TW-NONCE": nonce,
    "X-TW-DATE": date,
    "Authorization": `HMAC-SHA256 Signature=${signature}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "trusty-ai/0.5.1",
  };
}

async function twakGet(path, query, env) {
  if (!twakConfigured(env)) throw new Error("twak not configured");
  const headers = await twakHeaders("GET", path, query, env);
  const qs = query && Object.keys(query).length
    ? "?" + Object.keys(query).map((k) => `${k}=${encodeURIComponent(query[k])}`).join("&")
    : "";
  const r = await fetch(TWAK_BASE + path + qs, { headers });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`twak ${path} ${r.status}: ${body.slice(0, 300)}`);
  }
  return r.json();
}

async function twakPost(path, body, env) {
  if (!twakConfigured(env)) throw new Error("twak not configured");
  const headers = await twakHeaders("POST", path, null, env);
  const r = await fetch(TWAK_BASE + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) {
    const respBody = await r.text().catch(() => "");
    throw new Error(`twak ${path} ${r.status}: ${respBody.slice(0, 300)}`);
  }
  return r.json();
}

// Asset ID format per the gateway's setup.md:
//   native coin → c{coinId}
//   token       → c{coinId}_t{contractAddress}
// Coin IDs: BNB Smart Chain 714, Ethereum 60, Polygon 966, Solana 501.
function twakChainCoinId(chain) {
  const c = (chain || "").toLowerCase();
  if (c === "bsc" || c === "bnb" || c === "binance") return 714;
  if (c === "eth" || c === "ethereum") return 60;
  if (c === "polygon" || c === "matic") return 966;
  if (c === "solana" || c === "sol") return 501;
  return null;
}

// TWAK's INTERNAL network ID, distinct from SLIP-44 coin ID. Discovered
// empirically: /v1/assets/listings returns BSC tokens with asset_id
// "c20000714_t0x..." and network: 20000714 — token lookups via
// /v2/market/tickers, /v1/assets, /v2/coinstatus only succeed when the
// token asset_id uses this prefix. Native-asset lookups (no _t suffix)
// still accept the SLIP-44 c714 form on the same endpoints.
//
// Fall back to twakChainCoinId for chains where we haven't observed
// the internal ID yet — that's the previous behaviour, so worst case
// we degrade to "returns empty" exactly like before.
function twakNetworkId(chain) {
  const c = (chain || "").toLowerCase();
  if (c === "bsc" || c === "bnb" || c === "binance") return 20000714;
  return twakChainCoinId(chain);
}

function twakAssetId(chain, ca) {
  if (!ca) {
    // Native asset — c{slip44}, TWAK accepts both c714 and c20000714 here
    const coinId = twakChainCoinId(chain);
    return coinId ? `c${coinId}` : null;
  }
  // Token — must use TWAK's internal network ID (c20000714 for BSC)
  const networkId = twakNetworkId(chain);
  return networkId ? `c${networkId}_t${ca}` : null;
}

// Security check via TWAK gateway. Null on any failure (rate limit,
// unsupported chain, network). Cached 24h since safety flags are
// immutable per CA.
//
// Tries the documented path with no query params first — the
// include_* params from the older Express reference appear to break
// the live gateway (500 Internal Server Error). If that fails we
// fall back to the param-laden form for shape-discovery diagnostics.
async function twakSecurityRaw(chain, ca, env) {
  const assetId = twakAssetId(chain, ca);
  if (!assetId) return null;
  // Primary: bare path, no query params.
  try {
    return await twakGet(`/v2/coinstatus/${assetId}`, null, env);
  } catch (e1) {
    // Fallback: include security-info hints. The error message from
    // the bare call is captured upstream via the twakSecurity wrapper.
    return await twakGet(`/v2/coinstatus/${assetId}`, {
      include_security_info: "true",
      include_solana_security_info: "true",
    }, env);
  }
}

// Returns { data, error, assetId } — error is null on success, a
// short string on failure. We surface error via twakDiagFor so the
// scan response carries enough info to diagnose without server logs.
async function twakSecurity(chain, ca, env) {
  if (!twakConfigured(env)) return { data: null, error: "not_configured", assetId: null };
  const assetId = twakAssetId(chain, ca);
  if (!assetId) return { data: null, error: "unsupported_chain", assetId: null };
  const cacheKey = `twak-sec:v1:${chain}:${ca}`;
  try {
    const fresh = await twakSecurityRaw(chain, ca, env);
    if (fresh && env.SCAN_KV) {
      try {
        await env.SCAN_KV.put(cacheKey, JSON.stringify(fresh), {
          expirationTtl: TWAK_CACHE_TTL,
        });
      } catch (_) {}
    }
    return { data: fresh, error: null, assetId };
  } catch (e) {
    if (env.SCAN_KV) {
      try {
        const cached = await env.SCAN_KV.get(cacheKey, "json");
        if (cached) return { data: cached, error: null, assetId };
      } catch (_) {}
    }
    return { data: null, error: String(e && e.message || e).slice(0, 200), assetId };
  }
}

// Batch token prices via TWAK gateway. Returns null on any failure.
// Accepts an array of asset IDs (up to 50 per request).
async function twakPricesRaw(assetIds, env) {
  if (!Array.isArray(assetIds) || !assetIds.length) return null;
  return twakPost("/v2/market/tickers", {
    currency: "USD",
    assets: assetIds.slice(0, 50),
  }, env);
}

async function twakPrices(assetIds, env) {
  if (!twakConfigured(env)) return null;
  // Single-token KV cache keyed by asset ID. Cheap to cache aggressively
  // because Dexscreener has its own cache layer anyway — this only fires
  // when Dexscreener returned nothing.
  if (assetIds.length === 1) {
    const cacheKey = `twak-px:v1:${assetIds[0]}`;
    try {
      const fresh = await twakPricesRaw(assetIds, env);
      if (fresh && env.SCAN_KV) {
        try {
          await env.SCAN_KV.put(cacheKey, JSON.stringify(fresh), {
            expirationTtl: 6 * 60 * 60, // 6h — price moves but cache prevents quota burn
          });
        } catch (_) {}
      }
      return fresh;
    } catch (e) {
      if (env.SCAN_KV) {
        try {
          const cached = await env.SCAN_KV.get(cacheKey, "json");
          if (cached) return cached;
        } catch (_) {}
      }
      return null;
    }
  }
  try { return await twakPricesRaw(assetIds, env); }
  catch (_) { return null; }
}

// Fetch 24h % change for a token via TWAK /v2/market/tickers — the
// per-token endpoint that returns change_24h. Confirmed working for
// any TWAK-indexed BSC token once we corrected the chain prefix to
// c20000714_t... (see twakAssetId). Returns { h24 } or null on any
// failure / token not indexed by TWAK; in the null case marketData()
// falls back to Dexscreener's priceChange.h24.
//
// 7d was attempted via /v1/assets/listings but only worked for tokens
// in curated category listings (bnb-ecosystem etc. — CAKE not even
// in there). Too thin to ship, so removed entirely. No per-token 7d
// data source exists in our stack.
async function fetchTwakChange(ca, chain, env, opts) {
  if (!twakConfigured(env)) return null;
  const twakCa = (opts && opts.caOriginal) || ca;
  const assetId = twakAssetId(chain, twakCa);
  if (!assetId) return null;

  try {
    const data = await twakPost(`/v2/market/tickers`, {
      currency: "USD",
      assets: [assetId],
    }, env);
    const ticker = Array.isArray(data?.tickers) ? data.tickers[0] : null;
    if (!ticker) return null;
    let h24 = typeof ticker.change_24h === "number" ? ticker.change_24h : null;
    if (h24 === null) return null;
    // TWAK's change_24h scale depends on the upstream provider:
    // - "coinmarketcap" (native assets) returns percent points (e.g.
    //   BNB at 0.99 means +0.99%).
    // - "cmcdex" (DEX-tracked tokens) returns raw decimal (e.g.
    //   CAKE at -0.024 means -2.4%, not -0.024%).
    // Observed directly via /api/twak-test. Scale up the cmcdex form
    // so the extension receives percent points consistently.
    if (ticker.provider === "cmcdex") h24 = h24 * 100;
    return { h24 };
  } catch (_) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
//   TOPAZ DEX — public Goldsky subgraph (v2 Solidly + v3 Slipstream)
// ═══════════════════════════════════════════════════════════════════
// No auth required. Returns { hasPool: true, tvl: "$40.8K",
// poolAddress: "0x..." } when at least one Topaz pool exists with
// non-zero TVL for this CA, or { hasPool: false } otherwise. BSC-only
// — Topaz isn't deployed on other chains.
//
// We query both v2 and v3 in parallel; each query is a single GraphQL
// request with two aliased selections (token0 + token1 matches) so
// we get all pools where the CA appears on either side. TVL is summed
// across all active pools, abandoned pools (TVL = 0) are filtered out.
// 5-min KV cache — pool data updates within the subgraph indexer lag,
// further caching at our layer keeps the subgraph quota happy.
const TOPAZ_V3_URL = "https://api.goldsky.com/api/public/project_cmgzljqwl006c5np2gnao4li4/subgraphs/topaz-v3/v0.0.1/gn";
const TOPAZ_V2_URL = "https://api.goldsky.com/api/public/project_cmgzljqwl006c5np2gnao4li4/subgraphs/topaz-v2/v0.0.3/gn";
const TOPAZ_STATS_URL = "https://www.topazdex.com/api/stats/pools";

// Bulk-fetch all Topaz pool stats once per 15 min and cache an
// {address → feeApr} map in KV. The Stats API doesn't accept a
// per-address filter, so we pull the top 200 pools sorted by TVL
// (covers all relevant pools given Topaz's current size) and look
// up our pool address client-side.
async function fetchTopazStatsPools(env) {
  const cacheKey = `topaz-stats:v3:all-pools`;
  if (env.SCAN_KV) {
    try {
      const cached = await env.SCAN_KV.get(cacheKey, "json");
      if (cached) return cached;
    } catch (_) {}
  }
  try {
    const r = await fetch(`${TOPAZ_STATS_URL}?sort=tvl&limit=200`, {
      headers: { "Accept": "application/json", "User-Agent": "trusty-ai/0.1" },
    });
    if (!r.ok) return null;
    const data = await r.json();
    // Confirmed shape (probed live 2026-05-25): { ok: true, data: [...] }
    // where each entry has poolAddress, feeApr (string), tvlUsd, etc.
    // Keep the other wrapper fallbacks defensively in case the shape
    // shifts in a future Stats API version.
    const pools = Array.isArray(data?.data) ? data.data
      : Array.isArray(data) ? data
      : Array.isArray(data?.pools) ? data.pools
      : Array.isArray(data?.docs) ? data.docs
      : [];

    const map = {};
    for (const p of pools) {
      // Stats API uses `poolAddress` for the contract; `id` is a
      // numeric DB row id, not a contract address. Try poolAddress
      // first to avoid the easy mismatch.
      const addr = String(p.poolAddress || p.address || "").toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(addr)) continue;
      // feeApr field name varies — accept both camelCase and snake_case.
      const aprRaw = p.feeApr ?? p.fee_apr ?? p.apr ?? null;
      const feeApr = (aprRaw !== null && aprRaw !== undefined && !isNaN(parseFloat(aprRaw)))
        ? parseFloat(aprRaw) : null;
      if (feeApr !== null) map[addr] = feeApr;
    }
    if (env.SCAN_KV) {
      try {
        await env.SCAN_KV.put(cacheKey, JSON.stringify(map), { expirationTtl: 15 * 60 });
      } catch (_) {}
    }
    return map;
  } catch (_) {
    return null;
  }
}

async function fetchTopazPool(ca, env) {
  const caLower = String(ca || "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(caLower)) return null;

  const cacheKey = `topaz:v3:bsc:${caLower}`;
  if (env.SCAN_KV) {
    try {
      const cached = await env.SCAN_KV.get(cacheKey, "json");
      if (cached) return cached;
    } catch (_) {}
  }

  // Single GraphQL doc per subgraph with token0 + token1 aliased
  // queries — TVL field name differs between v2 (reserveUSD) and v3
  // (totalValueLockedUSD).
  const v3Body = JSON.stringify({
    query: `{
      t0: pools(where: { token0: "${caLower}" }, first: 50) { id totalValueLockedUSD }
      t1: pools(where: { token1: "${caLower}" }, first: 50) { id totalValueLockedUSD }
    }`,
  });
  const v2Body = JSON.stringify({
    query: `{
      t0: pairs(where: { token0: "${caLower}" }, first: 50) { id reserveUSD }
      t1: pairs(where: { token1: "${caLower}" }, first: 50) { id reserveUSD }
    }`,
  });

  const post = async (url, body) => {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "trusty-ai/0.1" },
        body,
      });
      if (!r.ok) return null;
      const j = await r.json();
      return j?.data || null;
    } catch (_) { return null; }
  };

  const [v3Data, v2Data] = await Promise.all([
    post(TOPAZ_V3_URL, v3Body),
    post(TOPAZ_V2_URL, v2Body),
  ]);

  // Merge, dedupe by pool id, drop abandoned (TVL = 0).
  const seen = new Set();
  const pools = [];
  const collect = (arr, tvlField) => {
    if (!Array.isArray(arr)) return;
    for (const p of arr) {
      if (!p?.id) continue;
      const id = String(p.id).toLowerCase();
      if (seen.has(id)) continue;
      const tvl = parseFloat(p[tvlField] || 0) || 0;
      if (tvl <= 0) continue;
      seen.add(id);
      pools.push({ id, tvl });
    }
  };
  if (v3Data) { collect(v3Data.t0, "totalValueLockedUSD"); collect(v3Data.t1, "totalValueLockedUSD"); }
  if (v2Data) { collect(v2Data.t0, "reserveUSD"); collect(v2Data.t1, "reserveUSD"); }

  let result;
  if (pools.length === 0) {
    result = { hasPool: false };
  } else {
    const totalTvl = pools.reduce((sum, p) => sum + p.tvl, 0);
    const top = pools.sort((a, b) => b.tvl - a.tvl)[0];
    // Enrich with fee APR for the top pool — sourced from Topaz's
    // Stats API (added in v2.5.0). Null if the pool isn't in the
    // bulk-cached stats map (rare; means very low TVL or new pool).
    let feeApr = null;
    try {
      const statsMap = await fetchTopazStatsPools(env);
      if (statsMap && typeof statsMap[top.id] === "number") {
        feeApr = statsMap[top.id];
      }
    } catch (_) { /* stats lookup is best-effort */ }
    result = {
      hasPool: true,
      tvl: fmtUsd(totalTvl),
      feeApr,
      poolAddress: top.id,
    };
  }

  if (env.SCAN_KV) {
    try {
      await env.SCAN_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 5 * 60 });
    } catch (_) {}
  }
  return result;
}

// Adapter — converts a single TWAK ticker entry into the same shape
// fetchDexRaw returns. Lets the rest of the pipeline treat the data
// identically without branching everywhere. Liquidity + pairCreatedAt
// aren't exposed by the price endpoint, so they remain unknown (0).
function twakPriceToDexShape(twakEntry, fallbackSymbol, fallbackName) {
  if (!twakEntry || typeof twakEntry !== "object") return null;
  // Try several plausible field names.
  const price = parseFloat(twakEntry.price || twakEntry.priceUsd || twakEntry.price_usd || 0) || 0;
  const mcap  = parseFloat(twakEntry.market_cap || twakEntry.marketCap || twakEntry.mcap || 0) || 0;
  const vol   = parseFloat(twakEntry.volume_24h || twakEntry.volume24h || twakEntry.volume || 0) || 0;
  // Per TWAK docs, /v2/market/tickers ticker entries include change_24h
  // as a percent number (e.g. 2.34 = +2.34%). Null when the field is
  // absent so the extension hides the indicator.
  const ch24Raw = twakEntry.change_24h ?? twakEntry.change24h ?? twakEntry.percent_change_24h ?? null;
  const ch24 = ch24Raw !== null && ch24Raw !== undefined && !isNaN(parseFloat(ch24Raw))
    ? parseFloat(ch24Raw)
    : null;
  const sym   = twakEntry.symbol || twakEntry.ticker || fallbackSymbol;
  const name  = twakEntry.name || twakEntry.asset_name || fallbackName;
  if (!price && !mcap && !vol) return null; // nothing useful
  return {
    symbol: sym,
    name: name,
    priceUsd: price,
    mcap: mcap,
    liquidityUsd: 0,
    volume24h: vol,
    pairCreatedAt: 0,
    change24h: ch24,
  };
}

// Diagnostic blob describing what happened with the TWAK security
// call on this scan. Surfaced as `_twak` in PENDING responses so we
// can debug fallback behaviour from the client without poking the
// gateway directly. Carries: status (compact code), assetId (what
// we actually queried), and error (the upstream message verbatim
// when it failed) so a single curl reveals the root cause.
function twakDiagFor(twakResult, env) {
  if (!twakConfigured(env)) return { status: "not_configured" };
  if (!twakResult) return { status: "no_result" };
  const { data, error, assetId } = twakResult;
  if (error) return { status: "error", assetId, error };
  if (data == null) return { status: "null_data", assetId };
  if (typeof data !== "object") return { status: "unexpected_shape", assetId };
  const keys = Object.keys(data);
  if (!keys.length) return { status: "empty_response", assetId };
  const hasSec = !!(data.security_info || data.securityInfo
    || data.solana_security_info || data.solanaSecurityInfo
    || data?.data?.security_info || data?.data?.solana_security_info);
  return { status: hasSec ? "ok_with_security" : "ok_no_security_block", assetId, keys };
}

// Convert TWAK security response → check rows for the scan UI.
// Brand-neutral phrasing ("independent audit") so the user doesn't
// see a different provider name from the rest of the scan.
//
// Tiered shape detection:
//   1. If `security_info` (EVM) / `solana_security_info` (SOL) is
//      present → extract specific flags.
//   2. If the response is non-empty but lacks the expected security
//      block → at minimum surface "Listed in independent registry"
//      so the user sees we corroborated the token's existence.
//   3. Empty response or non-object → [].
function twakSecurityToChecks(twakRes, chain) {
  if (!twakRes || typeof twakRes !== "object") return [];
  const isSol = (chain || "").toLowerCase() === "solana" || (chain || "").toLowerCase() === "sol";
  // Probe several plausible nesting points — upstream docs don't pin
  // the exact key names; we've seen both snake_case and camelCase.
  const sec = isSol
    ? (twakRes.solana_security_info || twakRes.solanaSecurityInfo || twakRes.security_info || twakRes.securityInfo
       || twakRes?.data?.solana_security_info || twakRes?.data?.security_info || null)
    : (twakRes.security_info || twakRes.securityInfo
       || twakRes?.data?.security_info || twakRes?.data?.securityInfo || null);

  const out = [];

  if (sec && typeof sec === "object") {
    if (isSol) {
      const freezeOn = !!(sec.freeze_authority || sec.freezeAuthority);
      const mintOn   = !!(sec.mint_authority   || sec.mintAuthority);
      if (freezeOn) out.push({ ok: false, label: "Token freezable by authority (independent audit)" });
      if (mintOn)   out.push({ ok: false, label: "Mint authority active — supply inflatable" });
      if (!freezeOn && !mintOn) {
        out.push({ ok: true, label: "No critical mint/freeze flags (independent audit)" });
      }
    } else {
      const isHp    = sec.is_honeypot === true || sec.is_honeypot === "1" || sec.isHoneypot === true;
      const notOpen = sec.is_open_source === false || sec.is_open_source === "0" || sec.isOpenSource === false;
      const canMint = sec.is_mintable === true || sec.is_mintable === "1" || sec.isMintable === true;
      if (isHp) {
        out.push({ ok: false, label: "Honeypot detected (independent audit)" });
      } else {
        const issues = [];
        if (notOpen) issues.push("not open-source");
        if (canMint) issues.push("supply mintable");
        if (issues.length) {
          out.push({ ok: false, label: "Audit flags: " + issues.join(", ") });
        } else {
          out.push({ ok: true, label: "No critical security flags (independent audit)" });
        }
      }
    }
    return out;
  }

  // Fallback — TWAK returned a non-empty response but no recognised
  // security block. Worth surfacing a positive row anyway: it tells
  // the user the token at least exists in an independent registry,
  // which is a weak-but-real signal vs unindexed tokens.
  if (Object.keys(twakRes).length > 0) {
    out.push({ ok: true, label: "Listed in independent token registry" });
  }
  return out;
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

async function scanToken(ca, chain, env, opts) {
  if (isSolana(chain)) return scanTokenSolana(ca, chain, env, opts);
  return scanTokenEvm(ca, chain, env, opts);
}

async function scanTokenEvm(ca, chain, env, opts) {
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

  const isBsc = resolvedChain === "bsc" || resolvedChain === "bnb";
  const [gpRes, dxRes, fmRes, chRes, tpRes] = await Promise.allSettled([
    (opts && opts.forcePending) ? Promise.resolve(null) : fetchGoPlus(chainId(resolvedChain), ca, env),
    fetchDex(ca, resolvedChain === "ethereum" ? "ethereum"
                : resolvedChain === "base"    ? "base"
                : resolvedChain === "polygon" ? "polygon"
                : "bsc", env),
    fetchFourMemeOrigin(ca, resolvedChain, env),
    fetchTwakChange(ca, resolvedChain, env, opts),
    // Topaz subgraph lookup — BSC only. Returns { hasPool, tvl,
    // poolAddress } or { hasPool: false } or null for non-BSC.
    isBsc ? fetchTopazPool(ca, env) : Promise.resolve(null),
  ]);
  const g = gpRes.status === "fulfilled" ? gpRes.value : null;
  let   d = dxRes.status === "fulfilled" ? dxRes.value : null;
  const fm = fmRes.status === "fulfilled" ? fmRes.value : null;
  const twChange = chRes.status === "fulfilled" ? chRes.value : null;
  const topaz = tpRes.status === "fulfilled" ? tpRes.value : null;

  // Market-data fallback: when Dexscreener returns nothing (throttle
  // or unindexed token) try the secondary gateway. Sequential so we
  // don't burn the 1 req/s quota when Dex is healthy. Use the case-
  // preserved CA so EIP-55 checksums survive — same reason as TWAK
  // security below.
  if (!d) {
    const twakCaForPrice = (opts && opts.caOriginal) || ca;
    const assetId = twakAssetId(resolvedChain, twakCaForPrice);
    if (assetId) {
      const res = await twakPrices([assetId], env);
      const entry = res?.[0] || res?.tickers?.[0] || res?.data?.[0] || res?.assets?.[0] || null;
      d = twakPriceToDexShape(entry);
    }
  }

  // No GoPlus data → fresh token (not yet in their safety database) OR
  // soft-throttled. Showing 5 ❌ rows + RUN/0 makes a perfectly-fine
  // brand-new token look like a confirmed rug. Distinguish "unknown"
  // from "confirmed bad" by returning a PENDING-style response:
  // CAUTION verdict (yellow, not red), score "?", one honest row.
  // The label still contains "data unavailable" so isUpstreamOk
  // refuses to cache — next scan retries against GoPlus.
  if (!g) {
    const realSym = d?.symbol;
    const symbolPending = "$" + (realSym || ca.slice(2, 6)).replace(/^\$/, "").toUpperCase();
    const namePending = d?.name || "Token " + shortAddr(ca);
    // Pull in inferred-from-market signals. Stops the pill from showing
    // 5 ❌ rows for legit tokens just because GoPlus is missing data.
    const substitutes = buildSubstituteChecks(d, null);
    // Secondary safety signal: try TWAK now that GoPlus is missing.
    // Sequential (not parallel with GoPlus) to avoid burning the 1 req/s
    // TWAK quota when GoPlus is healthy. Pass caOriginal (case-preserved
    // from URL) so EIP-55 checksums survive the lowercase normalisation
    // we apply for internal cache stability — TWAK's lookup is strict.
    const twakCa = (opts && opts.caOriginal) || ca;
    const twakResult = await twakSecurity(resolvedChain, twakCa, env);
    const twakChecks = twakSecurityToChecks(twakResult.data, resolvedChain);
    const out = {
      ca,
      chain: resolvedChain,
      score: "?",
      verdict: "CAUTION",
      symbol: symbolPending,
      name: namePending,
      checks: [
        ...substitutes,
        ...twakChecks,
        { ok: false, label: "Some safety checks pending — refresh for full scan" }
      ],
      paidChecks: [],
      kols: [],
      activity: { tweets24h: 0, deltaPct: 0, sentiment: "—", coordShill: false },
      marketData: marketData(d, null, twChange),
      _twak: twakDiagFor(twakResult, env),
      topaz: topaz,
    };
    if (!realSym) out.symbolFallback = true;
    if (fm && fm.launchedOn) out.launchedOn = fm.launchedOn;
    out.subScores = computeSubScores(null, d, resolvedChain);
    return out;
  }

  const checks = buildChecks(g);
  const paidChecks = buildPaidChecks(g);
  const score = computeScore(g, checks, paidChecks, d);
  const verdict = score >= 70 ? "APE" : score >= 40 ? "CAUTION" : "RUN";
  const subScores = computeSubScores(g, d, resolvedChain);

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
  const shape = baseScanShape(ca, resolvedChain, score, verdict, symbol, name, checks, paidChecks, marketData(d, g, twChange), fm);
  if (symbolFallback) shape.symbolFallback = true;
  shape.subScores = subScores;
  shape.topaz = topaz;
  await recordScanForReceipt(d, shape, env);
  return shape;
}

async function scanTokenSolana(ca, chain, env, opts) {
  const [gpRes, dxRes, rcRes, chRes] = await Promise.allSettled([
    (opts && opts.forcePending) ? Promise.resolve(null) : fetchGoPlusSolana(ca, env),
    fetchDex(ca, "solana", env),
    fetchRugCheck(ca),
    fetchTwakChange(ca, "solana", env, opts),
  ]);
  const g = gpRes.status === "fulfilled" ? gpRes.value : null;
  let   d = dxRes.status === "fulfilled" ? dxRes.value : null;
  const rc = rcRes.status === "fulfilled" ? rcRes.value : null;
  const twChange = chRes.status === "fulfilled" ? chRes.value : null;

  // Same market-data fallback as the EVM path: when Dexscreener
  // returns nothing for a Solana token, try the secondary gateway.
  if (!d) {
    const assetId = twakAssetId("solana", ca);
    if (assetId) {
      const res = await twakPrices([assetId], env);
      const entry = res?.[0] || res?.tickers?.[0] || res?.data?.[0] || res?.assets?.[0] || null;
      d = twakPriceToDexShape(entry);
    }
  }

  // PENDING state — GoPlus Solana is unreliable even for established
  // tokens (see e.g. $BULLISH at $1.1M mcap with GoPlus null). We
  // trigger PENDING whenever GoPlus is null regardless of RugCheck,
  // because RugCheck only covers LP-lock — 4 of 5 safety checks still
  // need GoPlus. Rendering 4 ❌ + 1 ✅ for an established token looks
  // like a near-rug; honest "we don't know" is better. RugCheck data
  // (if any) is surfaced via buildSubstituteChecks as a verified ✅ row.
  if (!g) {
    const realSym = d?.symbol;
    const symbolPending = "$" + (realSym || ca.slice(0, 4)).replace(/^\$/, "").toUpperCase();
    const namePending = d?.name || "Token " + shortAddrSol(ca);
    const substitutes = buildSubstituteChecks(d, rc);
    // Secondary safety signal: try TWAK now that GoPlus Solana is missing.
    // Sequential to keep TWAK's 1 req/s quota for the failure path only.
    const twakResult = await twakSecurity("solana", ca, env);
    const twakChecks = twakSecurityToChecks(twakResult.data, "solana");
    const out = {
      ca,
      chain,
      score: "?",
      verdict: "CAUTION",
      symbol: symbolPending,
      name: namePending,
      checks: [
        ...substitutes,
        ...twakChecks,
        { ok: false, label: "Some safety checks pending — refresh for full scan" }
      ],
      paidChecks: [],
      kols: [],
      activity: { tweets24h: 0, deltaPct: 0, sentiment: "—", coordShill: false },
      marketData: marketDataSolana(d, null, twChange),
      _twak: twakDiagFor(twakResult, env),
    };
    if (!realSym) out.symbolFallback = true;
    out.subScores = computeSubScores(null, d, chain);
    return out;
  }

  const checks = buildChecksSolana(g, rc);
  const paidChecks = buildPaidChecksSolana(g);
  const score = computeScore(g, checks, paidChecks, d);
  const verdict = score >= 70 ? "APE" : score >= 40 ? "CAUTION" : "RUN";
  const subScores = computeSubScores(g, d, chain);

  // Same symbolFallback flag as the EVM path — see scanTokenEvm comment.
  const realSym = d?.symbol || g?.metadata?.symbol;
  const rawSym = (realSym || ca.slice(0, 4)).toString();
  const symbol = "$" + rawSym.replace(/^\$/, "").toUpperCase();
  const name = d?.name || g?.metadata?.name || "Token " + shortAddrSol(ca);
  const symbolFallback = !realSym;

  const shape = baseScanShape(ca, chain, score, verdict, symbol, name, checks, paidChecks, marketDataSolana(d, g, twChange));
  if (symbolFallback) shape.symbolFallback = true;
  shape.subScores = subScores;
  await recordScanForReceipt(d, shape, env);
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

// ═══════════════════════════════════════════════════════════════════
//   RECEIPT TRACKING — weekly digest source data
// ═══════════════════════════════════════════════════════════════════
// Side-effect of every scan with valid market data: store one snapshot
// per (chain, ca) in KV with 8-day TTL. Snapshot is preserved from the
// FIRST scan of the week (later scans of the same CA skip the write so
// the "as we first saw it" baseline stays fixed).
//
// At weekly receipt time, /api/admin/publish-receipt lists every
// receipt:scan:* key, re-fetches current Dex data for each CA, and
// computes whether MC or liquidity dropped enough to count as rugged.
//
// Records every scan regardless of verdict — at receipt time we
// surface RUN verdicts as "hits" and MC/liquidity drops as "rugged",
// with caughtByUs:true when the two overlap. Tracks all 5 chains we
// scan (BSC, ETH, Base, Polygon, Solana).
//
// KV cost: ~1 write per unique CA scanned per week. At 5 users this
// is well within Cloudflare's free tier (1000 writes/day).
async function recordScanForReceipt(d, scanResult, env) {
  if (!env.SCAN_KV) return;
  if (!d || !scanResult) return;
  const { ca, chain, score, verdict, symbol } = scanResult;
  if (!ca || !chain) return;
  // Skip scans without valid market data — we can't compute "rugged"
  // later without a baseline mc to compare against.
  const mc = parseFloat(d.mcap || 0) || 0;
  const liquidity = parseFloat(d.liquidityUsd || 0) || 0;
  if (mc <= 0) return;

  const key = `receipt:scan:${chain}:${ca}`;
  try {
    // Write only if no entry exists — preserve the first-seen snapshot.
    // Read-then-write race is benign: two concurrent first-scans of the
    // same CA could both write, but they'd write identical "as we first
    // saw it" data, so the dedupe end-state is correct either way.
    const existing = await env.SCAN_KV.get(key);
    if (existing) return;
    const nowIso = new Date().toISOString();
    const record = {
      ca, chain, symbol,
      firstScannedAt: nowIso,
      scoreAtScan: score,
      verdictAtScan: verdict,
      mcAtScan: mc,
      liquidityAtScan: liquidity,
      // Running max MC observed AFTER the scan — the real measure of call
      // quality (best exit it gave). Seeded at scan; bumped by
      // updateScanPeaks() each cron cycle. Peaks accrue going forward only;
      // spikes from before tracking started can't be recovered.
      mcPeak: mc,
      mcPeakAt: nowIso,
    };
    await env.SCAN_KV.put(key, JSON.stringify(record), {
      expirationTtl: 8 * 24 * 60 * 60, // 8 days — 7-day window with buffer
    });
  } catch (_) {
    // Tracking is best-effort; never let it break a scan.
  }
}

// Cron pass: refresh the running peak MC for every tracked scan. Fetches
// current MC (Dexscreener), and when it's a new high, updates mcPeak +
// mcPeakAt. Writes ONLY on a new high (keeps KV writes bounded), and
// preserves the original 8-day-from-first-scan expiry so the weekly
// window stays fixed even as records are re-put.
async function updateScanPeaks(env) {
  if (!env.SCAN_KV) return;
  const keys = [];
  let cursor;
  for (let i = 0; i < 5; i++) {
    const page = await env.SCAN_KV.list({ prefix: "receipt:scan:", cursor, limit: 1000 });
    keys.push(...page.keys.map((k) => k.name));
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  const now = Date.now();
  const WINDOW_MS = 8 * 24 * 60 * 60 * 1000;
  // Process in small chunks to bound concurrent Dex fetches.
  for (let i = 0; i < keys.length; i += 8) {
    const chunk = keys.slice(i, i + 8);
    await Promise.allSettled(chunk.map(async (key) => {
      const rec = await env.SCAN_KV.get(key, "json");
      if (!rec || !rec.firstScannedAt) return;
      const remTtl = Math.floor((Date.parse(rec.firstScannedAt) + WINDOW_MS - now) / 1000);
      if (remTtl <= 60) return; // about to expire — don't resurrect it
      const chainForDex = rec.chain === "ethereum" ? "ethereum"
        : rec.chain === "base" ? "base"
        : rec.chain === "polygon" ? "polygon"
        : rec.chain === "solana" ? "solana"
        : "bsc";
      let cur = 0;
      try {
        const d = await fetchDex(rec.ca, chainForDex, env);
        cur = d ? (parseFloat(d.mcap || 0) || 0) : 0;
      } catch (_) { return; }
      if (cur > (rec.mcPeak || rec.mcAtScan || 0)) {
        rec.mcPeak = cur;
        rec.mcPeakAt = new Date().toISOString();
        try {
          await env.SCAN_KV.put(key, JSON.stringify(rec), { expirationTtl: remTtl });
        } catch (_) {}
      }
    }));
  }
}

// ── GoPlus token-security ──
// GoPlus rate-limits Cloudflare Worker IPs aggressively — even with
// retries, the worker often gets 200 OK with empty result (their soft
// throttle pattern). The fix: cache successful GoPlus responses in KV
// for 24h, and use stale-while-revalidate (return cached data when
// fresh fetch fails). Token safety data is effectively immutable per
// CA (LP burn is permanent, mint flag is permanent, owner renounce is
// permanent), so a 24h cache produces no real staleness for users.
const GOPLUS_CACHE_TTL = 24 * 60 * 60; // 24h in seconds
// Keep the original curl-style identifier. Switching to a browser UA
// from a Cloudflare Worker IP appeared to make GoPlus throttling worse —
// public APIs often treat browser UAs from datacenter IPs as bot traffic.
const GOPLUS_UA = "trusty-ai/0.1";

async function fetchGoPlusRaw(cid, ca) {
  const url = `https://api.gopluslabs.io/api/v1/token_security/${cid}?contract_addresses=${ca}`;
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 500ms, 1500ms, 3000ms (covers GoPlus's
      // ~2-sec free-tier rate-limit window so a stuck IP can recover).
      const delay = attempt === 1 ? 500 : attempt === 2 ? 1500 : 3000;
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": GOPLUS_UA },
      });
      if (!r.ok) {
        if (r.status === 429 || r.status >= 500) {
          lastErr = new Error("goplus " + r.status);
          continue;
        }
        throw new Error("goplus " + r.status);
      }
      const data = await r.json();
      const entry = data?.result?.[ca] || data?.result?.[ca.toLowerCase()] || null;
      if (entry && Object.keys(entry).length) return entry;
      lastErr = new Error("goplus empty result");
      continue;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("goplus exhausted retries");
}

async function fetchGoPlus(cid, ca, env) {
  const cacheKey = `gp:v2:${cid}:${ca}`;

  // Attempt fresh fetch first. If it works, refresh the cache.
  try {
    const fresh = await fetchGoPlusRaw(cid, ca);
    if (fresh && env && env.SCAN_KV) {
      try {
        await env.SCAN_KV.put(cacheKey, JSON.stringify(fresh), {
          expirationTtl: GOPLUS_CACHE_TTL,
        });
      } catch (_) {}
    }
    return fresh;
  } catch (freshErr) {
    // Fresh fetch failed (likely rate-limited). Fall back to cached
    // data if we have any — stale-while-revalidate. Token security
    // doesn't change minute-to-minute, so 24h-old data is far better
    // than the all-checks-failed fallback.
    if (env && env.SCAN_KV) {
      try {
        const cached = await env.SCAN_KV.get(cacheKey, "json");
        if (cached) return cached;
      } catch (_) {}
    }
    throw freshErr;
  }
}

// ── Dexscreener (works for both EVM and Solana — just filter chainId) ──
// Mirror of the GoPlus fetch+cache pattern. Without this, transient
// Dexscreener failures (429 / 5xx / empty pairs) cause the scan to be
// stored with empty market data — symbol falls back to hex slice,
// score loses the liveness bonus, pill looks broken. Retries cover
// most transients; the 6h KV cache + stale-while-revalidate makes
// repeated cold-cache scans of the same token instant even when
// Dexscreener is having a bad minute.
const DEX_CACHE_TTL = 6 * 60 * 60; // 6h — market data refreshes more
                                    // often than safety data, hence shorter
                                    // than the GoPlus 24h cache.

async function fetchDexRaw(ca, preferredChain) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = attempt === 1 ? 400 : 1200;
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, {
        headers: { Accept: "application/json", "User-Agent": "trusty-ai/0.1" },
      });
      if (!r.ok) {
        if (r.status === 429 || r.status >= 500) {
          lastErr = new Error("dex " + r.status);
          continue;
        }
        throw new Error("dex " + r.status);
      }
      const data = await r.json();
      if (!Array.isArray(data?.pairs) || !data.pairs.length) {
        // Empty pairs — could be soft-throttle or a genuinely unindexed
        // token. Retry once; if still empty, give up.
        lastErr = new Error("dex empty pairs");
        continue;
      }
      const filtered = preferredChain
        ? data.pairs.filter((p) => p.chainId === preferredChain)
        : [];
      const candidates = filtered.length ? filtered : data.pairs;

      const principal = candidates
        .filter((p) => (p.liquidity?.usd || 0) >= 1000)
        .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0]
        || candidates.sort(
          (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];

      if (!principal) {
        lastErr = new Error("dex no principal pair");
        continue;
      }

      let totalLiq = 0, totalVol = 0;
      for (const p of candidates) {
        totalLiq += p.liquidity?.usd || 0;
        totalVol += p.volume?.h24 || 0;
      }

      // 24h % change — Dexscreener exposes priceChange.{m5,h1,h6,h24} per
      // pair. We read h24 off the principal (highest-liquidity) pair.
      // Stays null when missing so the extension can hide the indicator
      // rather than render a misleading "0%".
      const ch24 = principal.priceChange && typeof principal.priceChange.h24 !== "undefined"
        ? parseFloat(principal.priceChange.h24)
        : null;

      return {
        symbol: principal.baseToken?.symbol,
        name: principal.baseToken?.name,
        priceUsd: parseFloat(principal.priceUsd) || 0,
        mcap: principal.marketCap || principal.fdv || 0,
        liquidityUsd: totalLiq,
        volume24h: totalVol,
        pairCreatedAt: principal.pairCreatedAt || 0,
        change24h: (ch24 !== null && !isNaN(ch24)) ? ch24 : null,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("dex exhausted retries");
}

async function fetchDex(ca, preferredChain, env) {
  const cacheKey = `dex:v1:${preferredChain || "any"}:${ca}`;
  try {
    const fresh = await fetchDexRaw(ca, preferredChain);
    if (fresh && env && env.SCAN_KV) {
      try {
        await env.SCAN_KV.put(cacheKey, JSON.stringify(fresh), {
          expirationTtl: DEX_CACHE_TTL,
        });
      } catch (_) {}
    }
    return fresh;
  } catch (freshErr) {
    // Fresh fetch failed — fall back to cached data if any.
    // Market data goes stale faster than safety data, but a 6h-old
    // mcap is still vastly better than "—" placeholders that make
    // the pill look broken.
    if (env && env.SCAN_KV) {
      try {
        const cached = await env.SCAN_KV.get(cacheKey, "json");
        if (cached) return cached;
      } catch (_) {}
    }
    return null;
  }
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
// Same retry + stale-while-revalidate pattern as the EVM fetcher.
async function fetchGoPlusSolanaRaw(ca) {
  const url = `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${ca}`;
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      const delay = attempt === 1 ? 500 : attempt === 2 ? 1500 : 3000;
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": GOPLUS_UA },
      });
      if (!r.ok) {
        if (r.status === 429 || r.status >= 500) {
          lastErr = new Error("goplus-sol " + r.status);
          continue;
        }
        throw new Error("goplus-sol " + r.status);
      }
      const data = await r.json();
      let entry =
        data?.result?.[ca] ||
        data?.result?.[ca.toLowerCase()] ||
        data?.result?.[ca.toUpperCase()] ||
        null;
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

async function fetchGoPlusSolana(ca, env) {
  const cacheKey = `gpsol:v2:${ca}`;
  try {
    const fresh = await fetchGoPlusSolanaRaw(ca);
    if (fresh && env && env.SCAN_KV) {
      try {
        await env.SCAN_KV.put(cacheKey, JSON.stringify(fresh), {
          expirationTtl: GOPLUS_CACHE_TTL,
        });
      } catch (_) {}
    }
    return fresh;
  } catch (freshErr) {
    if (env && env.SCAN_KV) {
      try {
        const cached = await env.SCAN_KV.get(cacheKey, "json");
        if (cached) return cached;
      } catch (_) {}
    }
    throw freshErr;
  }
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

function marketDataSolana(d, g, twChange) {
  // Same shape as EVM marketData(). Holder count comes from GoPlus.
  const mcap = d?.mcap || 0;
  const liq = d?.liquidityUsd || 0;
  const vol = d?.volume24h || 0;
  const ageDays = d?.pairCreatedAt
    ? Math.max(1, Math.floor((Date.now() - d.pairCreatedAt) / 86400000))
    : 0;
  const holders = g?.holder_count ? parseInt(g.holder_count, 10) : 0;

  const h24 = (twChange && typeof twChange.h24 === "number") ? twChange.h24
            : (typeof d?.change24h === "number" ? d.change24h : null);

  return {
    mcap: fmtUsd(mcap),
    liquidity: fmtUsd(liq),
    volume24h: fmtUsd(vol),
    age: ageDays ? ageDays + "d" : "—",
    holders,
    change: { h24 },
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

// ── Sub-scores ── 6-category breakdown surfaced in the pill.
// These derive from the same data the main score uses, but expose
// it as named axes so users see WHY a token scored what it did
// instead of just a single composite number. Each field is 0-100.
//
// Backward-compat: this is a new field on the response. v0.4.0 and
// v0.5.0 extensions just ignore it — v0.5.1 will render the bars.
function computeSubScores(g, d, chain) {
  // Chain Reputation — base prior per chain, data-independent.
  // ETH has the most mature security tooling and the most expensive
  // rugs; Solana is high-meme-activity and rugs more frequently.
  const chainKey = (chain || "").toLowerCase();
  const CHAIN_PRIORS = {
    ethereum: 100, eth: 100,
    bsc: 90, bnb: 90, binance: 90,
    base: 88,
    arbitrum: 88, arb: 88,
    optimism: 86, op: 86,
    polygon: 85, matic: 85,
    solana: 82, sol: 82,
    avalanche: 80, avax: 80,
    evm: 90, // generic-EVM fallback
  };
  const chainReputation = CHAIN_PRIORS[chainKey] != null ? CHAIN_PRIORS[chainKey] : 70;

  // Age / Timing — how long has the token survived the rug window?
  // Most rugs happen in the first 2 weeks, so age is a real safety signal.
  let ageTiming = 30;
  if (d && d.pairCreatedAt) {
    const ageDays = Math.floor((Date.now() - d.pairCreatedAt) / 86400000);
    if (ageDays >= 180) ageTiming = 95;
    else if (ageDays >= 90) ageTiming = 85;
    else if (ageDays >= 30) ageTiming = 70;
    else if (ageDays >= 7) ageTiming = 50;
    else if (ageDays >= 2) ageTiming = 35;
    else ageTiming = 25;
  }

  // Ownership — did the dev give up admin keys?
  let ownership;
  if (!g) {
    ownership = 0; // unknown
  } else {
    const owner = (g.owner_address || "").toLowerCase();
    const isRenounced = !owner
      || owner === "0x0000000000000000000000000000000000000000"
      || owner === "0x000000000000000000000000000000000000dead";
    ownership = isRenounced ? 100 : 30;
  }

  // Supply Safety — mint disabled + LP burned/locked.
  let supplySafety = 0;
  if (g) {
    if (g.is_mintable !== "1") supplySafety += 50;
    const holders = g.lp_holders || [];
    let lockedShare = 0;
    for (const h of holders) {
      const addr = (h.address || "").toLowerCase();
      const isBurn = addr === "0x0000000000000000000000000000000000000000"
        || addr === "0x000000000000000000000000000000000000dead";
      const isLocked = h.is_locked === 1 || h.is_locked === "1";
      if (isBurn || isLocked) lockedShare += parseFloat(h.percent || "0");
    }
    if (lockedShare >= 0.95) supplySafety += 50;
  }

  // Narrative — how strong is the meme/story behind the token?
  // We don't have KOL/Twitter data here (that's /api/kols, async). So
  // we proxy from market signals: high volume = active narrative,
  // sustained mcap = persistent story.
  let narrative = 30;
  if (d) {
    const vol = d.volume24h || 0;
    const mcap = d.mcap || 0;
    if (vol >= 500000 && mcap >= 1000000) narrative = 85;
    else if (vol >= 100000 && mcap >= 100000) narrative = 70;
    else if (vol >= 10000) narrative = 55;
    else if (vol >= 1000) narrative = 40;
  }

  // Social Presence — derived from holder count + on-chain activity.
  // True KOL+X velocity is paid-tier data fetched separately. The
  // public proxy here is "how many people actually hold this token".
  let socialPresence = 25;
  const holderCount = g?.holder_count ? parseInt(g.holder_count, 10) : 0;
  if (holderCount >= 10000) socialPresence = 90;
  else if (holderCount >= 5000) socialPresence = 80;
  else if (holderCount >= 1000) socialPresence = 65;
  else if (holderCount >= 200) socialPresence = 45;
  else if (holderCount >= 50) socialPresence = 30;

  return {
    chainReputation,
    narrative,
    ownership,
    ageTiming,
    socialPresence,
    supplySafety,
  };
}

// ── market data formatting (matches mock shape) ──

function marketData(d, g, twChange) {
  const mcap = d?.mcap || 0;
  const liq = d?.liquidityUsd || 0;
  const vol = d?.volume24h || 0;
  const ageDays = d?.pairCreatedAt
    ? Math.max(1, Math.floor((Date.now() - d.pairCreatedAt) / 86400000))
    : 0;
  const holders = g?.holder_count ? parseInt(g.holder_count, 10) : 0;

  // 24h % change. TWAK /v2/market/tickers is the primary source for
  // any token TWAK indexes. Dexscreener priceChange.h24 fills in for
  // long-tail tokens TWAK doesn't have. Raw percent points so the
  // extension can colour and add an arrow.
  const h24 = (twChange && typeof twChange.h24 === "number") ? twChange.h24
            : (typeof d?.change24h === "number" ? d.change24h : null);

  return {
    mcap: fmtUsd(mcap),
    liquidity: fmtUsd(liq),
    volume24h: fmtUsd(vol),
    age: ageDays ? ageDays + "d" : "—",
    holders,
    change: { h24 },
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

// Substitute checks built from market + RugCheck data — used when
// GoPlus has no record for the token. Goal: stop rendering 5 ❌
// rows that imply "we checked and everything failed" when the
// truth is "GoPlus doesn't have this token yet." Each row here is
// a real signal (not fabricated), just inferred from sources other
// than GoPlus. The frontend doesn't need to change — these are
// regular {ok, label} rows it already renders as ✅.
function buildSubstituteChecks(d, rc) {
  const out = [];
  // RugCheck LP-lock (Solana-specific). RugCheck is authoritative for
  // LP-lock on Solana because GoPlus Solana frequently omits it.
  if (rc && typeof rc.lpLockedPct === "number" && rc.lpLockedPct >= 95) {
    out.push({ ok: true, label: "LP locked — verified via RugCheck" });
  }
  // Active trading is empirical proof of "not a honeypot" — you cannot
  // have $5K+ daily volume on a token nobody can sell out of. This is
  // a behavioral signal, not contract analysis, but it's a real one.
  const vol24h = d?.volume24h || 0;
  if (vol24h >= 5000) {
    out.push({
      ok: true,
      label: "Token actively trades — " + fmtUsd(vol24h) + " vol/24h, no honeypot behavior"
    });
  }
  // Age + market cap = legitimacy signal. A token that's survived 30+
  // days at $50K+ mcap has been heavily scrutinized by traders; rug
  // attempts on it would have happened by now.
  const mcap = d?.mcap || 0;
  const pairCreatedAt = d?.pairCreatedAt || 0;
  if (pairCreatedAt > 0 && mcap >= 50000) {
    const ageDays = Math.floor((Date.now() - pairCreatedAt) / 86400000);
    if (ageDays >= 30) {
      out.push({
        ok: true,
        label: "Established — " + ageDays + " days old, " + fmtUsd(mcap) + " mcap"
      });
    }
  }
  // Healthy liquidity = retail-tradeable without slippage rugging.
  const liq = d?.liquidityUsd || 0;
  if (liq >= 50000) {
    out.push({ ok: true, label: "Adequate liquidity — " + fmtUsd(liq) + " in pools" });
  }
  return out;
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
  // Also refuse to cache scans where Dexscreener didn't return — those
  // produce hex-fallback symbols ($65AE-style) and empty market data,
  // which makes the pill look broken. Better to re-fetch next call.
  const md = scan.marketData || {};
  const noMcap = !md.mcap || md.mcap === "—" || md.mcap === "$0";
  const noVol = !md.volume24h || md.volume24h === "—" || md.volume24h === "$0";
  if (noMcap && noVol) return false;
  // Hex-fallback symbol means Dexscreener AND GoPlus token_symbol were
  // both empty — same partial-data signal, don't cache.
  if (scan.symbolFallback === true) return false;
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
// ── /api/admin/warm-goplus ──
// Accepts pre-fetched GoPlus data and seeds the 24h cache. Used to
// bootstrap the cache for tokens the worker can't fetch itself due to
// GoPlus rate-limiting Cloudflare IPs. Caller (cron / ops script) does
// the GoPlus fetch from a non-CF IP, then POSTs the entry here.
//
// Body shape:
//   { chain: "bsc"|"ethereum"|..., ca: "0x...", goplus: { ... raw GoPlus result entry ... } }
async function handleAdminWarmGoPlus(request, env) {
  const secret = request.headers.get("x-admin-secret") || "";
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.SCAN_KV) return json({ error: "kv not configured" }, 503);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "bad json" }, 400); }

  const ca = String(body?.ca || "").toLowerCase().trim();
  const chain = String(body?.chain || "bsc").toLowerCase();
  const gp = body?.goplus;

  if (!/^0x[a-f0-9]{40}$/.test(ca)) return json({ error: "invalid ca" }, 400);
  if (!gp || typeof gp !== "object" || !Object.keys(gp).length) {
    return json({ error: "missing or empty goplus payload" }, 400);
  }

  const cid = chainId(chain);
  const cacheKey = `gp:v2:${cid}:${ca}`;

  try {
    await env.SCAN_KV.put(cacheKey, JSON.stringify(gp), {
      expirationTtl: GOPLUS_CACHE_TTL,
    });
    // Bust the per-scan cache so the next /api/scan re-runs through
    // scanTokenEvm and picks up the freshly-seeded GoPlus entry.
    try { await env.SCAN_KV.delete(`scan:v2:${chain}:${ca}`); } catch (_) {}
  } catch (e) {
    return json({ error: "kv write failed: " + e.message }, 500);
  }

  return json({ ok: true, chain, ca, cacheKey });
}

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

// ═══════════════════════════════════════════════════════════════════
//   /api/admin/publish-receipt — weekly receipt generator
// ═══════════════════════════════════════════════════════════════════
// Reads every receipt:scan:* snapshot from KV, re-fetches current Dex
// data for each CA, and categorises:
//   - hits[] : entries where verdictAtScan === "RUN" (we flagged it)
//   - rugged[] : entries where MC OR liquidity dropped >= 80% since
//                the snapshot; caughtByUs:true if it was also a RUN
//
// Read-only. Doesn't modify KV. Operator uploads the JSON to
// Greenfield manually via dCellar. Admin-secret protected.
async function handleAdminPublishReceipt(url, request, env) {
  const secret = request.headers.get("x-admin-secret") || url.searchParams.get("admin");
  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.SCAN_KV) return json({ error: "kv not configured" }, 503);

  // List all receipt:scan: keys across all chains
  const keys = [];
  let cursor;
  for (let i = 0; i < 5; i++) {
    const page = await env.SCAN_KV.list({ prefix: "receipt:scan:", cursor, limit: 1000 });
    keys.push(...page.keys.map(k => k.name));
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }

  // Read each snapshot in parallel
  const snapshots = (await Promise.allSettled(
    keys.map(k => env.SCAN_KV.get(k, "json"))
  )).map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean);

  // Re-fetch current Dex data in batches of 10 to avoid burst-hammering
  // Dexscreener. Per-snapshot timeout is bounded by fetchDex's existing
  // retry logic — failed fetches just return null and we skip the rug
  // computation for that CA.
  async function currentFor(snap) {
    try {
      const chainForDex = snap.chain === "ethereum" ? "ethereum"
                        : snap.chain === "base"     ? "base"
                        : snap.chain === "polygon"  ? "polygon"
                        : snap.chain === "solana"   ? "solana"
                        : "bsc";
      const d = await fetchDex(snap.ca, chainForDex, env);
      if (!d) return null;
      return {
        mc: parseFloat(d.mcap || 0) || 0,
        liquidity: parseFloat(d.liquidityUsd || 0) || 0,
      };
    } catch (_) { return null; }
  }
  const currents = [];
  for (let i = 0; i < snapshots.length; i += 10) {
    const chunk = snapshots.slice(i, i + 10);
    const results = await Promise.allSettled(chunk.map(currentFor));
    currents.push(...results.map(r => r.status === "fulfilled" ? r.value : null));
  }

  // Categorise
  const hits = [];
  const rugged = [];
  const performance = []; // every scanned token + signed MC change since scan
  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i];
    const c = currents[i];
    const isHit = s.verdictAtScan === "RUN";

    // MC drop. If current returned null (token gone from Dexscreener
    // entirely), treat as 100% drop — strongest rug signal.
    let mcDropPct = null, liqDropPct = null;
    if (s.mcAtScan > 0) {
      const curMc = c ? c.mc : 0;
      mcDropPct = Math.max(0, Math.min(100, Math.round((1 - curMc / s.mcAtScan) * 100)));
    }
    if (s.liquidityAtScan > 0) {
      const curLiq = c ? c.liquidity : 0;
      liqDropPct = Math.max(0, Math.min(100, Math.round((1 - curLiq / s.liquidityAtScan) * 100)));
    }
    const isRugged = (mcDropPct !== null && mcDropPct >= 80)
                  || (liqDropPct !== null && liqDropPct >= 80);

    // Signed MC change since scan (up OR down) for the full performance
    // ledger. Null current = token gone from Dexscreener → treat as -100%
    // (same convention as the rug check), flagged `gone` so the viewer can
    // distinguish a true zero from a fetch miss.
    let mcChangePct = null;
    const gone = !c;
    if (s.mcAtScan > 0) {
      mcChangePct = c ? Math.round((c.mc / s.mcAtScan - 1) * 100) : -100;
    }
    // Peak gain since scan — the real "was it a good call" number. mcPeak
    // is at least mcAtScan, and we also fold in the freshly-fetched current
    // MC so a brand-new high isn't missed between cron passes.
    let peakGainPct = null;
    if (s.mcAtScan > 0) {
      const peakMc = Math.max(s.mcPeak || s.mcAtScan, c ? c.mc : 0);
      peakGainPct = Math.round((peakMc / s.mcAtScan - 1) * 100);
    }
    performance.push({
      ca: s.ca,
      symbol: s.symbol,
      chain: s.chain,
      flaggedAt: s.firstScannedAt,
      scoreAtScan: s.scoreAtScan,
      verdictAtScan: s.verdictAtScan,
      mcAtScan: s.mcAtScan,
      currentMc: c ? c.mc : 0,
      mcChangePct,
      peakGainPct,
      gone,
    });

    if (isHit) {
      hits.push({
        ca: s.ca,
        symbol: s.symbol,
        chain: s.chain,
        flaggedAt: s.firstScannedAt,
        scoreAtScan: s.scoreAtScan,
        verdictAtScan: s.verdictAtScan,
        mcAtScan: s.mcAtScan,
        currentMc: c ? c.mc : 0,
      });
    }
    if (isRugged) {
      rugged.push({
        ca: s.ca,
        symbol: s.symbol,
        chain: s.chain,
        flaggedAt: s.firstScannedAt,
        scoreAtScan: s.scoreAtScan,
        verdictAtScan: s.verdictAtScan,
        mcAtScan: s.mcAtScan,
        currentMc: c ? c.mc : 0,
        mcDropPct,
        liquidityAtScan: s.liquidityAtScan,
        currentLiquidity: c ? c.liquidity : 0,
        liquidityDropPct: liqDropPct,
        caughtByUs: isHit,
      });
    }
  }

  // Per-verdict scorecard — the accountability summary. avgChangePct is
  // the mean signed MC change of tokens we gave that verdict.
  function bucket() { return { count: 0, sum: 0, up: 0, down: 0, peakSum: 0, peakN: 0, hit50: 0, hit2x: 0 }; }
  const buckets = { APE: bucket(), CAUTION: bucket(), RUN: bucket() };
  for (const p of performance) {
    const b = buckets[(p.verdictAtScan || "").toUpperCase()];
    if (!b) continue;
    b.count++;
    if (typeof p.mcChangePct === "number") {
      b.sum += p.mcChangePct;
      if (p.mcChangePct > 0) b.up++;
      else if (p.mcChangePct < 0) b.down++;
    }
    if (typeof p.peakGainPct === "number") {
      b.peakSum += p.peakGainPct;
      b.peakN++;
      if (p.peakGainPct >= 50) b.hit50++;
      if (p.peakGainPct >= 100) b.hit2x++;
    }
  }
  function summ(b) {
    return {
      count: b.count,
      avgChangePct: b.count ? Math.round(b.sum / b.count) : 0,
      avgPeakGainPct: b.peakN ? Math.round(b.peakSum / b.peakN) : 0,
      hit50: b.hit50, // calls that peaked at +50% or more
      hit2x: b.hit2x, // calls that peaked at +100% or more
      upCount: b.up, downCount: b.down,
    };
  }
  const scorecard = {
    totalScans: snapshots.length,
    byVerdict: { APE: summ(buckets.APE), CAUTION: summ(buckets.CAUTION), RUN: summ(buckets.RUN) },
    rugged: rugged.length,
    caught: rugged.filter((r) => r.caughtByUs).length,
  };

  // Week label: ISO week of "now" (operator can override via ?week=).
  const weekLabel = url.searchParams.get("week") || isoWeekLabel(new Date());
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - 7);

  return json({
    week: weekLabel,
    dateRange: weekStart.toISOString().slice(0, 10) + " to " + now.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    totalScans: snapshots.length,
    scorecard,
    hits: hits.sort((a, b) => a.scoreAtScan - b.scoreAtScan),
    rugged: rugged.sort((a, b) => (b.mcDropPct || 0) - (a.mcDropPct || 0)),
    // Best calls first, ranked by peak gain since scan (the quality metric).
    performance: performance.sort((a, b) => (b.peakGainPct ?? -101) - (a.peakGainPct ?? -101)),
  });
}

// ISO week label like "2026-W22" — Thursday-anchored per ISO 8601.
function isoWeekLabel(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + "-W" + String(weekNum).padStart(2, "0");
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

/* ================================================================
   Square sentiment — anonymous post mentions, classified server-side.

   Extension's binance-content.js POSTs each post containing a CA to
   /api/square-mention with its text + engagement. We classify
   sentiment via keyword matching, dedup by post-id, aggregate per
   CA into a rolling 24h window. Raw post text is NOT persisted —
   only the derived sentiment class is stored long-term.

   Exposed to paid users via /api/kols → `squareActivity` field.
   ================================================================ */

const SQUARE_BULL_KEYWORDS = [
  "moon", "pump", "ape", "lfg", "send", "send it", "x100", "100x", "gem",
  "alpha", "hot", "bullish", "bull", "to the moon", "buying", "buy",
  "loaded", "loading up", "accumulating", "long", "based", "wagmi",
  "let's go", "goated", "fire", "🔥", "🚀", "💎", "🟢", "📈", "↗️",
];
const SQUARE_BEAR_KEYWORDS = [
  "rug", "scam", "honeypot", "dump", "dumped", "sold", "selling out",
  "exit", "exiting", "fade", "bearish", "bear", "down bad", "rip", "dead",
  "abandoned", "rugged", "🔴", "📉", "↘️", "💩",
];

function classifySquareSentiment(text) {
  const lower = String(text || "").toLowerCase();
  let bull = 0, bear = 0;
  for (const k of SQUARE_BULL_KEYWORDS) if (lower.indexOf(k) >= 0) bull++;
  for (const k of SQUARE_BEAR_KEYWORDS) if (lower.indexOf(k) >= 0) bear++;
  if (bull > bear) return "bull";
  if (bear > bull) return "bear";
  return "neutral";
}

// Tiny non-cryptographic hash used to detect coord-shill: same text
// posted by multiple users in a short window. Normalizes whitespace
// + lowercases first to catch trivial paraphrases.
function squareTextHash(text) {
  const norm = String(text || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
  let h = 5381;
  for (let i = 0; i < norm.length; i++) {
    h = ((h << 5) + h + norm.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

async function handleSquareMention(request, env) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "bad json" }, 400); }

  const postId = String(body?.postId || "").slice(0, 64);
  if (!postId) return json({ error: "missing postId" }, 400);

  const text = String(body?.text || "").slice(0, 4000); // cap input size
  const engagement = parseInt(body?.engagement || "0", 10) || 0;

  // Ticker path — $SYMBOL / #symbol detected client-side. Server
  // resolves the ticker to one or more known CAs via the symref
  // table (written when users scan a token). Filters out generic
  // hashtags like #crypto since those have no symref entry.
  const ticker = String(body?.ticker || "").trim().toUpperCase();
  if (ticker) {
    if (!/^[A-Z0-9]{1,12}$/.test(ticker)) {
      return json({ error: "invalid ticker" }, 400);
    }
    if (!env.SCAN_KV) return json({ ok: true, recorded: false });
    const cas = await resolveTickerToCas(ticker, env);
    if (!cas.length) {
      // Not a known token — silently ignore. Avoids spamming sentiment
      // on every English hashtag that happens to look ticker-shaped.
      return json({ ok: true, recorded: false, reason: "unknown_ticker", ticker });
    }
    let recorded = 0;
    for (const ref of cas) {
      const wrote = await recordSquareMention(ref.ca, ref.chain, postId, text, engagement, env);
      if (wrote) recorded++;
    }
    return json({ ok: true, recorded: recorded, matched: cas.length });
  }

  // CA path — explicit contract address in the post body.
  const rawCa = String(body?.ca || "").trim();
  const chain = String(body?.chain || "bsc").toLowerCase();
  const isSol = isSolana(chain);
  const ca = isSol ? rawCa : rawCa.toLowerCase();
  if (!isValidCa(ca, chain)) return json({ error: "invalid ca or ticker" }, 400);

  if (!env.SCAN_KV) return json({ ok: true, recorded: false });

  const wrote = await recordSquareMention(ca, chain, postId, text, engagement, env);
  if (wrote === "dedup") return json({ ok: true, dedup: true });
  return json({ ok: true, recorded: !!wrote });
}

// Shared write path used by both the explicit-CA and ticker-resolved
// paths in handleSquareMention. Returns:
//   "dedup" — this post was already counted for this CA
//   true    — mention appended to the agg
//   false   — KV not configured (no-op)
async function recordSquareMention(ca, chain, postId, text, engagement, env) {
  if (!env.SCAN_KV) return false;

  // Dedup: same (post, CA) pair can't be counted twice. TTL matches
  // the 7-day aggregation window — a post stays dedup-protected for
  // as long as it can still influence sentiment.
  const dedupKey = `sqm:post:${postId}:${ca}`;
  try {
    const seen = await env.SCAN_KV.get(dedupKey);
    if (seen) return "dedup";
    await env.SCAN_KV.put(dedupKey, "1", { expirationTtl: 8 * 24 * 3600 });
  } catch (_) {}

  // Classify sentiment from text. Raw text is NOT persisted past
  // this function — only the derived class + the dedup marker live in KV.
  const sentiment = classifySquareSentiment(text);
  const textHash = squareTextHash(text);

  // Append to per-CA rolling aggregate. Race-tolerant: if two writes
  // collide, one mention may be lost — acceptable at our scale.
  const aggKey = `sqm:agg:${chain}:${ca}`;
  let agg = null;
  try {
    agg = await env.SCAN_KV.get(aggKey, "json");
  } catch (_) {}
  if (!agg || !Array.isArray(agg.mentions)) {
    agg = { ca, chain, mentions: [], updatedAt: 0 };
  }

  const now = Date.now();
  agg.mentions.push({ ts: now, sentiment, engagement, textHash });

  const cutoff = now - 7 * 24 * 3600 * 1000;
  agg.mentions = agg.mentions.filter(function (m) { return m.ts >= cutoff; });
  if (agg.mentions.length > 500) {
    agg.mentions = agg.mentions.slice(-500);
  }
  agg.updatedAt = now;

  try {
    await env.SCAN_KV.put(aggKey, JSON.stringify(agg), {
      expirationTtl: 8 * 24 * 3600,
    });
  } catch (_) {}
  return true;
}

// Pre-seeded symrefs for well-known tokens — guarantees ticker
// resolution works on day-one for the project's own token before
// scan-history accumulates organic entries. Add sparingly; the
// scan-time symref write covers everything else.
const SYMREF_SEEDS = {
  TRUSTY: [{ chain: "bsc", ca: "0x65aea108c21439693468fcd542d81c29e8df4444" }],
};

// Resolve a ticker symbol ($SYMBOL / #symbol stripped + uppercased)
// to the list of (chain, CA) pairs we've seen for that symbol in
// scan history. Returns [] when the symbol is unknown — which is
// also how we filter out generic English hashtags (#crypto, #trusty
// as adjective) that aren't tokens.
async function resolveTickerToCas(ticker, env) {
  if (!env.SCAN_KV) return SYMREF_SEEDS[ticker] || [];
  try {
    const idx = await env.SCAN_KV.get(`symref:idx:${ticker}`, "json");
    const fromIdx = (idx && Array.isArray(idx.entries))
      ? idx.entries.filter(function (e) { return e && e.ca && e.chain; })
      : [];
    const seeds = SYMREF_SEEDS[ticker] || [];
    if (!seeds.length) return fromIdx;
    // Merge seeds with index entries, de-duped on chain:ca.
    const seen = new Set(fromIdx.map(function (e) { return e.chain + ":" + e.ca; }));
    for (const s of seeds) {
      const key = s.chain + ":" + s.ca;
      if (!seen.has(key)) { fromIdx.push(s); seen.add(key); }
    }
    return fromIdx;
  } catch (_) {
    return SYMREF_SEEDS[ticker] || [];
  }
}

// Record a (chain, CA, symbol) triple in the symref index so future
// ticker mentions for this symbol resolve to this CA. Idempotent —
// repeat scans of the same token refresh the entry's lastSeen.
async function writeSymref(chain, ca, symbol, env) {
  if (!env.SCAN_KV) return;
  const sym = String(symbol || "").replace(/^\$/, "").toUpperCase();
  if (!sym || !/^[A-Z0-9]{1,12}$/.test(sym)) return;
  const idxKey = `symref:idx:${sym}`;
  let idx = null;
  try {
    idx = await env.SCAN_KV.get(idxKey, "json");
  } catch (_) {}
  if (!idx || !Array.isArray(idx.entries)) idx = { entries: [] };
  const now = Date.now();
  const key = `${chain}:${ca}`;
  const existing = idx.entries.find(function (e) {
    return e && (`${e.chain}:${e.ca}`) === key;
  });
  if (existing) {
    existing.lastSeen = now;
  } else {
    idx.entries.push({ chain: chain, ca: ca, lastSeen: now });
    if (idx.entries.length > 20) {
      // Cap per-symbol entries — keep the 20 most-recently-seen.
      idx.entries.sort(function (a, b) { return (b.lastSeen || 0) - (a.lastSeen || 0); });
      idx.entries = idx.entries.slice(0, 20);
    }
  }
  try {
    // 90-day TTL — a symbol that hasn't been scanned in 90 days
    // probably isn't a live token anyway. Refreshed on each scan.
    await env.SCAN_KV.put(idxKey, JSON.stringify(idx), {
      expirationTtl: 90 * 24 * 3600,
    });
  } catch (_) {}
}

// Read-only summary used by /api/kols (paid panel). Returns the same
// shape the X `activity` field uses, so the frontend can render both
// side by side without special-casing.
//
// Window is 7 days for Square (vs 24h for X). Rationale: Square posts
// at a much slower cadence than X, so a daily window leaves most
// tokens at zero. A weekly window gives a more useful sentiment
// signal without sacrificing recency.
//
// Data sources, in priority order:
//   1. User-reported mentions (extension users browsing Square fire
//      /api/square-mention which writes into sqm:agg:{chain}:{ca}).
//      Highest fidelity — real post-by-post sentiment classification.
//   2. Server-side scrape of Binance Square's hashtag page for the
//      token's symbol. Only triggers when #1 is empty. Solves the
//      chicken-and-egg of "no users have walked past a Square post
//      about this token yet". Cached 24h per symbol.
// Server-side fetch of Binance Square's public hashtag page for a
// token symbol. The page is server-rendered with post bodies + URLs
// + Binance's own sentiment labels (Bullish / Bearish), so we can
// extract real sentiment data without depending on extension users
// to walk past a Square post.
//
// Cached 24h per symbol — Binance is fine with infrequent public
// page fetches, but we don't want to hammer them. Cache miss = one
// fetch on the slow path (added to the existing /api/kols latency),
// cache hit = ~20ms KV read.
//
// Failure modes (all return empty so the panel just shows "no
// mentions yet" instead of breaking):
//   - Binance changes their HTML format → our regex misses → empty
//   - Network error / 5xx → empty
//   - Symbol contains unsafe chars / too long → skipped
async function fetchSquareForSymbol(symbol, env) {
  const sym = String(symbol || "").trim().replace(/^[\$#]/, "").toLowerCase();
  if (!sym || !/^[a-z0-9]{2,12}$/.test(sym)) {
    return { mentions7d: 0, sentiment: "—", coordShill: false, source: "binance-square", windowDays: 7, serverFetched: true, fetchStatus: "bad_symbol" };
  }

  const cacheKey = `sqfetch:v1:${sym}`;
  // Only consult cache if we have a CACHED HIT (mentions7d > 0).
  // Empty results aren't cached, so this read is a fast path for
  // tokens we've already successfully scraped.
  if (env.SCAN_KV) {
    try {
      const cached = await env.SCAN_KV.get(cacheKey, "json");
      if (cached && cached.mentions7d > 0) return cached;
    } catch (_) {}
  }

  let html = "";
  let httpStatus = 0;
  try {
    const url = "https://www.binance.com/en/square/hashtag/" + encodeURIComponent(sym);
    const r = await fetch(url, {
      headers: {
        // Pose as a real browser — Cloudflare Worker IPs serving a
        // bot-shaped UA get a stripped HTML page from Binance that
        // omits the post listings. A normal browser UA gets the full
        // server-rendered content we verified via WebFetch.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
    httpStatus = r.status;
    if (!r.ok) {
      return { mentions7d: 0, sentiment: "—", coordShill: false, source: "binance-square", windowDays: 7, serverFetched: true, fetchStatus: "http_" + httpStatus };
    }
    html = await r.text();
  } catch (e) {
    return { mentions7d: 0, sentiment: "—", coordShill: false, source: "binance-square", windowDays: 7, serverFetched: true, fetchStatus: "fetch_error", fetchError: String(e && e.message || e).slice(0, 120) };
  }

  if (!html || html.length < 500) {
    return { mentions7d: 0, sentiment: "—", coordShill: false, source: "binance-square", windowDays: 7, serverFetched: true, fetchStatus: "short_html", htmlLength: html ? html.length : 0, htmlSnippet: (html || "").slice(0, 600) };
  }

  // Extract unique post IDs from URL patterns. Each unique post
  // about this hashtag = one mention. Cap at 500 for safety.
  const postIds = new Set();
  const urlRe = /\/[a-z]{2}\/square\/post\/(\d+)/g;
  let m;
  while ((m = urlRe.exec(html)) !== null) {
    postIds.add(m[1]);
    if (postIds.size >= 500) break;
  }

  const bullish = (html.match(/>Bullish</gi) || []).length;
  const bearish = (html.match(/>Bearish</gi) || []).length;

  const total = postIds.size;
  let sentiment = "—";
  if (total > 0) {
    if (bullish > bearish * 1.3) sentiment = "Bullish";
    else if (bearish > bullish * 1.3) sentiment = "Bearish";
    else sentiment = "Neutral";
  }

  const result = {
    mentions7d: total,
    sentiment: sentiment,
    coordShill: false,
    source: "binance-square",
    windowDays: 7,
    serverFetched: true,
    fetchStatus: total > 0 ? "ok" : "no_posts_in_html",
    htmlLength: html.length,
    httpStatus: httpStatus,
  };
  // When we got HTML back but no posts in it, include a snippet so
  // the operator can see what Binance actually served — usually
  // tells us whether it's an anti-bot stub, a redirect page, or a
  // genuine "no results" empty state.
  if (total === 0) {
    result.htmlSnippet = html.slice(0, 800);
  }

  // Only cache when we actually found something — don't poison the
  // cache with transient failures. Next call will re-try.
  if (env.SCAN_KV && total > 0) {
    try {
      await env.SCAN_KV.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 24 * 3600,
      });
    } catch (_) {}
  }

  return result;
}

async function readSquareActivity(ca, chain, env, symbol) {
  const empty = { mentions7d: 0, sentiment: "—", coordShill: false, source: "binance-square", windowDays: 7 };
  if (!env.SCAN_KV) return empty;
  const aggKey = `sqm:agg:${chain}:${ca}`;
  let agg = null;
  try {
    agg = await env.SCAN_KV.get(aggKey, "json");
  } catch (_) {}

  const now = Date.now();
  const cutoff = now - 7 * 24 * 3600 * 1000;
  const recent = (agg && Array.isArray(agg.mentions))
    ? agg.mentions.filter(function (m) { return m.ts >= cutoff; })
    : [];

  // Fallback to server-side scrape when extension users haven't
  // reported anything for this token yet. Returns the scrape's
  // diagnostic blob verbatim (mentions7d may be 0 with fetchStatus
  // populated so the operator can see why it didn't find anything).
  if (!recent.length) {
    if (symbol) {
      const fetched = await fetchSquareForSymbol(symbol, env);
      if (fetched) return fetched;
    }
    return empty;
  }

  let bull = 0, bear = 0;
  const hashCounts = {};
  for (const m of recent) {
    if (m.sentiment === "bull") bull++;
    else if (m.sentiment === "bear") bear++;
    if (m.textHash) hashCounts[m.textHash] = (hashCounts[m.textHash] || 0) + 1;
  }
  const total = recent.length;
  const sentimentLabel =
    bull > bear * 1.3 ? "Bullish" :
    bear > bull * 1.3 ? "Bearish" : "Neutral";
  // Coord-shill: 5+ posts sharing the same text hash inside the 7-day
  // window. Threshold scaled vs the prior 24h/3-post rule — a weekly
  // window naturally has more posts, so the bar to flag coordination
  // is higher to keep the false-positive rate steady.
  let coordShill = false;
  for (const k in hashCounts) {
    if (hashCounts[k] >= 5) { coordShill = true; break; }
  }
  return {
    mentions7d: total,
    sentiment: sentimentLabel,
    coordShill: coordShill,
    source: "binance-square",
    windowDays: 7,
  };
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
