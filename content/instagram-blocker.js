(() => {
  "use strict";

  // Only block the home feed (root path "/"). Everything else (profiles,
  // explore, reels, direct, stories) stays available.

  const BLOCKED_MESSAGE =
    "The feed is blocked to keep you focused.\n\n" +
    "You can still view profiles, explore, reels, and everything else.";

  function isFeed(path) {
    return path === "/" || path === "";
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

    if (!isFeed(path)) {
      // Allowed: anything that isn't the home feed.
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
