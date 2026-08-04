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

function findPosts() {
  const posts = [];
  const links = document.querySelectorAll("a.answer_timestamp");
  links.forEach((link) => {
    const post = findPostContainer(link);
    if (post && !post.dataset.hideProcessed) {
      posts.push(post);
    }
  });
  return posts;
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
