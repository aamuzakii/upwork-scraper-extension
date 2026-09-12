(() => {
  "use strict";

  // Block ONLY the doom-scroll surfaces (feed, reels, watch, videos, stories,
  // games). Everything else — marketplace, groups, report dialogs, settings,
  // notifications — is left alone.

  const BLOCKED = [
    // (p) => p.startsWith("/reel"),
    // (p) => p.startsWith("/reels"),
    // (p) => p.startsWith("/watch"),
    // (p) => p.startsWith("/videos"),
    // (p) => p.startsWith("/video"),
    // (p) => p.startsWith("/stories"),
    // (p) => p.startsWith("/story"),
    // (p) => p.startsWith("/games"),
    // (p) => p.startsWith("/gaming"),
    // (p) => p.startsWith("/fyp"),
    // (p) => p.startsWith("/shorts"),
    // (p) => p.startsWith("/live"),
    (p) => p === "/",
    (p) => p === "/home",
    (p) => p === "/home.php",
  ];

  const BLOCKED_MESSAGE =
    "This page is blocked to keep you focused.\n\n" +
    "You can still use Marketplace and Groups.";

  const REDIRECT_URL =
    "https://ilmiyyah.com/halaqah-silsilah-ilmiyah/belajar-tauhid";

  function isBlocked(path) {
    return BLOCKED.some((fn) => fn(path));
  }

  function redirectToMarketplace() {
    location.replace(REDIRECT_URL);
  }

  function handleNavigation() {
    const path = location.pathname;

    if (!isBlocked(path)) return; // allow everything else

    blockPage();
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
      '<button id="fb-blocker-go" style="margin-top:20px;padding:10px 20px;background:#0866ff;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer">Belajar Tauhid</button>' +
      "</div></body>";

    const btn = document.getElementById("fb-blocker-go");
    if (btn) btn.addEventListener("click", redirectToMarketplace);
  }

  // Run immediately and re-check on SPA navigation.
  handleNavigation();

  window.addEventListener("popstate", handleNavigation);
  window.addEventListener("hashchange", handleNavigation);

  // Periodically re-assert in case Facebook renders client-side.
  let interval = setInterval(handleNavigation, 1500);
  window.addEventListener("beforeunload", () => clearInterval(interval));
})();
