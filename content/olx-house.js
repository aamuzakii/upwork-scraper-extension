(() => {
  // Supabase publishable key is safe to ship in browser clients. Keep in sync
  // with config/supabase.js because content scripts are loaded as classic scripts.
  const SUPABASE_URL = "https://gxilidqhjdtnsnvuxjse.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_brZJLfUERmGBgXyyrL_tzQ_XqBbtnMj";

  const HOUSES_TABLE = "houses";
  const SOURCE = "olx";

  // Every location the user can toggle from the in-page panel.
  const LOCATION_OPTIONS = [
    { value: "cinere", label: "Cinere" },
    { value: "limo", label: "Limo" },
    { value: "jagakarsa", label: "Jagakarsa" },
    { value: "beji", label: "Beji" },
    { value: "cimanggis", label: "Cimanggis" },
    { value: "cibubur", label: "Cibubur" },
  ];

  const DEFAULT_LOCATIONS = ["cinere", "limo", "cimanggis", "cibubur"];
  const STORAGE_KEY = "olxHouseAllowedLocations";

  // Locations the user has selected. Loaded from storage on start, falling back
  // to DEFAULT_LOCATIONS when nothing is saved yet. Only listings in these
  // locations are kept; everything else is ignored entirely.
  let allowedLocations = [...DEFAULT_LOCATIONS];

  async function loadAllowedLocations() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      if (Array.isArray(data[STORAGE_KEY])) {
        allowedLocations = data[STORAGE_KEY];
      }
    } catch (error) {
      console.error("[olx-house] failed to load locations:", error);
    }
  }

  async function saveAllowedLocations() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: allowedLocations });
    } catch (error) {
      console.error("[olx-house] failed to save locations:", error);
    }
  }

  // Session-level dedupe so scrolling the same page doesn't spam the API.
  const seenIds = new Set();

  // listing_id -> display value (true/false/null) for rows already in the DB,
  // loaded once on page load. A listing is only hidden when it is present here
  // AND its display value is exactly false.
  let knownDisplay = new Map();

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

  function isAllowedLocation(listing) {
    const location = getLocationText(listing);
    return allowedLocations.some((word) => location.includes(word));
  }

  function hideListing(listing) {
    listing.style.display = "none";
  }

  // Remove OLX's page chrome and sponsored result blocks. OLX inserts some of
  // these after the initial render, so this runs on each listing scan too.
  const AD_COMPONENT_SELECTORS = [
    'header[data-aut-id="defaultHeader"]',
    "p#adsResultsNear",
    '[data-test-id="native-ad-results-middle"]',
    '[data-test-id="ad-results-banner"]',
    '[data-aut-id="staticBannerSrpList"]',
    '[data-aut-id="baxter-ads-results-middle2"]',
  ];

  function hideAdComponents() {
    document.querySelectorAll(AD_COMPONENT_SELECTORS.join(",")).forEach((element) => {
      element.style.setProperty("display", "none", "important");
    });
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

  async function loadKnownIds() {
    const url = new URL(`/rest/v1/${HOUSES_TABLE}`, SUPABASE_URL);
    url.searchParams.set("select", "listing_id,display");
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
    knownDisplay = new Map(rows.map((row) => [row.listing_id, row.display]));
    console.log(`[olx-house] loaded ${knownDisplay.size} known listing(s)`);
  }

  // PATCH a single row's `display` to false. Uses the listing_id + source key.
  async function markDisplayFalse(listingId) {
    const url = new URL(`/rest/v1/${HOUSES_TABLE}`, SUPABASE_URL);
    url.searchParams.set("listing_id", `eq.${listingId}`);
    url.searchParams.set("source", `eq.${SOURCE}`);

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ display: false }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `markDisplayFalse returned ${response.status}: ${body.slice(0, 300)}`,
      );
    }
  }

  // Inject a small "Hide" button into a listing card. Clicking it marks
  // `display=false` in the DB and hides the card locally.
  // Idempotent per element: returns early only if THIS element already has a
  // button. OLX re-renders cards on "load more"/scroll, which replaces the node,
  // so we must not cache state on the listing element (its href/id may also
  // appear after a skeleton render) — instead we check for the button's own
  // marker each pass, which tolerates duplicated injections.
  function addHideButton(listing) {
    if (listing.querySelector("button[data-olx-hide-btn]")) return;

    const listingId = getListingId(listing);
    if (!listingId) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.olxHideBtn = "1";
    button.textContent = "Hide";
    Object.assign(button.style, {
      position: "absolute",
      top: "8px",
      right: "8px",
      zIndex: "10",
      padding: "4px 10px",
      cursor: "pointer",
      background: "#d32f2f",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      fontSize: "12px",
    });
    button.title = "Mark display=false";

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      button.disabled = true;
      button.textContent = "…";

      try {
        await markDisplayFalse(listingId);
        knownDisplay.set(listingId, false);
        seenIds.add(listingId);
        hideListing(listing);
        console.log(`[olx-house] marked ${listingId} display=false`);
      } catch (error) {
        button.disabled = false;
        button.textContent = "Hide";
        console.error("[olx-house] failed to mark display=false:", error);
      }
    });

    listing.style.position = "relative";
    listing.appendChild(button);
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
    hideAdComponents();
    const fresh = [];

    getListings().forEach((listing) => {
      // Rule 1: hide anything outside ALLOWED_LOCATIONS.
      if (!isAllowedLocation(listing)) {
        hideListing(listing);
        return;
      }

      const id = getListingId(listing);
      if (!id) return;

      if (knownDisplay.has(id)) {
        // Already in DB: hide only when display is exactly false; otherwise it
        // stays visible. Either way it is already persisted, so never re-post.
        if (knownDisplay.get(id) === false) {
          hideListing(listing);
        } else {
          addHideButton(listing);
        }
        seenIds.add(id);
        return;
      }

      // Not in DB yet. Always (re)attach the button — idempotent per element —
      // so re-rendered cards still get one. Only queue for saving the first
      // time we see this id.
      addHideButton(listing);
      if (seenIds.has(id)) return;
      fresh.push(listing);
    });

    if (fresh.length === 0) return;
    pending.push(...fresh);
    scheduleFlush();
  }

  const observer = new MutationObserver(processListings);

  // Floating panel with a toggle button + checkbox list for ALLOWED_LOCATIONS.
  function buildLocationPanel() {
    if (document.getElementById("olx-house-panel")) return;

    const panel = document.createElement("div");
    panel.id = "olx-house-panel";
    Object.assign(panel.style, {
      position: "fixed",
      top: "16px",
      right: "16px",
      zIndex: "2147483647",
      background: "#fff",
      color: "#222",
      border: "1px solid #ccc",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      padding: "12px",
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      width: "180px",
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "8px",
    });

    const title = document.createElement("span");
    title.textContent = "Lokasi";

    const toggle = document.createElement("span");
    toggle.textContent = "— 0.1";
    toggle.style.cursor = "pointer";
    toggle.style.fontSize = "14px";
    toggle.style.userSelect = "none";

    header.appendChild(title);
    header.appendChild(toggle);
    panel.appendChild(header);

    const list = document.createElement("div");
    list.style.display = "none";

    LOCATION_OPTIONS.forEach(({ value, label }) => {
      const row = document.createElement("label");
      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 0",
        cursor: "pointer",
      });

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;
      checkbox.checked = allowedLocations.includes(value);

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          if (!allowedLocations.includes(value)) {
            allowedLocations.push(value);
          }
        } else {
          allowedLocations = allowedLocations.filter((w) => w !== value);
        }
        saveAllowedLocations();
        processListings();
      });

      const text = document.createElement("span");
      text.textContent = label;

      row.appendChild(checkbox);
      row.appendChild(text);
      list.appendChild(row);
    });

    toggle.addEventListener("click", () => {
      const hidden = list.style.display === "none";
      list.style.display = hidden ? "block" : "none";
      toggle.textContent = hidden ? "×" : "—";
    });

    panel.appendChild(list);
    document.body.appendChild(panel);
  }

  async function start() {
    await loadAllowedLocations();

    try {
      await loadKnownIds();
    } catch (error) {
      console.error("[olx-house] failed to load known ids:", error);
    }

    buildLocationPanel();
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", processListings, { passive: true });
    processListings();

    // Aggressive safety net: periodically re-scan so that cards OLX re-renders
    // (e.g. "load more") get their Hide button back even when no mutation
    // captured the change. Idempotent, so duplicates are harmless.
    window.setInterval(processListings, 2000);
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
// https://www.olx.co.id/disewakan-rumah-apartemen_c5160?sorting=desc-creation&filter=price_between_24000000_to_55000000%2Ctype_eq_rumah
// https://www.olx.co.id/cimanggis_g5001324/disewakan-rumah-apartemen_c5160?sorting=desc-creation&filter=price_between_24000000_to_55000000%2Ctype_eq_rumah
// https://www.olx.co.id/cibubur_g5007152/disewakan-rumah-apartemen_c5160?sorting=desc-creation&filter=price_between_24000000_to_55000000%2Ctype_eq_rumah


// cibubur_g5007152
// limo_g5001327
