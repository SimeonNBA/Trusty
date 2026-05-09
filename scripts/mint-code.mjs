#!/usr/bin/env node
/* ================================================================
   mint-code.mjs — admin tool for minting Trusty redemption codes

   Usage:
     TRUSTY_ADMIN_SECRET=xxx node scripts/mint-code.mjs <type> [opts]

   Examples:
     # Lifetime code for a whale (one-use, never expires)
     TRUSTY_ADMIN_SECRET=xxx node scripts/mint-code.mjs lifetime --notes "whale-czoffshoot"

     # Monthly promo code (one-use, gives 30 days when redeemed)
     TRUSTY_ADMIN_SECRET=xxx node scripts/mint-code.mjs monthly --notes "TG-promo-may"

     # Trial-7d code with 50 uses (50 different installs can each
     # claim 7 days of access — for community drops)
     TRUSTY_ADMIN_SECRET=xxx node scripts/mint-code.mjs trial-7d --max 50 --notes "BSC-degen-drop"

   Set the admin secret once in your shell profile so you don't have to
   paste it every time:
     export TRUSTY_ADMIN_SECRET="your-secret-here"

   The secret must match what you set in Cloudflare:
     npx wrangler secret put ADMIN_SECRET --config api/wrangler.toml
   ================================================================ */

const API_BASE = process.env.TRUSTY_API_BASE || "https://api.trustyai.tech";
const SECRET = process.env.TRUSTY_ADMIN_SECRET || "";

if (!SECRET) {
  console.error("ERROR: set TRUSTY_ADMIN_SECRET in your env first.");
  console.error("       export TRUSTY_ADMIN_SECRET=\"<the secret you set in wrangler>\"");
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.length || args[0] === "-h" || args[0] === "--help") {
  console.log("Usage: node mint-code.mjs <type> [--max N] [--notes \"reason\"]");
  console.log("Types: lifetime | yearly | monthly | trial-7d");
  process.exit(0);
}

const type = args[0];
const allowedTypes = ["lifetime", "yearly", "monthly", "trial-7d"];
if (!allowedTypes.includes(type)) {
  console.error(`ERROR: type must be one of: ${allowedTypes.join(", ")}`);
  process.exit(1);
}

let maxUses = 1;
let notes = "";
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--max" && args[i + 1]) { maxUses = parseInt(args[++i], 10) || 1; }
  else if (args[i] === "--notes" && args[i + 1]) { notes = args[++i]; }
}

const body = { type, maxUses, notes };

try {
  const r = await fetch(`${API_BASE}/api/admin/mint-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": SECRET,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    console.error(`ERROR ${r.status}:`, (data && data.error) || "request failed");
    process.exit(1);
  }
  console.log("");
  console.log("  ┌─────────────────────────────────────────┐");
  console.log(`  │  ${data.code}             │`);
  console.log("  └─────────────────────────────────────────┘");
  console.log("");
  console.log(`  type:     ${data.type}`);
  console.log(`  maxUses:  ${data.maxUses}`);
  if (data.notes) console.log(`  notes:    ${data.notes}`);
  console.log(`  created:  ${new Date(data.createdAt).toISOString()}`);
  console.log("");
  console.log("  → DM this code to the user. They paste it in the");
  console.log("    extension popup under \"Have a code? Redeem here\".");
  console.log("");
} catch (e) {
  console.error("ERROR: network failure —", e.message);
  process.exit(1);
}
