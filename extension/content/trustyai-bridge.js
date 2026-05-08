/* ================================================================
   Trusty AI — trustyai.tech bridge

   Runs only on the public website (trustyai.tech). Copies the
   extension's persistent subId + local watchlist mirror into the
   page's window.localStorage so the website can:

     1. Read the user's subId and fetch /api/watchlist for cloud sync.
     2. Pre-render the watchlist tab using the local mirror while the
        cloud fetch is in flight.

   No pill injection here — the website is our own surface; that
   logic stays scoped to x.com / reddit / dexscreener.
   ================================================================ */
(function () {
  "use strict";
  try {
    chrome.storage.local.get(["trusty_subid_v1", "trusty_watchlist_v1"], function (data) {
      if (data && data.trusty_subid_v1) {
        try { window.localStorage.setItem("trusty_subid_v1", data.trusty_subid_v1); } catch (e) {}
      }
      if (data && Array.isArray(data.trusty_watchlist_v1)) {
        try {
          window.localStorage.setItem(
            "trusty_watchlist_extension_mirror",
            JSON.stringify(data.trusty_watchlist_v1)
          );
        } catch (e) {}
      }
    });

    // Keep the mirror fresh while the user has the website open in
    // another tab — propagate any extension-side change immediately.
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes) {
        if (changes.trusty_watchlist_v1) {
          try {
            window.localStorage.setItem(
              "trusty_watchlist_extension_mirror",
              JSON.stringify(changes.trusty_watchlist_v1.newValue || [])
            );
          } catch (e) {}
        }
        if (changes.trusty_subid_v1 && changes.trusty_subid_v1.newValue) {
          try {
            window.localStorage.setItem("trusty_subid_v1", changes.trusty_subid_v1.newValue);
          } catch (e) {}
        }
      });
    }
  } catch (e) { /* not in extension context */ }
})();
