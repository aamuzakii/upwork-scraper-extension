const THREADS_ACCESS_FLAG = "threads_access";
const BLOCKED_STYLE_ID = "upwork-spider-threads-blocked";
// Supabase publishable keys are safe to ship in browser clients. Keep this in
// sync with config/supabase.js because content scripts are loaded as classics.
const SUPABASE_URL = "https://gxilidqhjdtnsnvuxjse.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_brZJLfUERmGBgXyyrL_tzQ_XqBbtnMj";

function blockThreads() {
  if (document.getElementById(BLOCKED_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = BLOCKED_STYLE_ID;
  style.textContent = "html { display: none !important; }";
  (document.head || document.documentElement).appendChild(style);
}

function allowThreads() {
  document.getElementById(BLOCKED_STYLE_ID)?.remove();
}

async function isThreadsAllowed() {
  const url = new URL("/rest/v1/extension_flags", SUPABASE_URL);
  url.searchParams.set("select", "enabled");
  url.searchParams.set("key", `eq.${THREADS_ACCESS_FLAG}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase returned ${response.status}`);
  }

  const flags = await response.json();
  return flags[0]?.enabled === true;
}

// Keep Threads hidden until the remote productivity policy explicitly permits it.
blockThreads();

isThreadsAllowed()
  .then((allowed) => {
    if (allowed) allowThreads();
  })
  .catch((error) => {
    console.error("[Threads] Access check failed; keeping Threads blocked.", error);
  });
