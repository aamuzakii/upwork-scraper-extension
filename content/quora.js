// Quora Hide Post - content script
// 1. Wait until Quora finishes rendering (React SPA -> MutationObserver)
// 2. Find every post (root element per answer)
// 3. Get unique ID from the answer timestamp link
// 4. Add a "Hide" button near the action bar
// 5. Hide posts that were previously hidden (persisted in chrome.storage)

const STORAGE_KEY = "quoraHiddenPosts";

// ---------- Storage helpers ----------
async function getHiddenIds() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || [];
}

async function addHiddenId(id) {
  const ids = await getHiddenIds();
  if (!ids.includes(id)) {
    ids.push(id);
    await chrome.storage.local.set({ [STORAGE_KEY]: ids });
  }
}

// ---------- Post helpers ----------
// Find the root element for each answer.
// Every answer has a timestamp link; the post container is its closest answer wrapper.
// Walk upward from the timestamp link until we find an element that
// contains the stable puppeteer test hooks + the timestamp.
// This matches structure, not styling, so it survives class changes.
function findPostContainer(link) {
  let post = link;
  while (post && post !== document.body) {
    if (
      post.querySelector(".puppeteer_test_answer_content") &&
      post.querySelector(".answer_timestamp")
    ) {
      return post;
    }
    post = post.parentElement;
  }
  return null;
}

// Return EVERY post on the page (no hideProcessed filter).
// Used for bulk operations like hideSahamPosts().
function findAllPosts() {
  const posts = [];
  const links = document.querySelectorAll("a.answer_timestamp");
  links.forEach((link) => {
    const post = findPostContainer(link);
    if (post && !posts.includes(post)) {
      posts.push(post);
    }
  });
  return posts;
}

// Return only NEW (unprocessed) posts. Used by processAllPosts().
function findPosts() {
  return findAllPosts().filter((post) => !post.dataset.hideProcessed);
}

function getPostId(post) {
  const link = post.querySelector("a.answer_timestamp");
  if (!link) return null;
  try {
    const id = new URL(link.href).pathname;
    return id;
  } catch (e) {
    return null;
  }
}

// Get the question title of a post (Quora's stable test hook).
function getPostTitle(post) {
  const titleEl = post.querySelector(".puppeteer_test_question_title");
  return titleEl ? titleEl.textContent.trim() : "";
}

// ---------- Hide button ----------
function addHideButton(post, id) {
  post.dataset.hideProcessed = "true";

  const btn = document.createElement("button");
  btn.textContent = "🗑 Hide";
  btn.style.cssText =
    "margin-left:12px;padding:4px 10px;border:1px solid #ccc;border-radius:16px;" +
    "background:#fff;color:#333;cursor:pointer;font-size:13px;";
  btn.addEventListener("click", async () => {
    await addHiddenId(id);
    hidePost(post);
  });

  // Append near the action bar (upvote / comment / share row)
  const actionBar = post.querySelector(
    ".q-box.qu-display--flex.qu-alignItems--center.qu-mt--small"
  );
  if (actionBar) {
    actionBar.appendChild(btn);
  } else {
    post.appendChild(btn);
  }
}

function hidePost(post) {
  post.style.display = "none";
}

// ---------- Floating button ----------
// Keywords that trigger hiding.
const HIDE_KEYWORDS = ["tabungan", "saham", "bitcoin", "income", "investor", "trading", "game"];
// If the title contains any of these, keep the post (do NOT hide).
const KEEP_KEYWORDS = ["mobil", "otomotif"];

function shouldHideTitle(title) {
  const lower = title.toLowerCase();
  // "mobil" wins -> keep it
  if (KEEP_KEYWORDS.some((k) => lower.includes(k))) return false;
  return HIDE_KEYWORDS.some((k) => lower.includes(k));
}

// Loop all posts; hide those whose title matches HIDE_KEYWORDS
// (unless it also matches KEEP_KEYWORDS). Persist hidden ids.
async function hideSahamPosts() {
  const hiddenIds = await getHiddenIds();
  const hiddenTitles = [];

  for (const post of findAllPosts()) {
    const id = getPostId(post);
    if (!id) continue;
    if (hiddenIds.includes(id)) continue;

    const title = getPostTitle(post);
    if (!shouldHideTitle(title)) continue;

    await addHiddenId(id);
    hiddenIds.push(id); // keep local cache in sync
    hidePost(post);
    hiddenTitles.push(title);
  }

  if (hiddenTitles.length > 0) {
    alert("Hidden posts:\n\n" + hiddenTitles.join("\n"));
  }
  console.log("[quora] hideSahamPosts done, hidden:", hiddenTitles.length);
}

function addFloatingButton() {
  if (document.getElementById("quora-hide-tabungan-fab")) return;

  const fab = document.createElement("button");
  fab.id = "quora-hide-tabungan-fab";
  fab.title = "Hide all 'tabungan' posts";
  fab.textContent = "🗑";
  fab.style.cssText =
    "position:fixed;bottom:24px;right:24px;z-index:999999;width:56px;height:56px;" +
    "border-radius:50%;border:none;background:#e63946;color:#fff;font-size:24px;" +
    "cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
  fab.addEventListener("click", hideSahamPosts);
  document.body.appendChild(fab);
}

// ---------- Main ----------
async function processAllPosts() {
  const hiddenIds = await getHiddenIds();
  findPosts().forEach((post) => {
    const id = getPostId(post);
    if (!id) {
      return;
    }
    if (hiddenIds.includes(id)) {
      hidePost(post);
    } else {
      addHideButton(post, id);
    }
  });
}

// Observe DOM changes (Quora is a React SPA, content changes after load)
function observePage() {
  const observer = new MutationObserver(() => {
    processAllPosts();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

processAllPosts();
observePage();
addFloatingButton();
