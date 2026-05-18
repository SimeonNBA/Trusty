/* ================================================================
   Trusty — Contract Address detector

   Shared library used by all platform content scripts.
   Day 1: just the regex constants and a single utility function.
   Day 2: this file gets the actual scanning logic for tweet text.
   ================================================================ */

(function () {
  "use strict";

  // EVM address: 0x followed by 40 hex characters
  // Solana address: 32-44 base58 characters (no 0/O/I/l)
  const EVM_REGEX = /\b0x[a-fA-F0-9]{40}\b/g;
  const SOLANA_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

  // Cashtags: $TICKER (2-12 alphanumeric chars after $). Allows tokens
  // like $4 from CZ Meta even though they're short — server resolves
  // against scan history to filter out non-token mentions.
  const CASHTAG_REGEX = /\$[A-Za-z0-9]{1,12}\b/g;

  // Hashtags: #ticker. We accept the same alphanumeric set as cashtags,
  // plus normalize to uppercase for symref lookups. Generic English
  // hashtags (#crypto, #trading) get filtered server-side because
  // there's no scan-history entry for those "symbols".
  const HASHTAG_REGEX = /#[A-Za-z0-9_]{2,20}\b/g;

  /**
   * Find all contract addresses inside a string.
   * Returns array of { ca, chain } objects.
   */
  function findContractAddresses(text) {
    if (!text || typeof text !== "string") return [];
    const found = [];

    // EVM matches
    const evm = text.match(EVM_REGEX);
    if (evm) {
      for (const ca of evm) {
        found.push({ ca, chain: "evm" });
      }
    }

    // Solana matches — skip anything that already matched EVM
    const sol = text.match(SOLANA_REGEX);
    if (sol) {
      for (const ca of sol) {
        // Solana regex is permissive; double-check it's not an EVM address
        if (ca.startsWith("0x")) continue;
        // Length sanity — Solana mints are typically 43-44 chars
        if (ca.length < 32) continue;
        found.push({ ca, chain: "solana" });
      }
    }

    return found;
  }

  /**
   * Extract token ticker symbols from text — both cashtags ($SYMBOL)
   * and hashtags (#symbol). Returns dedupd uppercase symbols. The
   * server is responsible for filtering non-tokens by checking scan
   * history (no scan history for that symbol → not a token).
   */
  function findTickerSymbols(text) {
    if (!text || typeof text !== "string") return [];
    const seen = new Set();
    const cash = text.match(CASHTAG_REGEX) || [];
    const hash = text.match(HASHTAG_REGEX) || [];
    for (const m of cash) {
      const sym = m.slice(1).toUpperCase();
      if (sym) seen.add(sym);
    }
    for (const m of hash) {
      const sym = m.slice(1).toUpperCase();
      if (sym) seen.add(sym);
    }
    return Array.from(seen);
  }

  // Expose globally so content scripts can use it
  window.TrustyCA = {
    findContractAddresses,
    findTickerSymbols,
    EVM_REGEX,
    SOLANA_REGEX,
    CASHTAG_REGEX,
    HASHTAG_REGEX
  };
})();
