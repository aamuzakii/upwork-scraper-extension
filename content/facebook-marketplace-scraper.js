(() => {
  // Supabase publishable key is safe to ship in browser clients. Keep in sync
  // with config/supabase.js because content scripts are loaded as classic scripts.
  const SUPABASE_URL = "https://gxilidqhjdtnsnvuxjse.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_brZJLfUERmGBgXyyrL_tzQ_XqBbtnMj";

  const CARS_TABLE = "cars";
  const SOURCE = "facebook";

  // Facebook Marketplace cards carry everything in the link's aria-label, e.g.
  //   "2015 Honda CR-V, IDR165,000,000, Jakarta, Indonesia, listing 2356805815136933"
  // The item id is also present in the href: /marketplace/item/<id>/

  // Session-level dedupe so scrolling the same page doesn't spam the API.
  const seenIds = new Set();

  function isMarketplacePage() {
    return (
      location.pathname.includes("/marketplace") &&
      !location.pathname.includes("/marketplace/item")
    );
  }

  function getListings() {
    return document.querySelectorAll('a[href*="/marketplace/item/"]');
  }

  function getListingId(link) {
    const hrefMatch = (link.href || "").match(/\/marketplace\/item\/(\d+)/);
    if (hrefMatch) return hrefMatch[1];

    const labelMatch = (link.getAttribute("aria-label") || "").match(
      /listing\s+(\d+)/i,
    );
    return labelMatch ? labelMatch[1] : "";
  }

  function getUrl(link) {
    const href = link.href || "";
    return href ? href.split("?")[0] : "";
  }

  function parsePrice(text) {
    if (!text) return null;
    const digits = text.replace(/\D/g, "");
    return digits ? Number(digits) : null;
  }

  function parseCurrency(text) {
    const match = (text || "").match(/^(Rp|IDR|USD|SGD|MYR|THB|\$)/i);
    if (!match) return "IDR";
    if (match[1] === "$") return "USD";
    if (match[1].toUpperCase() === "RP") return "IDR";
    return match[1].toUpperCase();
  }

  // e.g. "2015 Honda CR-V, IDR165,000,000, Jakarta, Indonesia, listing 2356805815136933"
  function parseAriaLabel(label) {
    if (!label) return {};

    const listingMatch = label.match(/listing\s+(\d+)/i);
    const listingId = listingMatch ? listingMatch[1] : null;

    const priceMatch = label.match(/(Rp|IDR|USD|SGD|MYR|THB|\$)\s*[\d.,]+/i);

    let title = null;
    let location = null;
    let price = null;
    let currency = "IDR";

    if (priceMatch) {
      currency = parseCurrency(priceMatch[0]);
      price = parsePrice(priceMatch[0]);

      title = label.slice(0, priceMatch.index).replace(/,\s*$/, "").trim();

      const afterPrice = priceMatch.index + priceMatch[0].length;
      const locationEnd = listingMatch ? listingMatch.index : label.length;
      location = label
        .slice(afterPrice, locationEnd)
        .replace(/^,\s*/, "")
        .replace(/,\s*$/, "")
        .trim();
    } else {
      title = label.split(",")[0].trim();
    }

    return { listingId, title, price, currency, location };
  }

  // "2015 Honda CR-V" -> { year: 2015, brand: "honda", model: "cr-v" }
  function parseTitleParts(title) {
    const tokens = (title || "").trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { brand: null, model: null, year: null };

    let year = null;
    let rest = tokens.slice();

    const yearIdx = rest.findIndex((t) => /^(19|20)\d{2}$/.test(t));
    if (yearIdx !== -1) {
      year = Number(rest[yearIdx]);
      rest.splice(yearIdx, 1);
    }

    const brand = rest[0]?.toLowerCase() || null;
    const model = rest.slice(1).join(" ").toLowerCase() || null;

    return { brand, model, year };
  }

  function extractListing(link) {
    const listingId = getListingId(link);
    const url = getUrl(link);

    if (!listingId || !url) return null;

    const ariaLabel = link.getAttribute("aria-label") || "";
    const { listingId: labelId, title, price, currency, location } =
      parseAriaLabel(ariaLabel);

    const imgAlt = link.querySelector("img")?.getAttribute("alt") || "";

    const fullTitle =
      (title && title.split(",")[0].trim()) || imgAlt || null;

    const { brand, model, year } = parseTitleParts(title || imgAlt);

    return {
      source: SOURCE,
      listing_id: listingId || labelId,
      url,
      title: fullTitle,
      full_title: title || null,
      brand,
      model,
      variant: null,
      year,
      mileage_min_km: null,
      mileage_max_km: null,
      price,
      currency,
      location,
      posted_date: null,
    };
  }

  async function postToSupabase(rows) {
    const url = new URL(`/rest/v1/${CARS_TABLE}`, SUPABASE_URL);
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
        `Supabase ${CARS_TABLE} returned ${response.status}: ${body.slice(0, 300)}`,
      );
    }
  }

  async function flush(listings) {
    if (listings.length === 0) return;

    const carRows = [];
    for (const listing of listings) {
      const data = extractListing(listing);
      if (!data || seenIds.has(data.listing_id)) continue;

      seenIds.add(data.listing_id);
      carRows.push(data);
    }

    try {
      if (carRows.length) await postToSupabase(carRows);
      console.log(`[facebook-scraper] saved ${carRows.length} car(s)`);
    } catch (error) {
      carRows.forEach((row) => seenIds.delete(row.listing_id));
      console.error("[facebook-scraper] flush failed:", error);
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
    const fresh = Array.from(getListings()).filter((listing) => {
      const id = getListingId(listing);
      return id && !seenIds.has(id);
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

  if (isMarketplacePage()) {
    if (document.readyState === "complete") {
      startAfterPageLoad();
    } else {
      window.addEventListener("load", startAfterPageLoad, { once: true });
    }
  }
})();