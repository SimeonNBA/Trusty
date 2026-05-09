# `get_watchlist` — read a user's saved tokens

The watchlist is the cloud-synced list of contract addresses a user
has saved through the Trusty extension or website. The agent can
read it on the user's behalf — but only if the user passes their
`subId`.

## Endpoint

```
GET https://api.trustyai.tech/api/watchlist?subId=<subId>
```

### `subId` — what it is, where it comes from

`subId` is a 22-character base64url-safe random identifier generated
once per Trusty install. It's stored in `chrome.storage.local`
(extension) and mirrored into `localStorage` (website) so both
surfaces sync to the same cloud watchlist.

If the user has the Trusty extension installed and visits
`trustyai.tech`, the bridge content script copies the extension's
`subId` into the page's `localStorage` under the key
`trusty_subid_v1`. From an agent context, the agent should ask the
user to provide their `subId` (or use whatever in-skill mechanism
the host platform exposes for cross-tool identity).

**Privacy:** `subId` is the only identifier we store server-side.
There's no email, no wallet address, no IP-based tracking. A user can
rotate their `subId` at any time by reinstalling the extension.

### Example

```bash
curl 'https://api.trustyai.tech/api/watchlist?subId=abc123_DEF456-ghi'
```

## Response shape

```jsonc
{
  "items": [
    {
      "ca":      "0x65aea108c21439693468FCD542D81C29E8df4444",
      "chain":   "bsc",
      "symbol":  "TRUSTY",
      "name":    "Trusty AI",
      "addedAt": 1746012345000   // ms since epoch
    },
    // …
  ]
}
```

The list is in reverse-chronological order (most recently added
first). Free users have a 5-item cap; paid subscribers are uncapped
(server-side soft cap of 100 to keep the cloud sync sensible).

## Common patterns

### "Show my watchlist"

Call `get_watchlist`, list the symbols + names. If the user wants
the safety status on each, follow up with `assess_token` for any
they ask about — don't auto-call assess for every saved token (that
could be 100 calls).

### "What's the safety status of my watchlist right now?"

Call `get_watchlist`, then iterate `assess_token(ca, chain)` on each
item. Cap at 10 unless the user asks for more. The scan endpoint is
cached at 5 min so re-reads are cheap.

### "Add this token to my watchlist"

Out of scope for `trusty-safety`. The skill is read-only by design.
Adding to watchlist requires a `POST` from inside the Trusty
extension's authenticated context — it's not exposed for agent
write-back. If the user wants to add, direct them to click the star
icon on the Trusty pill.

## Errors

If `subId` is missing or doesn't exist server-side, the endpoint
returns `{ "items": [] }` with status 200 — there's no auth error
because we don't have an auth concept here. Treat empty list as
"either no saved tokens or invalid subId" and ask the user to
reconnect their Trusty install if they expected items.
