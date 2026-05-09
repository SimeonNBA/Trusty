# Plain-English breakdown of each safety check

When `assess_token` returns a verdict, the `checks` and `paidChecks`
arrays use one-line labels. This reference explains what each check
actually means, why it matters, and how to surface failures to a
non-technical user.

## EVM checks (BSC, Ethereum, Polygon, Base)

### `Not a honeypot`

**What it tests:** can the token actually be sold after buying?
Some malicious contracts let you buy but block sells.

**Failure means:** you'd buy the token but never be able to exit your
position. Total loss.

**How to explain:** *"This contract has a hidden block on selling.
You'd be stuck holding tokens you can't dump."*

### `Sell tax X%` (or `Sell tax data unavailable`)

**What it tests:** percentage of every sell that's redirected to the
contract owner / treasury.

**Failure means:**
- Sell tax > 5% = real cost on every exit; cuts into gains
- Sell tax > 50% = de-facto honeypot via tax mechanism
- "Owner can change tax" (paid check) = tax can be raised to 99%
  after you buy = honeypot trap

**How to explain:** *"Selling this token costs X% extra — every time
you exit, X% of the sale goes to the contract owner."*

### `LP locked`

**What it tests:** is the liquidity pool token (which lets the dev
withdraw liquidity from a DEX) locked in a time-lock contract or
burned?

**Failure means:** the dev can pull all the liquidity out at any
moment — a "rug pull". Price goes to zero instantly.

**How to explain:** *"The dev still controls the trading pool. They
can drain it at any moment and your tokens become worthless."*

### `Mint disabled`

**What it tests:** can the contract owner mint more tokens after
deployment?

**Failure means:** owner can dilute supply infinitely. Your % of
supply gets diluted into nothing if they print enough.

**How to explain:** *"The owner can create unlimited new tokens at
will. Your share can be diluted to zero whenever they decide."*

### `Contract renounced`

**What it tests:** did the deployer renounce ownership (transferring
ownership to a burn address like `0x000…dead`)?

**Failure means:** the deployer still has admin powers — could
include changing tax, blacklisting wallets, pausing trading. Even if
none of those are active right now, the option exists.

**How to explain:** *"The deployer still owns this contract and could
change its rules at any time."*

## Solana-specific checks

### `Mint authority disabled`

**Equivalent of EVM "Mint disabled".** Solana SPL tokens have a
distinct `mint_authority` field that, when set, lets the holder mint
new tokens. Should be `null` for trustless tokens.

### `Freeze authority disabled`

**Solana-specific.** Lets the holder freeze any wallet, blocking
that wallet from transferring the token. Active freeze authority =
the dev can freeze your wallet on their whim.

**How to explain:** *"The dev can freeze your wallet, locking your
tokens so you can't sell or transfer."*

### `LP locked (RugCheck)`

Trusty cross-checks Solana LP-locked status with **RugCheck.xyz**
because GoPlus's Solana endpoint frequently misses Pump.fun graduates
where LP is auto-burned at migration. RugCheck's `lpLockedPct` is the
authoritative source on Solana.

## Paid-tier checks

`paidChecks` extends the headline 5 with deeper findings only the
paid tier surfaces in the UI. Examples:

- `No blacklist function` — owner can't block specific wallets
- `Open source` — contract source is verified on the explorer
- `No proxy admin` — contract isn't a proxy whose implementation
  could be swapped
- `Holders not concentrated` — no single wallet holds >5% of supply

These are all good-to-have signals; verdicts and scores are computed
primarily from the headline 5.

## When upstream is degraded

If a check label contains `"data unavailable"`, the underlying source
(GoPlus, RugCheck, Honeypot.is) didn't respond. Don't treat that as a
red flag — surface as "we couldn't verify this right now" and offer
to retry.

## Verdict math

The score is roughly: each passing headline check contributes ~15
points, each passing paid check contributes ~3 points, capped at
100. A single hard-fail check (honeypot, LP unlocked) caps the score
much lower. Don't try to recompute the verdict from the checks
yourself — use the `verdict` field directly.
