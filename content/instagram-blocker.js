(() => {
  "use strict";

  // Only allow a profile page (URL contains a username). Block everything
  // else (home feed, explore, reels, direct, stories) to prevent doom
  // scrolling.

  const RESERVED = new Set([
    "explore",
    "reels",
    "reel",
    "direct",
    "p",
    "tv",
    "stories",
    "story",
    "accounts",
    "about",
    "legal",
    "press",
    "api",
    "privacy",
    "developer",
  ]);

  const BLOCKED_MESSAGE =
    "This page is blocked to keep you focused.\n\n" +
    "You can still view profiles and their posts / reels.";

  function isProfile(path) {
    const seg = path.split("/").filter(Boolean)[0] || "";
    return seg.length > 0 && !RESERVED.has(seg.toLowerCase());
  }

  function blockPage() {
    document.documentElement.innerHTML =
      '<body style="margin:0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#000;color:#fafafa">' +
      '<div style="text-align:center;max-width:420px;padding:32px">' +
      '<div style="font-size:56px;margin-bottom:16px">⛔</div>' +
      '<h1 style="font-size:24px;margin:0 0 12px">Blocked</h1>' +
      '<p style="font-size:15px;line-height:1.5;color:#a8a8a8;white-space:pre-line">' +
      BLOCKED_MESSAGE +
      "</p>" +
      "</div></body>";
  }

  function handleNavigation() {
    const path = location.pathname;

    if (isProfile(path)) {
      // Allowed: a profile page (username in URL). Leave it alone.
      return;
    }

    blockPage();
  }

  handleNavigation();

  window.addEventListener("popstate", handleNavigation);
  window.addEventListener("hashchange", handleNavigation);

  // Re-assert in case Instagram renders client-side.
  let interval = setInterval(handleNavigation, 1500);
  window.addEventListener("beforeunload", () => clearInterval(interval));
})();
