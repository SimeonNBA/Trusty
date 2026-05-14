#!/usr/bin/env node
/* ================================================================
   warm-goplus.mjs

   Bootstrap the worker's 24h GoPlus cache for popular BSC tokens.

   Why: Cloudflare Worker IPs are rate-limited by GoPlus. The worker
   often can't successfully fetch GoPlus on its own — even with retries.
   This script runs from your machine (or GitHub Actions runner), where
   GoPlus accepts requests normally, fetches the safety data, and POSTs
   it to the worker's /api/admin/warm-goplus endpoint to seed the cache.

   After running, any user scanning these tokens hits the cache and gets
   instant accurate data, without the worker ever needing to call GoPlus.

   Usage:
     TRUSTY_ADMIN_SECRET=xxx node scripts/warm-goplus.mjs
       → reads top 30 BSC tokens from data/trending.json
     TRUSTY_ADMIN_SECRET=xxx node scripts/warm-goplus.mjs 0xabc... 0xdef...
       → warms specific CAs (space-separated)

   Re-running is safe — overwrites cache with fresh data.
   ================================================================ */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ADMIN_SECRET = process.env.TRUSTY_ADMIN_SECRET;
const API_BASE = process.env.TRUSTY_API_BASE || "https://api.trustyai.tech";
const BSC_CHAIN_ID = "56";

if (!ADMIN_SECRET) {
  console.error("Missing TRUSTY_ADMIN_SECRET in env.");
  console.error("Usage: TRUSTY_ADMIN_SECRET=xxx node scripts/warm-goplus.mjs [ca1 ca2 ...]");
  process.exit(1);
}

// Determine which CAs to warm.
let targetCas = process.argv.slice(2).filter(Boolean);

if (!targetCas.length) {
  try {
    const trendingPath = resolve(process.cwd(), "data/trending.json");
    const trending = JSON.parse(readFileSync(trendingPath, "utf8"));
    const cats = trending?.categories || {};
    const pool = [
      ...(cats.bnb || []),
      ...(cats.memes || []),
      ...(cats.ai || []),
    ];
    const seen = new Set();
    for (const t of pool) {
      const ca = (t.assetId || "").toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(ca) && !seen.has(ca)) {
        seen.add(ca);
        targetCas.push(ca);
      }
      if (targetCas.length >= 30) break;
    }
  } catch (e) {
    console.error("Could not read data/trending.json:", e.message);
    process.exit(1);
  }
}

if (!targetCas.length) {
  console.error("No CAs to warm. Pass them as args or ensure data/trending.json has BSC entries.");
  process.exit(1);
}

console.log(`Warming ${targetCas.length} BSC tokens via GoPlus → ${API_BASE}/api/admin/warm-goplus\n`);

async function fetchGoPlus(ca) {
  const url = `https://api.gopluslabs.io/api/v1/token_security/${BSC_CHAIN_ID}?contract_addresses=${ca}`;
  const r = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!r.ok) throw new Error("goplus http " + r.status);
  const data = await r.json();
  const entry = data?.result?.[ca] || data?.result?.[ca.toLowerCase()] || null;
  if (!entry || !Object.keys(entry).length) throw new Error("goplus empty result");
  return entry;
}

async function postWarm(ca, goplus) {
  const r = await fetch(API_BASE + "/api/admin/warm-goplus", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": ADMIN_SECRET,
    },
    body: JSON.stringify({ chain: "bsc", ca, goplus }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error("warm http " + r.status + ": " + text);
  }
  return await r.json();
}

let ok = 0, fail = 0;
for (const rawCa of targetCas) {
  const ca = rawCa.toLowerCase().trim();
  process.stdout.write(`  ${ca}  `);
  try {
    const gp = await fetchGoPlus(ca);
    const res = await postWarm(ca, gp);
    if (res.ok) {
      ok++;
      console.log("✓ cached");
    } else {
      fail++;
      console.log("✗ worker rejected:", JSON.stringify(res));
    }
  } catch (e) {
    fail++;
    console.log("✗", e.message);
  }
  // Gentle pacing — 200ms between calls so we don't hammer GoPlus ourselves.
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\nDone. Cached ${ok}, failed ${fail}.`);
console.log("Next: visit trustyai.tech or X — scans of these tokens hit the warm cache instantly.");
