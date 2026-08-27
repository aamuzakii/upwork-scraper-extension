(() => {
  const BLOCKED_TITLES = ["ayla", "agya", "sigra", "mobilio"];
  const BLOCKED_IDS = new Set();

  function isCarPage() {
    return location.pathname.includes("mobil");
  }

  function getListings() {
    return document.querySelectorAll("li[data-aut-id]");
  }

  function getListingId(listing) {
    const id = listing.id || "";
    return id.replace(/^item-card-/, "");
  }

  function getTitle(listing) {
    const text = [listing.textContent, listing.querySelector("a")?.href]
      .filter(Boolean)
      .join(" ");
    return text.toLowerCase();
  }

  function shouldHide(listing) {
    const autId = listing.getAttribute("data-aut-id");
    if (autId !== "itemBox") return true;
    if (BLOCKED_IDS.has(getListingId(listing))) return true;
    const title = getTitle(listing);
    return BLOCKED_TITLES.some((word) => title.includes(word));
  }

  function hideListing(listing) {
    const id = getListingId(listing);
    if (id) BLOCKED_IDS.add(id);
    listing.style.filter = "blur(4px)";
    listing.style.opacity = "0.4";
  }

  function processListings() {
    getListings().forEach((listing) => {
      if (shouldHide(listing)) {
        const title = getTitle(listing);
        console.log(`[olx-car] making the card "${title}" blurry`);
        hideListing(listing);
      }
    });
  }

  let scheduled = false;

  function scheduleProcess() {
    if (scheduled) return;
    scheduled = true;
    processListings();
    setTimeout(() => {
      scheduled = false;
    }, 100);
  }

  const observer = new MutationObserver(scheduleProcess);

  function start() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("scroll", scheduleProcess, { passive: true });
    processListings();
  }

  function startAfterPageLoad() {
    window.setTimeout(start, 1000);
  }

  if (isCarPage()) {
    if (document.readyState === "complete") {
      startAfterPageLoad();
    } else {
      window.addEventListener("load", startAfterPageLoad, { once: true });
    }
  }
})();