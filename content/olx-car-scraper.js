(() => {
  // Supabase publishable key is safe to ship in browser clients. Keep in sync
  // with config/supabase.js because content scripts are loaded as classic scripts.
  const SUPABASE_URL = "https://gxilidqhjdtnsnvuxjse.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_brZJLfUERmGBgXyyrL_tzQ_XqBbtnMj";

  const CARS_TABLE = "cars";
  const SOURCE = "olx";

  const INDONESIAN_MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, jun: 5,
    jul: 6, agu: 7, sep: 8, okt: 9, nov: 10, des: 11,
  };

  // Session-level dedupe so scrolling the same page doesn't spam the API.
  const seenIds = new Set();

  // Cached set of listing_ids the user has locked (manually edited) in Supabase.
  let lockedIds = new Set();
  let lockedIdsFetchedAt = 0;

  async function refreshLockedIds() {
    const url = new URL(`/rest/v1/${CARS_TABLE}`, SUPABASE_URL);
    url.searchParams.set("select", "listing_id");
    url.searchParams.set("source", `eq.${SOURCE}`);
    url.searchParams.set("locked", "eq.true");

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`locked ids fetch failed: ${response.status}`);
    }

    const rows = await response.json();
    lockedIds = new Set(rows.map((row) => row.listing_id));
    lockedIdsFetchedAt = Date.now();
  }

  async function ensureLockedIds() {
    if (Date.now() - lockedIdsFetchedAt < 60000) return;
    try {
      await refreshLockedIds();
      console.log(`[olx-car-scraper] loaded ${lockedIds.size} locked listing(s)`);
    } catch (error) {
      console.error("[olx-car-scraper] failed to refresh locked ids:", error);
    }
  }

  function isCarPage() {
    return location.pathname.includes("mobil");
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

  function parsePrice(text) {
    if (!text) return null;
    const digits = text.replace(/\D/g, "");
    return digits ? Number(digits) : null;
  }

  function parseMileage(text) {
    if (!text) return { mileageMinKm: null, mileageMaxKm: null };

    const rangeMatch = text.match(/([\d.,]+)\s*-\s*([\d.,]+)\s*km/i);
    if (rangeMatch) {
      return {
        mileageMinKm: normalizeKm(rangeMatch[1]),
        mileageMaxKm: normalizeKm(rangeMatch[2]),
      };
    }

    const singleMatch = text.match(/([\d.,]+)\s*km/i);
    if (singleMatch) {
      const km = normalizeKm(singleMatch[1]);
      return { mileageMinKm: km, mileageMaxKm: km };
    }

    return { mileageMinKm: null, mileageMaxKm: null };
  }

  function normalizeKm(value) {
    const digits = value.replace(/[.,]/g, "");
    return digits ? Number(digits) : null;
  }

  function parseYear(text) {
    const match = (text || "").match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
  }

  function parseLocationAndDate(detailsEl) {
    if (!detailsEl) return { location: null, postedDate: null };

    const dateEl = detailsEl.querySelector("span");
    const dateText = (dateEl?.textContent || "").trim();

    const clone = detailsEl.cloneNode(true);
    clone.querySelector("span")?.remove();
    const location = (clone.textContent || "").replace(/\s+/g, " ").trim();

    return { location: location || null, postedDate: parsePostedDate(dateText) };
  }

  function parsePostedDate(text) {
    // e.g. "12 Agu" -> best-effort ISO date (year is inferred)
    const match = (text || "").match(/^(\d{1,2})\s+([a-zA-Z]{3})/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = INDONESIAN_MONTHS[match[2].toLowerCase()];
    if (day == null || month === undefined) return null;

    const now = new Date();
    let date = new Date(now.getFullYear(), month, day);
    if (date > now) date = new Date(now.getFullYear() - 1, month, day);

    return date.toISOString().slice(0, 10);
  }

  function parseTitleParts(fullTitle) {
    const tokens = (fullTitle || "")
      .replace(/^(dijual|jual|disewakan|sewa)\s+/i, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const brand = tokens[0]?.toLowerCase() || null;
    const model = tokens[1]?.toLowerCase() || null;
    const variant = tokens
      .slice(2)
      .filter((t) => !/^\d{4}$/.test(t))
      .join(" ")
      .toLowerCase();

    return {
      brand,
      model,
      variant: variant || null,
      titleYear: tokens.find((t) => /^\d{4}$/.test(t)) || null,
    };
  }

  function extractListing(listing) {
    const listingId = getListingId(listing);
    const url = getUrl(listing);

    if (!listingId || !url) return null;

    const title =
      listing.querySelector('[data-aut-id="itemTitle"]')?.textContent?.trim() ||
      "";

    const fullTitle =
      listing.querySelector("img")?.alt?.trim() ||
      listing.querySelector('[data-aut-id="itemTitle"]')?.title?.trim() ||
      title;

    const subTitle =
      listing.querySelector('[data-aut-id="itemSubTitle"]')?.textContent?.trim() ||
      "";

    const priceText =
      listing.querySelector('[data-aut-id="itemPrice"]')?.textContent?.trim() ||
      "";

    const detailsEl = listing.querySelector('[data-aut-id="itemDetails"]');

    const price = parsePrice(priceText);
    const { mileageMinKm, mileageMaxKm } = parseMileage(subTitle);
    const { location, postedDate } = parseLocationAndDate(detailsEl);
    const { brand, model, variant, titleYear } = parseTitleParts(fullTitle);

    const year = parseYear(subTitle) ?? (titleYear ? Number(titleYear) : null);

    return {
      source: SOURCE,
      listing_id: listingId,
      url,
      title,
      full_title: fullTitle || null,
      brand,
      model,
      variant,
      year,
      mileage_min_km: mileageMinKm,
      mileage_max_km: mileageMaxKm,
      price,
      currency: "IDR",
      location,
      posted_date: postedDate,
    };
  }

  async function postToSupabase(table, rows, prefer) {
    const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
    const headers = {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    };
    if (prefer) headers.Prefer = prefer;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Supabase ${table} returned ${response.status}: ${body.slice(0, 300)}`,
      );
    }
  }

  async function flush(listings) {
    if (listings.length === 0) return;

    await ensureLockedIds();

    const carRows = [];
    for (const listing of listings) {
      const data = extractListing(listing);
      if (!data || seenIds.has(data.listing_id)) continue;

      seenIds.add(data.listing_id);
      if (lockedIds.has(data.listing_id)) {
        console.log(
          `[olx-car-scraper] skipping locked listing ${data.listing_id}`,
        );
        continue;
      }
      carRows.push(data);
    }

    try {
      if (carRows.length) {
        await postToSupabase(
          CARS_TABLE,
          carRows,
          "resolution=merge-duplicates,return=minimal",
        );
      }
      console.log(`[olx-car-scraper] saved ${carRows.length} car(s)`);
    } catch (error) {
      // Put ids back so we retry on the next scroll tick.
      carRows.forEach((row) => seenIds.delete(row.listing_id));
      console.error("[olx-car-scraper] flush failed:", error);
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

  if (isCarPage()) {
    if (document.readyState === "complete") {
      startAfterPageLoad();
    } else {
      window.addEventListener("load", startAfterPageLoad, { once: true });
    }
  }
})();
