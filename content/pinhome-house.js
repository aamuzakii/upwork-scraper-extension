(() => {
  // Supabase publishable key is safe to ship in browser clients. Keep in sync
  // with config/supabase.js because content scripts are loaded as classic scripts.
  const SUPABASE_URL = "https://gxilidqhjdtnsnvuxjse.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_brZJLfUERmGBgXyyrL_tzQ_XqBbtnMj";

  const HOUSES_TABLE = "houses";
  const SOURCE = "pinhome";

  // Only keep listings in these locations; everything else is ignored entirely.
  const ALLOWED_LOCATIONS = ["cinere", "limo"];

  // Session-level dedupe so scrolling the same page doesn't spam the API.
  const seenIds = new Set();

  // Ids already present in the DB (loaded once on page load). Any listing whose
  // id is in here gets hidden from the UI and skipped on subsequent scrapes.
  let knownIds = new Set();

  function isHousePage() {
    return location.pathname.includes("/rumah");
  }

  // Pinhome uses CSS-module hashed class names (e.g. "pin-card___n7cfs"). The
  // hash suffix changes on redeploy, so match on the stable semantic prefix.
  // The outer card uses "pin-card___" (block + hash); nested elements use
  // "pin-card__" (BEM element), so "pin-card___" uniquely selects the card.
  function getListings() {
    return document.querySelectorAll('div[class*="pin-card___"]');
  }

  // Pinhome cards have no numeric id; use the URL slug as the stable identifier.
  function getListingId(listing) {
    const href = listing.querySelector('a[class*="pin-card__link"]')?.href || "";
    if (!href) return "";

    const path = new URL(href, location.origin).pathname;
    const slug = path.split("/").filter(Boolean).pop() || "";
    return slug;
  }

  function getUrl(listing) {
    const href = listing.querySelector('a[class*="pin-card__link"]')?.href || "";
    return href ? new URL(href, location.origin).href.split("?")[0] : "";
  }

  // Collect every image URL on the card (carousel images). Deduped.
  function getImages(listing) {
    const urls = [];

    listing
      .querySelectorAll('img[class*="pin-carousel__item-image"]')
      .forEach((img) => {
        const src = img.getAttribute("src");
        if (src) urls.push(src);
      });

    return [...new Set(urls)];
  }

  // Pinhome prices look like "Rp 65 Juta/Tahun", "Rp 1,2 Miliar", "Rp 850 Ribu".
  function parsePrice(text) {
    if (!text) return null;

    const normalized = text.toLowerCase();

    const match = normalized.match(/([\d.,]+)\s*(miliar|m|juta|jt|ribu|rb)?/);
    if (!match) return null;

    const raw = match[1].replace(/\./g, "").replace(",", ".");
    const value = Number(raw);
    if (Number.isNaN(value)) return null;

    const unit = match[2] || "";
    if (unit.startsWith("miliar")) return Math.round(value * 1_000_000_000);
    if (unit.startsWith("juta") || unit === "jt") return Math.round(value * 1_000_000);
    if (unit.startsWith("ribu") || unit === "rb") return Math.round(value * 1_000);

    return Math.round(value);
  }

  function getLocationText(listing) {
    return (
      listing
        .querySelector('div[class*="pin-card__location-info"]')
        ?.textContent?.trim()
        .toLowerCase() || ""
    );
  }

  function isAllowedLocation(listing) {
    const location = getLocationText(listing);
    return ALLOWED_LOCATIONS.some((word) => location.includes(word));
  }

  function hideListing(listing) {
    listing.style.display = "none";
  }

  function extractListing(listing) {
    const listingId = getListingId(listing);
    const url = getUrl(listing);

    if (!listingId || !url) return null;

    const priceText =
      listing.querySelector('[class*="pin-card__price"]')?.textContent?.trim() ||
      "";

    return {
      source: SOURCE,
      listing_id: listingId,
      url,
      images: getImages(listing),
      price: parsePrice(priceText),
    };
  }

  async function loadKnownIds() {
    const url = new URL(`/rest/v1/${HOUSES_TABLE}`, SUPABASE_URL);
    url.searchParams.set("select", "listing_id");
    url.searchParams.set("source", `eq.${SOURCE}`);

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`known ids fetch failed: ${response.status}`);
    }

    const rows = await response.json();
    knownIds = new Set(rows.map((row) => row.listing_id));
    console.log(`[pinhome-house] loaded ${knownIds.size} known listing(s)`);
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
      console.log(`[pinhome-house] saved ${rows.length} house(s)`);
    } catch (error) {
      // Put ids back so we retry on the next scroll tick.
      rows.forEach((row) => seenIds.delete(row.listing_id));
      console.error("[pinhome-house] flush failed:", error);
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
      if (!isAllowedLocation(listing)) {
        hideListing(listing);
        return;
      }

      const id = getListingId(listing);
      if (!id || seenIds.has(id)) return;

      if (knownIds.has(id)) {
        hideListing(listing);
        seenIds.add(id);
        return;
      }

      fresh.push(listing);
    });

    if (fresh.length === 0) return;
    pending.push(...fresh);
    scheduleFlush();
  }

  const observer = new MutationObserver(processListings);

  async function start() {
    try {
      await loadKnownIds();
    } catch (error) {
      console.error("[pinhome-house] failed to load known ids:", error);
    }

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