# Pre-trade audit pattern

Read this before invoking any swap, buy, or transfer skill. The whole
point of `trusty-safety` in an agent context is to make "assess
before trade" the default flow, so users don't ape into honeypots.

## The pattern

```
1. User says "swap X for Y" or "buy this token"
2. Agent calls assess_token(ca, chain) FIRST
3. Branch on verdict:
     APE      → surface key checks + score, ask user to confirm,
                then proceed to swap-quote skill
     CAUTION  → surface specific yellow flags, require explicit
                user confirmation before proceeding
     RUN      → refuse to auto-proceed; surface red flags; offer to
                explain why; only proceed if user explicitly
                overrides
4. Only AFTER the user has seen the verdict, call the trading skill
```

The agent should never go from "user said swap" directly to "agent
called swap". The assess step in between is the safety contract.

## Example dialogues

### APE verdict — happy path

```
user:  swap 0.1 BNB for 0x65aea1…
agent: [calls assess_token(ca="0x65aea1…", chain="bsc")]
       → { verdict: "APE", score: 78, checks: [
           { ok: true, label: "Not a honeypot" },
           { ok: true, label: "Sell tax 0%" },
           { ok: true, label: "LP locked" },
           { ok: true, label: "Mint disabled" },
           { ok: true, label: "Contract renounced" }
         ], marketData: { mcap: "$2.4M", liquidity: "$340K" } }

       Trusty rates this APE (78/100). All 5 safety checks pass:
       not a honeypot, 0% sell tax, LP locked, mint disabled,
       contract renounced. Market cap $2.4M, liquidity $340K.

       Want to proceed with the swap?

user:  yes
agent: [proceeds to swap-quote skill]
```

### CAUTION verdict — yellow flags surfaced

```
user:  buy this token: 0xabcd…
agent: [calls assess_token]
       → { verdict: "CAUTION", score: 52, checks: [
           { ok: true,  label: "Not a honeypot" },
           { ok: false, label: "Sell tax 8%" },
           { ok: true,  label: "LP locked" },
           { ok: true,  label: "Mint disabled" },
           { ok: false, label: "Contract not renounced" }
         ] }

       Trusty rates this CAUTION (52/100). Two yellow flags:

       • Sell tax is 8% — every exit costs you 8% on top of slippage.
       • Contract isn't renounced — the deployer still has admin
         powers and could change rules later.

       Want to proceed anyway?

user:  yeah, small position
agent: [proceeds to swap-quote skill]
```

### RUN verdict — refuse auto-proceed

```
user:  ape 1 BNB into 0xrugged…
agent: [calls assess_token]
       → { verdict: "RUN", score: 12, checks: [
           { ok: false, label: "HONEYPOT — sells blocked" },
           { ok: false, label: "Sell tax 99%" },
           { ok: false, label: "LP unlocked" },
           { ok: true,  label: "Mint disabled" },
           { ok: false, label: "Contract not renounced" }
         ] }

       I can't auto-proceed with this swap. Trusty rates it RUN
       (12/100). Three hard red flags:

       • This is a honeypot — sells are blocked. You'd buy and
         never be able to exit.
       • Sell tax is 99% even if you could sell.
       • LP is unlocked — the dev can drain liquidity any moment.

       If you still want to proceed despite this, please confirm
       explicitly by saying "I understand the risk — proceed anyway."

user:  no, skip it
```

## Why "refuse auto-proceed on RUN" matters

In agent contexts, the user's "swap X" intent often comes from a
shilled link, a Telegram drop, or a Twitter post — exactly the
pipeline most rugs use. The agent is the user's last line of defense.
Catching a single honeypot per user is worth more than every smooth
swap, because honeypots are 100% loss while smooth swaps are
optional.

When in doubt, surface and ask. Agents that auto-execute trades on
RUN verdicts are creating more user damage than they prevent.

## Do NOT call this skill if

- The user is asking about a token they already hold (e.g. "what's
  my $TRUSTY balance"). That's a portfolio query, not a pre-trade
  audit. Use the wallet skill.
- The user is just researching ("tell me about token X"). For those,
  call `assess_token` directly via `references/assess.md` and explain
  the result with `references/explain.md` — there's no swap to gate.

This skill is specifically for the *pre-trade* gate.
