# `get_trending` — tokens active in the Trusty network

The trending feed is a live ranked list of contract addresses that
the Trusty extension and website have been scanning, saving, or
showing pills for in a recent time window. Useful for "what's hot
right now" or "what's the network watching" queries.

## Endpoint

```
GET https://api.trustyai.tech/api/trending?window=<hours>&limit=<n>
```

No auth required. Cached server-side.

### Parameters

| Param    | Required | Default | Notes |
|----------|----------|---------|-------|
| `window` | no       | `24`    | Lookback window in hours |
| `limit`  | no       | `10`    | Number of items to return (1–50) |

### Example

```bash
curl 'https://api.trustyai.tech/api/trending?window=24&limit=10'
```

## Response shape

```jsonc
{
  "items": [
    {
      "ca":     "0x65aea108c21439693468FCD542D81C29E8df4444",
      "chain":  "bsc",
      "scans":  47,                    // unique-CA scan count in window
      "saves":  12,                    // watchlist-add count in window
      "scan": {                        // hydrated /api/scan result
        "score":   78,
        "verdict": "APE",
        "symbol":  "$TRUSTY",
        "name":    "Trusty AI",
        "marketData": { "mcap": "$2.4M", ... }
      }
    },
    // …
  ],
  "window": 24,
  "generatedAt": 1746...
}
```

## What "trending" actually means here

This isn't volume-weighted price action. It's **attention-weighted**
— contracts that real Trusty users have been actively scanning or
watchlisting. That makes it a leading indicator for hype cycles
(degens scan a token before they buy) and a lagging indicator for
established tokens (people don't keep re-scanning what they already
know).

If the user asks "what's pumping", this is *not* the right call —
use a price-feed skill instead. If they ask "what is the Trusty
network watching" or "what's getting attention right now", this is
exactly right.

## Tier interpretation

For each item, the embedded `scan.verdict` tells you whether the
trending token is APE / CAUTION / RUN. A high-attention RUN can be
worth surfacing as a warning ("lots of people scanning this — and
it's a rug"). A high-attention APE is the closest thing this feed
gives you to a positive recommendation.

## Pagination + freshness

No pagination yet. `limit` caps at 50. The cache is short (~1 min)
so polling is fine but not necessary — usage patterns are typically
single-shot ("show me trending now") rather than streaming.
