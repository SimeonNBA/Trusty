// Build a weekly receipt + manifest for the Greenfield bucket.
//
//   cd /d/Trusty-AI/frontend
//   node scripts/build-receipt.mjs
//
// Reads ADMIN_SECRET from api/.dev.vars, calls the (read-only)
// publish-receipt endpoint, and writes two files to the repo root:
//   <week>.json     — the receipt
//   manifest.json   — points the receipts viewer at it
// Upload BOTH to the trusty-ai-receipts bucket in dCellar (public-read).

import { readFileSync, writeFileSync } from "node:fs";

function readAdminSecret() {
  const txt = readFileSync("api/.dev.vars", "utf8");
  const m = txt.match(/^ADMIN_SECRET\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("ADMIN_SECRET not found in api/.dev.vars");
  return m[1].trim();
}

const secret = readAdminSecret();
const url = `https://api.trustyai.tech/api/admin/publish-receipt?admin=${encodeURIComponent(secret)}`;

console.log("Fetching live receipt…");
const res = await fetch(url);
const j = await res.json();

if (!j || j.error) {
  console.error("FAILED:", (j && j.error) || res.status, "\n(is the worker deployed? is the secret right?)");
  process.exit(1);
}

const week = j.week || "latest";
const file = `${week}.json`;
writeFileSync(file, JSON.stringify(j));

const manifest = {
  updatedAt: new Date().toISOString(),
  weeks: [
    { week, label: "Week of " + (j.dateRange || week), dateRange: j.dateRange || "", file },
  ],
};
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2));

console.log("");
console.log("✅ Wrote 2 files to D:\\Trusty-AI\\frontend\\ :");
console.log("   " + file);
console.log("   manifest.json");
console.log("");
console.log("   totalScans :", j.totalScans);
console.log("   scorecard  :", j.scorecard ? "present ✓" : "MISSING ✗  (redeploy the worker, then re-run)");
console.log("   performance:", (j.performance || []).length, "tokens");
console.log("");
console.log("Next: upload BOTH files to the trusty-ai-receipts bucket in dCellar (public-read).");
