# Trusty AI — scan backend (Cloudflare Worker)

Backs `GET /api/scan?ca=0x...&chain=bsc`. Pulls token-security signals
from GoPlus and market data from Dexscreener, scores them, and returns
the same response shape the extension expects (see
`../extension/lib/api.js`).

## Local dev

```bash
cd D:/Trusty-AI/frontend/api
npm install
npx wrangler login              # one time
npx wrangler dev                # localhost:8787
```

Test:

```bash
curl "http://localhost:8787/api/scan?ca=0x65aea108c21439693468FCD542D81C29E8df4444&chain=bsc"
```

## First deploy

1. Create the KV namespace and paste the id into `wrangler.toml`:

   ```bash
   npx wrangler kv namespace create SCAN_KV
   # Output:
   #   id = "abc123..."   ← paste into wrangler.toml [[kv_namespaces]] id
   ```

2. Deploy to `*.workers.dev`:

   ```bash
   npx wrangler deploy
   ```

   You'll get a URL like `https://trusty-api.<your-account>.workers.dev`.
   Quick sanity-check it before wiring the custom domain.

3. Wire `api.trustyai.tech`:

   - Cloudflare dashboard → Workers & Pages → `trusty-api` → Settings →
     Triggers → "Add Custom Domain" → `api.trustyai.tech`.
   - Cloudflare auto-creates the DNS record. (The apex `trustyai.tech`
     can keep pointing at GitHub Pages — only `api` goes to the Worker.)

4. Uncomment the `routes` block in `wrangler.toml` and redeploy so future
   `wrangler deploy` runs preserve the binding.

## Operations

```bash
npx wrangler tail                # live logs
npx wrangler kv key list --binding=SCAN_KV
npx wrangler kv key delete --binding=SCAN_KV "scan:bsc:0x..."
```

## Response shape

Matches `extension/lib/api.js` exactly. Any change here must be mirrored
on the client.

```json
{
  "ca": "0x...",
  "chain": "bsc",
  "score": 0-100,
  "verdict": "APE" | "CAUTION" | "RUN",
  "symbol": "$TRUSTY",
  "name": "Trusty AI",
  "checks":     [{ "ok": bool, "label": "Not a honeypot" }, ...],   // 5
  "paidChecks": [{ "ok": bool, "label": "Snipers: ..." }, ...],     // 2
  "kols":       [],   // populated by TweetScout integration (task #2)
  "activity":   { "tweets24h": 0, "deltaPct": 0, "sentiment": "—", "coordShill": false },
  "marketData": { "mcap": "$1.2M", "liquidity": "$340K", "age": "12d", "holders": 1842 }
}
```

## Score weights (sum to 100)

| Signal              | Weight | Source             |
|---------------------|-------:|--------------------|
| Not a honeypot      |     25 | GoPlus             |
| Tax ≤5% / ≤5%       |     15 | GoPlus             |
| LP locked (≥95%)    |     15 | GoPlus `lp_holders`|
| Mint disabled       |     10 | GoPlus             |
| Contract renounced  |     10 | GoPlus             |
| Snipers <10%        |     15 | GoPlus `holders`   |
| Dev wallet <5%      |     10 | GoPlus `creator_*` |

Verdict thresholds: `≥70 APE`, `≥40 CAUTION`, `<40 RUN`.

## Known gaps (intentional, tracked separately)

- KOLs / X activity are zeroed — wired up by TweetScout integration (task #2).
- "Dev wallet: no rug history" needs a creator-history index we don't
  maintain yet; currently we surface only current `creator_percent`.
- No abuse rate-limiting on the Worker; relying on KV caching + Cloudflare
  free-tier limits for now.
