/* ================================================================
   Trusty — Background service worker

   In Manifest V3, this is the only persistent JS context the
   extension has. Day 1 just logs install events.
   Future: handles caching, tier checks, cross-tab messaging.
   ================================================================ */

chrome.runtime.onInstalled.addListener(function (details) {
  console.log("🛡️ Trusty installed:", details.reason);
  // details.reason is "install" on first install, "update" on version bumps
});

chrome.runtime.onStartup.addListener(function () {
  console.log("🛡️ Trusty: browser started, extension ready.");
});
