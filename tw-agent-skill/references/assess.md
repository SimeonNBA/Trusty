# `assess_token` — one-shot safety verdict

The main call. Pass a contract address and chain, get a single verdict
with everything you need to decide whether to proceed with a trade.

## Endpoint

```
GET https://api.trustyai.tech/api/scan?ca=<address>&chain=<chain>
```

No auth required. Cached server-side for 5 minutes per `(ca, chain)`
pair.

### Parameters

| Param  | Required | Notes |
|--------|----------|-------|
| `ca`   | yes      | Contract address. EVM `0x…` (40 hex chars) or Solana base58 (32–44 chars) |
| `chain`| no       | One of: `bsc` (default), `ethereum`, `solana`, `polygon`, `base`. Auto-detected from address shape when omitted |

### Examples

```bash
# BSC (default chain)
curl 'https://api.trustyai.tech/api/scan?ca=0x65aea108c21439693468FCD542D81C29E8df4444'

# Ethereum
curl 'https://api.trustyai.tech/api/scan?ca=0x6982508145454Ce325dDbe47a25d4ec3d2311933&chain=ethereum'

# Solana
curl 'https://api.trustyai.tech/api/scan?ca=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&chain=solana'
```

## Response shape

```jsonc
{
  "ca": "0x65aea108c21439693468FCD542D81C29E8df4444",
  "chain": "bsc",
  "score": 78,                 // 0–100, higher = safer
  "verdict": "APE",            // "APE" | "CAUTION" | "RUN"
  "symbol": "$TRUSTY",
  "name": "Trusty AI",

  "checks": [                  // free-tier headline checks (5 items)
    { "ok": true,  "label": "Not a honeypot" },
    { "ok": true,  "label": "Sell tax 0%" },
    { "ok": true,  "label": "LP locked" },
    { "ok": true,  "label": "Mint disabled" },
    { "ok": true,  "label": "Contract renounced" }
  ],

  "paidChecks": [              // additional paid-tier checks
    { "ok": true,  "label": "No blacklist function" },
    { "ok": false, "label": "Owner can change tax" }
    // …
  ],

  "marketData": {
    "mcap":     "$2.4M",
    "liquidity":"$340K",
    "volume24h":"$58K",
    "age":      "47 days",
    "holders":  3210
  },

  "kols":     [],              // hydrated separately via /api/kols
  "activity": { "tweets24h": 0, "deltaPct": 0, "sentiment": "—", "coordShill": false },

  "launchedOn": "fourmeme"     // present if the token was deployed via four.meme's BSC proxy
}
```

## Verdict thresholds

| score   | verdict   | what it means |
|---------|-----------|---------------|
| ≥ 70    | `APE`     | All major safety checks pass. Honeypot risk minimal. Still do your own research; high score ≠ guaranteed price action. |
| 40–69   | `CAUTION` | At least one yellow-flag (e.g. sellable but with sell tax, or LP locked but mint authority active). Surface specifics to the user. |
| < 40    | `RUN`     | At least one red-flag that can wreck a position — honeypot detected, mint active without renouncement, sell tax > 5%, etc. Do NOT auto-proceed to a swap. |

## Recommended pattern when an agent is about to swap

```
user: "swap 0.1 BNB for $TRUSTY"
agent: assess_token(ca="0x65aea1…", chain="bsc")
       → { verdict: "APE", score: 78, checks: [...] }
       OK, present checks + ask for confirmation
       proceed to swap-quote skill
```

If `verdict === "RUN"`, the agent should refuse to auto-proceed and
explain why. The `checks` array is already plain-English; surface the
failing items verbatim. See `references/audit-swap.md` for the full
pattern.

## Errors and degradations

`/api/scan` is fault-tolerant. When upstream data sources are down or
slow, the response still returns 200 OK with placeholder labels like
`"Tax data unavailable"` rather than failing. If you see those labels
on every check, the upstream is degraded — don't treat it as a real
RUN verdict; surface to the user and ask them to retry.

The endpoint never returns 4xx for valid CA shapes. 4xx means the CA
shape itself was malformed (not a valid EVM hex or Solana base58
address).
