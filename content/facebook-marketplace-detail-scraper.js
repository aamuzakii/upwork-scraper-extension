(() => {
  // Supabase publishable key is safe to ship in browser clients. Keep in sync
  // with config/supabase.js because content scripts are loaded as classic scripts.
  const SUPABASE_URL = "https://gxilidqhjdtnsnvuxjse.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_brZJLfUERmGBgXyyrL_tzQ_XqBbtnMj";

  const CARS_TABLE = "cars";
  const SOURCE = "facebook";

  let done = false;

  function isItemPage() {
    return location.pathname.includes("/marketplace/item/");
  }

  function getListingId() {
    const match = location.pathname.match(/\/marketplace\/item\/(\d+)/);
    return match ? match[1] : "";
  }

  // Title, e.g. h1 > "2013 Honda CR-V"
  function getTitle() {
    const h1 = document.querySelector("h1");
    return (h1?.textContent || "").replace(/\s+/g, " ").trim() || null;
  }

  // Price, e.g. "IDR125,000,000"
  function getPrice() {
    const spans = document.querySelectorAll('span[dir="auto"]');
    for (const span of spans) {
      const text = (span.textContent || "").trim();
      if (/(IDR|Rp|USD|SGD|MYR|THB|\$)\s*[\d.,]+/i.test(text)) {
        return text;
      }
    }
    return null;
  }

  // Mileage, e.g. "Driven 190,000 km" -> 190000
  function getMileageKm() {
    const spans = document.querySelectorAll('span[dir="auto"]');

    // Collect every span that mentions km, so we can see what the page offers.
    const candidates = [];
    for (const span of spans) {
      const text = (span.textContent || "").trim();
      if (text.includes("\n")) continue;
      const match = text.match(/([\d.,]+)\s*km/i);
      if (match) {
        const digits = match[1].replace(/[.,]/g, "");
        candidates.push({
          text,
          parsed: digits ? Number(digits) : null,
        });
      }
    }

    console.log("[fb-detail] mileage candidates:", candidates);

    // Prefer the "Driven ... km" vehicle detail, not a map distance badge.
    const driven = candidates.find((c) => /driven/i.test(c.text));
    const chosen = driven || candidates[0] || null;
    console.log("[fb-detail] mileage chosen:", chosen);
    return chosen ? chosen.parsed : null;
  }

  // Location, e.g. "Jakarta Selatan, DKI Jakarta · Location is approximate"
  function getLocation() {
    const spans = document.querySelectorAll('span[dir="auto"]');
    for (const span of spans) {
      const text = (span.textContent || "").trim();
      if (text.includes("Location is approximate")) {
        return text.replace(/·.*$/, "").trim();
      }
    }
    return null;
  }

  // Description: the multiline seller text (nested span inside a dir=auto span).
  function getDescription() {
    const spans = document.querySelectorAll('span[dir="auto"]');
    for (const span of spans) {
      const inner = span.querySelector("span");
      const text = ((inner ? inner.textContent : span.textContent) || "").trim();
      if (text.includes("\n") && text.length > 20) {
        return text;
      }
    }
    return null;
  }

  function parseTitleParts(title) {
    const tokens = (title || "").trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { brand: null, model: null, year: null };

    let year = null;
    const rest = tokens.slice();
    const yearIdx = rest.findIndex((t) => /^(19|20)\d{2}$/.test(t));
    if (yearIdx !== -1) {
      year = Number(rest[yearIdx]);
      rest.splice(yearIdx, 1);
    }

    const brand = rest[0]?.toLowerCase() || null;
    const model = rest.slice(1).join(" ").toLowerCase() || null;

    return { brand, model, year };
  }

  async function apiFetch(url, options = {}) {
    console.log(
      `[fb-detail] ${options.method || "GET"} ${url.pathname}${url.search}`,
      options.body ? JSON.parse(options.body) : "",
    );

    const response = await fetch(url, {
      ...options,
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        ...(options.headers || {}),
      },
    });

    const body = await response.text().catch(() => "");
    if (!response.ok) {
      throw new Error(`Supabase returned ${response.status}: ${body.slice(0, 500)}`);
    }
    console.log(`[fb-detail] response ${response.status}:`, body.slice(0, 300));
    return body ? JSON.parse(body) : null;
  }

  async function getExisting(listingId) {
    const url = new URL(`/rest/v1/${CARS_TABLE}`, SUPABASE_URL);
    url.searchParams.set("select", "description");
    url.searchParams.set("source", `eq.${SOURCE}`);
    url.searchParams.set("listing_id", `eq.${listingId}`);
    url.searchParams.set("limit", "1");

    const rows = await apiFetch(url);
    return rows && rows[0] ? rows[0] : null;
  }

  async function patchDescription(listingId, payload) {
    const url = new URL(`/rest/v1/${CARS_TABLE}`, SUPABASE_URL);
    url.searchParams.set("source", `eq.${SOURCE}`);
    url.searchParams.set("listing_id", `eq.${listingId}`);

    await apiFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function insertListing(row) {
    const url = new URL(`/rest/v1/${CARS_TABLE}`, SUPABASE_URL);
    await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([row]),
    });
  }

  async function run() {
    if (done) return;

    const listingId = getListingId();
    if (!listingId) return;

    const description = getDescription();
    if (!description) {
      console.log("[fb-detail] description not loaded yet, waiting...");
      return;
    }

    const mileage = getMileageKm();
    console.log("[fb-detail] extracted mileage:", mileage);

    const existing = await getExisting(listingId);
    if (existing && existing.description) {
      console.log(`[fb-detail] description already saved for ${listingId}, skipping`);
      done = true;
      return;
    }

    const payload = { description };
    if (mileage != null) {
      payload.mileage_min_km = mileage;
      payload.mileage_max_km = mileage;
    }

    try {
      if (existing) {
        await patchDescription(listingId, payload);
        console.log(`[fb-detail] updated description for ${listingId}`);
      } else {
        const title = getTitle();
        const { brand, model, year } = parseTitleParts(title || "");
        await insertListing({
          source: SOURCE,
          listing_id: listingId,
          url: location.href.split("?")[0],
          title,
          full_title: title,
          brand,
          model,
          variant: null,
          year,
          mileage_min_km: payload.mileage_min_km ?? null,
          mileage_max_km: payload.mileage_max_km ?? null,
          price: parsePrice(getPrice()),
          currency: "IDR",
          location: getLocation(),
          posted_date: null,
          description,
        });
        console.log(`[fb-detail] inserted new listing ${listingId}`);
      }
      done = true;
    } catch (error) {
      console.error("[fb-detail] failed:", error);
    }
  }

  function parsePrice(text) {
    if (!text) return null;
    const digits = text.replace(/\D/g, "");
    return digits ? Number(digits) : null;
  }

  let attempts = 0;
  const MAX_ATTEMPTS = 40;

  function tick() {
    if (done || attempts >= MAX_ATTEMPTS) return;
    attempts += 1;
    run().catch((error) => {
      console.error("[fb-detail] run failed:", error);
    });
  }

  function start() {
    console.log("[fb-detail] started on", location.href);
    tick();
    const observer = new MutationObserver(() => tick());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", tick, { passive: true });
  }

  function startAfterPageLoad() {
    window.setTimeout(start, 1000);
  }

  if (isItemPage()) {
    if (document.readyState === "complete") {
      startAfterPageLoad();
    } else {
      window.addEventListener("load", startAfterPageLoad, { once: true });
    }
  }
})();