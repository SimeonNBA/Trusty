/* ================================================================
   Trusty — Background service worker

   In Manifest V3, this is the only context that can do cross-origin
   fetches without CORS issues (content scripts inherit the host
   page's origin and get blocked). We use it to proxy Binance Square
   hashtag fetches from the user's residential IP — Cloudflare Worker
   IPs hit AWS WAF and get a 202 stub, residential IPs get the real
   server-rendered HTML.
   ================================================================ */

chrome.runtime.onInstalled.addListener(function (details) {
  console.log("🛡️ Trusty installed:", details.reason);
});

chrome.runtime.onStartup.addListener(function () {
  console.log("🛡️ Trusty: browser started, extension ready.");
});

/* ── Square hashtag fetch (proxied via user's IP) ────────────────
   Content scripts send a message with a token symbol; we fetch the
   public Binance Square hashtag page, parse for unique post IDs and
   Binance's bullish/bearish label markers, and return the aggregate.
   Per-symbol in-memory cache (10 min) prevents thrash when the same
   panel reopens. */

const sqCache = new Map(); // sym → { ts, result }
const SQ_CACHE_MS = 10 * 60 * 1000;

function normalizeSymbol(sym) {
  return String(sym || "").trim().replace(/^[\$#]/, "").toLowerCase();
}

async function fetchSquareHashtag(rawSymbol) {
  const sym = normalizeSymbol(rawSymbol);
  if (!sym || !/^[a-z0-9]{2,12}$/.test(sym)) {
    return { ok: false, reason: "bad_symbol", symbol: sym };
  }

  // Cache hit?
  const cached = sqCache.get(sym);
  if (cached && (Date.now() - cached.ts) < SQ_CACHE_MS) {
    return cached.result;
  }

  let html = "";
  let httpStatus = 0;
  try {
    const url = "https://www.binance.com/en/square/hashtag/" + encodeURIComponent(sym);
    const r = await fetch(url, {
      // include cookies — without them AWS WAF 202s us with a
      // challenge stub even from a residential IP. The cookies are
      // scoped to binance.com (where the user already sends them on
      // every Square visit). Our code never reads or stores any
      // cookies; the browser just attaches them to the outbound
      // request like it would for any normal Square navigation.
      credentials: "include",
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    httpStatus = r.status;
    if (!r.ok) {
      const result = { ok: false, reason: "http_" + httpStatus, symbol: sym };
      sqCache.set(sym, { ts: Date.now(), result });
      return result;
    }
    html = await r.text();
  } catch (e) {
    return { ok: false, reason: "fetch_error", error: String(e && e.message || e).slice(0, 200), symbol: sym };
  }

  if (!html || html.length < 500) {
    const result = { ok: false, reason: "short_html", htmlLength: html ? html.length : 0, symbol: sym };
    sqCache.set(sym, { ts: Date.now(), result });
    return result;
  }

  // Extract unique post IDs from /<locale>/square/post/<id> URLs.
  const postIds = [];
  const seen = new Set();
  const urlRe = /\/[a-z]{2}\/square\/post\/(\d+)/g;
  let m;
  while ((m = urlRe.exec(html)) !== null) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    postIds.push(m[1]);
    if (postIds.length >= 500) break;
  }

  // Binance's own sentiment label counts (best-effort HTML pattern).
  const bullish = (html.match(/>Bullish</gi) || []).length;
  const bearish = (html.match(/>Bearish</gi) || []).length;

  const result = {
    ok: true,
    symbol: sym,
    mentions7d: postIds.length,
    postIds: postIds,
    bullish: bullish,
    bearish: bearish,
    htmlLength: html.length,
    httpStatus: httpStatus,
  };
  sqCache.set(sym, { ts: Date.now(), result });
  return result;
}

console.log("🛡️ Trusty SW: top-level loaded");

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  console.log("🛡️ Trusty SW: message received:", msg, "from:", sender.tab && sender.tab.url);
  if (msg && msg.action === "fetchSquareHashtag") {
    fetchSquareHashtag(msg.symbol).then(function (result) {
      console.log("🛡️ Trusty SW: fetch result for", msg.symbol, "→", result);
      sendResponse(result);
    }).catch(function (err) {
      console.error("🛡️ Trusty SW: fetch error:", err);
      sendResponse({ ok: false, reason: "handler_error", error: String(err && err.message || err) });
    });
    return true; // keep the message channel open for the async response
  }
});
