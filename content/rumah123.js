const STORAGE_KEY = "rumah123HiddenIds";
// Create this table in Supabase (or change the name here):
//   create table rumah123_syncs (
//     storage_key text primary key,
//     hidden_ids text[] not null default '{}',
//     updated_at timestamptz not null default now()
//   );
const SUPABASE_SYNC_TABLE = "rumah123_syncs";
const FORCE_SYNC_BUTTON_ID = "r123-force-sync";

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config/supabase.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);

function hideSidebar() {
  const sidebars = document.querySelectorAll(".srp-sidebar");
  sidebars.forEach((sidebar) => {
    sidebar.style.display = "none";
  });
}


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
  }
}

async function forceSyncHiddenIds() {
  const hiddenIds = await getHiddenIds();
  const { error } = await supabase.from(SUPABASE_SYNC_TABLE).upsert(
    {
      storage_key: STORAGE_KEY,
      hidden_ids: hiddenIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "storage_key" },
  );

  if (error) throw error;

  return hiddenIds.length;
}

function addForceSyncButton() {
  if (document.getElementById(FORCE_SYNC_BUTTON_ID)) return;

  const button = document.createElement("button");
  button.id = FORCE_SYNC_BUTTON_ID;
  button.type = "button";
  button.textContent = "Sync hidden listings";
  button.title = "Force-push locally hidden listing IDs to Supabase";

  Object.assign(button.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    padding: "10px 14px",
    border: "none",
    borderRadius: "8px",
    background: "#147a43",
    color: "white",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
  });

  button.addEventListener("click", async () => {
    if (button.disabled) return;

    const defaultText = "Sync hidden listings";
    button.disabled = true;
    button.textContent = "Syncing…";

    try {
      const count = await forceSyncHiddenIds();
      button.textContent = `Synced ${count} listing${count === 1 ? "" : "s"}`;
    } catch (error) {
      button.textContent = "Sync failed — retry";
      console.error("[Rumah123] Supabase force-sync failed:", error);
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = defaultText;
      }, 2500);
    }
  });

  document.body.appendChild(button);
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
  } else {
    listing.appendChild(btn);
  }
}

async function processListings() {
  const hiddenIds = await getHiddenIds();

  const listings = getListings();

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
    hideSidebar();
    processListings();
  }, 200);
});

function startRumah123() {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  hideSidebar();
  processListings();
  addForceSyncButton();
}

function startAfterPageLoad() {
  // Give Rumah123 time to finish React hydration before changing its DOM.
  window.setTimeout(startRumah123, 1000);
}

if (document.readyState === "complete") {
  startAfterPageLoad();
} else {
  window.addEventListener("load", startAfterPageLoad, { once: true });
}
