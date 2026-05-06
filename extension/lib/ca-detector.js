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

  // Expose globally so content scripts can use it
  window.TrustyCA = {
    findContractAddresses,
    EVM_REGEX,
    SOLANA_REGEX
  };
})();
