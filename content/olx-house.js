(() => {
  // Supabase publishable key is safe to ship in browser clients. Keep in sync
  // with config/supabase.js because content scripts are loaded as classic scripts.
  const SUPABASE_URL = "https://gxilidqhjdtnsnvuxjse.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_brZJLfUERmGBgXyyrL_tzQ_XqBbtnMj";

  const HOUSES_TABLE = "houses";
  const SOURCE = "olx";

  const BLOCKED_LOCATIONS = [
    "pamulang",
    "beji",
    "pancoran",
    "sawangan",
    "bojongsari",
  ];

  // Session-level dedupe so scrolling the same page doesn't spam the API.
  const seenIds = new Set();

  function isHousePage() {
    return location.pathname.includes("rumah");
  }

  function getListings() {
    return document.querySelectorAll("li[data-aut-id='itemBox']");
  }

  function getListingId(listing) {
    const fromId = (listing.id || "").replace(/^item-card-/, "");
    if (fromId) return fromId;

    const href = listing.querySelector("a")?.href || "";
    const match = href.match(/iid-(\d+)/);
    return match ? match[1] : "";
  }

  function getUrl(listing) {
    const href = listing.querySelector("a")?.href || "";
    return href ? new URL(href, location.origin).href.split("?")[0] : "";
  }

  // Collect every image URL on the card: the <img src> plus all srcset entries
  // (OLX serves the same photo at many resolutions via srcset). Deduped.
  function getImages(listing) {
    const urls = [];

    listing.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (src) urls.push(src);

      const srcset = img.getAttribute("srcset");
      if (srcset) {
        srcset.split(",").forEach((entry) => {
          const url = entry.trim().split(/\s+/)[0];
          if (url) urls.push(url);
        });
      }
    });

    return [...new Set(urls)];
  }

  function parsePrice(text) {
    if (!text) return null;
    const digits = text.replace(/\D/g, "");
    return digits ? Number(digits) : null;
  }

  function getLocationText(listing) {
    return (
      listing
        .querySelector('span[data-aut-id="item-location"]')
        ?.textContent?.trim()
        .toLowerCase() || ""
    );
  }

  function isBlockedLocation(listing) {
    const location = getLocationText(listing);
    return BLOCKED_LOCATIONS.some((word) => location.includes(word));
  }

  function hideListing(listing) {
    listing.style.display = "none";
  }

  function extractListing(listing) {
    const listingId = getListingId(listing);
    const url = getUrl(listing);

    if (!listingId || !url) return null;

    const priceText =
      listing.querySelector('[data-aut-id="itemPrice"]')?.textContent?.trim() ||
      "";

    return {
      source: SOURCE,
      listing_id: listingId,
      url,
      images: getImages(listing),
      price: parsePrice(priceText),
    };
  }

  async function postToSupabase(rows) {
    const url = new URL(`/rest/v1/${HOUSES_TABLE}`, SUPABASE_URL);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Supabase ${HOUSES_TABLE} returned ${response.status}: ${body.slice(0, 300)}`,
      );
    }
  }

  async function flush(listings) {
    if (listings.length === 0) return;

    const rows = [];
    for (const listing of listings) {
      const data = extractListing(listing);
      if (!data || seenIds.has(data.listing_id)) continue;

      seenIds.add(data.listing_id);
      rows.push(data);
    }

    if (rows.length === 0) return;

    try {
      await postToSupabase(rows);
      console.log(`[olx-house] saved ${rows.length} house(s)`);
    } catch (error) {
      // Put ids back so we retry on the next scroll tick.
      rows.forEach((row) => seenIds.delete(row.listing_id));
      console.error("[olx-house] flush failed:", error);
    }
  }

  let scheduled = false;
  let pending = [];

  function scheduleFlush() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      const batch = pending;
      pending = [];
      flush(batch);
    }, 600);
  }

  function processListings() {
    const fresh = [];

    getListings().forEach((listing) => {
      if (isBlockedLocation(listing)) {
        hideListing(listing);
        return;
      }

      const id = getListingId(listing);
      if (!id || seenIds.has(id)) return;

      fresh.push(listing);
    });

    if (fresh.length === 0) return;
    pending.push(...fresh);
    scheduleFlush();
  }

  const observer = new MutationObserver(processListings);

  function start() {
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", processListings, { passive: true });
    processListings();
  }

  function startAfterPageLoad() {
    window.setTimeout(start, 1000);
  }

  if (isHousePage()) {
    if (document.readyState === "complete") {
      startAfterPageLoad();
    } else {
      window.addEventListener("load", startAfterPageLoad, { once: true });
    }
  }
})();