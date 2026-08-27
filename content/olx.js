function isHousePage() {
  return location.pathname.includes("rumah");
}

if (!isHousePage()) {
  throw new Error("Not a house page");
}

const STORAGE_KEY = "olxHiddenIds";

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

function getListings() {
  return document.querySelectorAll('li[data-aut-id="itemBox"]');
}

function getListingId(listing) {
  return listing.id.replace("item-card-", "");
}

function hideListing(listing) {
  listing.style.display = "none";
}

function addHideButton(listing, id) {
  if (listing.dataset.olxProcessed) return;

  listing.dataset.olxProcessed = "1";

  const favButton = listing.querySelector(
    'button[data-aut-id="btnFav"]'
  );

  if (!favButton) return;

  const btn = document.createElement("button");

  btn.textContent = "🗑";
  btn.style.marginLeft = "8px";
  btn.style.cursor = "pointer";

  btn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    await saveHiddenId(id);

    hideListing(listing);
  };

  favButton.parentElement.appendChild(btn);
}

async function processListings() {
  const hiddenIds = await getHiddenIds();

  getListings().forEach((listing) => {
    const id = getListingId(listing);

    if (hiddenIds.includes(id)) {
      hideListing(listing);
    } else {
      addHideButton(listing, id);
    }
  });
}

const observer = new MutationObserver(() => {
  processListings();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

processListings();