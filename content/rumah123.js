// https://www.rumah123.com/sewa/depok/limo/rumah/?maxPrice=55000000&minPrice=24000000&sort=price-asc

console.log("[Rumah123] detected!");

const STORAGE_KEY = "rumah123HiddenIds";

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config/supabase.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);

console.log(supabase);


async function getHiddenIds() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || [];
}

async function saveHiddenId(id) {
  const ids = await getHiddenIds();

  if (!ids.includes(id)) {
    ids.push(id);

    await chrome.storage.local.set({
      [STORAGE_KEY]: ids,
    });

    console.log("[Rumah123] Saved:", id);
  }
}

function getListings() {
  return document.querySelectorAll(
    'article[data-test-id^="srp-listing-card-"]'
  );
}

function getListingId(listing) {
  return listing.id;
}

function hideListing(listing) {
  listing.style.display = "none";
}

function createButton(id, listing) {
  const btn = document.createElement("button");

  btn.innerHTML = "🗑";
  btn.title = "Hide this listing";

  btn.style.position = "absolute";
  btn.style.top = "10px";
  btn.style.left = "10px";
  btn.style.zIndex = "99999";
  btn.style.width = "36px";
  btn.style.height = "36px";
  btn.style.border = "none";
  btn.style.borderRadius = "999px";
  btn.style.background = "#ff4444";
  btn.style.color = "white";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "18px";

  btn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    await saveHiddenId(id);

    hideListing(listing);
  };

  return btn;
}

function addHideButton(listing, id) {
  if (listing.dataset.r123Processed) return;

  listing.dataset.r123Processed = "1";

  listing.style.position = "relative";

  const saveArea = listing.querySelector(
    '[data-test-id^="srp-save-listing-button"]'
  );

  const btn = createButton(id, listing);

  if (saveArea) {
    saveArea.appendChild(btn);
    console.log("[Rumah123] Button injected:", id);
  } else {
    listing.appendChild(btn);
    console.warn("[Rumah123] Save area not found, appended to card:", id);
  }
}

async function processListings() {
  const hiddenIds = await getHiddenIds();

  const listings = getListings();

  console.log("[Rumah123] Listings:", listings.length);

  listings.forEach((listing) => {
    const id = getListingId(listing);

    if (!id) return;

    if (hiddenIds.includes(id)) {
      hideListing(listing);
    } else {
      addHideButton(listing, id);
    }
  });
}

let timer = null;

const observer = new MutationObserver(() => {
  clearTimeout(timer);

  timer = setTimeout(() => {
    processListings();
  }, 200);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

processListings();

window.addEventListener("beforeunload", () => {
  console.log("[Rumah123] unloaded");
});
