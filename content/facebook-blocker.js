(() => {
  "use strict";

  // Only allow Facebook Marketplace and Groups (car groups for learning car
  // symptoms / common problems). Block everything else to prevent doom
  // scrolling on the feed, reels, and video pages.

  const ALLOWED = [
    (p) => p.startsWith("/marketplace"),
    (p) => p.startsWith("/groups"),
    (p) => p.startsWith("/login"),
    (p) => p.startsWith("/sharer"),
  ];

  const BLOCKED = [
    (p) => p.startsWith("/reel"),
    (p) => p.startsWith("/reels"),
    (p) => p.startsWith("/watch"),
    (p) => p.startsWith("/videos"),
    (p) => p.startsWith("/video"),
    (p) => p.startsWith("/stories"),
    (p) => p.startsWith("/story"),
    (p) => p.startsWith("/games"),
    (p) => p.startsWith("/gaming"),
    (p) => p.startsWith("/fyp"),
    (p) => p.startsWith("/shorts"),
    (p) => p.startsWith("/live"),
    (p) => p === "/",
    (p) => p === "/home",
    (p) => p === "/home.php",
  ];

  const BLOCKED_MESSAGE =
    "This page is blocked to keep you focused.\n\n" +
    "You can still use Marketplace and Groups.";

  function isAllowed(path) {
    return ALLOWED.some((fn) => fn(path));
  }

  function isBlocked(path) {
    // Explicit blocked patterns win over the generic homepage.
    return BLOCKED.some((fn) => fn(path));
  }

  function redirectToMarketplace() {
    location.replace("https://www.facebook.com/marketplace/");
  }

  function handleNavigation() {
    const path = location.pathname;

    // Ignore if we're already on an allowed page.
    if (isAllowed(path)) return;

    if (isBlocked(path)) {
      // Block the doom-scroll pages: replace content and stop interaction.
      blockPage();
      return;
    }

    // Any other Facebook page (profile, feed, stories, etc.) -> redirect.
    redirectToMarketplace();
  }

  function blockPage() {
    // Nuke the document as early as possible.
    document.documentElement.innerHTML =
      '<body style="margin:0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#18191a;color:#e4e6eb">' +
      '<div style="text-align:center;max-width:420px;padding:32px">' +
      '<div style="font-size:56px;margin-bottom:16px">⛔</div>' +
      '<h1 style="font-size:24px;margin:0 0 12px">Blocked</h1>' +
      '<p style="font-size:15px;line-height:1.5;color:#b0b3b8;white-space:pre-line">' +
      BLOCKED_MESSAGE +
      "</p>" +
      '<button id="fb-blocker-go" style="margin-top:20px;padding:10px 20px;background:#0866ff;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer">Go to Marketplace</button>' +
      "</div></body>";

    const btn = document.getElementById("fb-blocker-go");
    if (btn) btn.addEventListener("click", redirectToMarketplace);

    // Keep redirecting if Facebook pushes a new URL (SPA navigation).
    history.pushState = new Proxy(history.pushState, {
      apply(target, thisArg, args) {
        return target.apply(thisArg, args);
      },
    });
  }

  // Run immediately and re-check on SPA navigation.
  handleNavigation();

  window.addEventListener("popstate", handleNavigation);
  window.addEventListener("hashchange", handleNavigation);

  // Periodically re-assert in case Facebook renders client-side.
  let interval = setInterval(handleNavigation, 1500);
  window.addEventListener("beforeunload", () => clearInterval(interval));
})();
