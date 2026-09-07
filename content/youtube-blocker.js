(() => {
  "use strict";

  // Hide YouTube video suggestions / recommendations while watching a single
  // video, so you can't doom scroll. Search results are left untouched.

  // Selectors for the related/suggestion content.
  const SELECTORS = [
    "lazy-list", // related videos container (newer YouTube layout)
    "ytd-watch-next-secondary-results-renderer", // sidebar wrapper
    "ytd-compact-video-renderer", // individual suggestion cards
    "ytd-reel-shelf-renderer", // shorts shelf inside watch page
    "ytd-rich-shelf-renderer", // shorts shelf on home
    "#related", // legacy related container
    "#secondary", // legacy sidebar
    "ytd-item-section-renderer #items", // item sections
  ];

  function hideSuggestions() {
    SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.display = "none";
      });
    });
  }

  // Hide on load and keep hiding on SPA navigation / dynamic renders.
  hideSuggestions();

  // Observe DOM changes so late-rendered suggestions also get hidden.
  const observer = new MutationObserver(hideSuggestions);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Re-check on navigation events.
  window.addEventListener("yt-navigate-finish", hideSuggestions);
  window.addEventListener("popstate", hideSuggestions);

  // Periodic fallback.
  const interval = setInterval(hideSuggestions, 2000);
  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    clearInterval(interval);
  });
})();
