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

async function claimThreadsSession() {
  const response = await fetch(
    new URL("/rest/v1/rpc/claim_threads_session", SUPABASE_URL),
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase returned ${response.status}`);
  }

  const state = await response.json();
  return state[0];
}

async function enforceThreadsPolicy() {
  if (!(await isThreadsAllowed())) {
    blockThreads();
    return null;
  }

  const session = await claimThreadsSession();
  if (session?.allowed !== true) {
    blockThreads();
    return null;
  }

  allowThreads();
  return session;
}

function scheduleSessionExpiryCheck(session) {
  const sessionEndsAt = Date.parse(session.session_ends_at);
  if (!Number.isFinite(sessionEndsAt)) {
    throw new Error("Threads session response has no valid expiry time");
  }

  window.setTimeout(() => {
    enforceThreadsPolicy()
      .then((nextSession) => {
        if (nextSession) scheduleSessionExpiryCheck(nextSession);
      })
      .catch((error) => {
        console.error("[Threads] Session check failed; keeping Threads blocked.", error);
        blockThreads();
      });
  }, Math.max(0, sessionEndsAt - Date.now()) + 50);
}

// Keep Threads hidden until both the remote access flag and shared session
// policy permit it. The RPC owns all timing so every device sees one session.
blockThreads();

enforceThreadsPolicy()
  .then((session) => {
    if (session) {
      scheduleSessionExpiryCheck(session);
    }
  })
  .catch((error) => {
    console.error("[Threads] Access check failed; keeping Threads blocked.", error);
    blockThreads();
  });
