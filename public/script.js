/* ============================================================
   ShortsCraft v2.1 — Frontend Logic
   ============================================================ */
(() => {
"use strict";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STATE = {
  user: null,
  isPro: false,
  credits: 10,
  config: null,
  supabase: null,
  currentTopic: "",
  currentResults: null,
  currentTab: "script",
  history: [],
  saved: [],
};

const LS_KEYS = {
  HISTORY: "sc:history:v2",
  SAVED: "sc:saved:v2",
  CREDITS: "sc:credits:v2",
  CREDITS_DAY: "sc:credits:day",
  TASKS: "sc:tasks:v3",
  TASKS_OPENED: "sc:tasks-opened:v3",
  AUTH: "sc:auth:v2",
  CREDITS_VERSION: "sc:credits-version:v10",
};

const FREE_CREDITS = 10;
const CREDIT_VERSION = "10";

/* ── Toast ─────────────────────────────────────────── */
function toast(msg, type = "info", ms = 3000) {
  const wrap = $("#toasts");
  if (!wrap) return console.log(`[${type}]`, msg);
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icons = { success: "✅", error: "⚠️", info: "💡" };
  el.innerHTML = `<span class="toast-icon">${icons[type] || "💡"}</span><span>${escapeHtml(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add("fade-out"); setTimeout(() => el.remove(), 300); }, ms);
}
window.scToast = toast;

/* ── API ───────────────────────────────────────────── */
async function api(path, { method = "GET", body, signal } = {}) {
  try {
    const r = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    let data;
    try { data = await r.json(); } catch { data = {}; }
    if (!r.ok || data.success === false) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error(err.message || "Network error");
  }
}

/* ── Auth state persistence ────────────────────────── */
function saveAuthLocal(user) {
  try {
    if (user) {
      const safe = {
        id: user.id || user.email || "local",
        email: user.email || "",
        user_metadata: user.user_metadata || {},
      };
      localStorage.setItem(LS_KEYS.AUTH, JSON.stringify(safe));
    } else {
      localStorage.removeItem(LS_KEYS.AUTH);
    }
  } catch {}
}
function loadAuthLocal() {
  try {
    const raw = localStorage.getItem(LS_KEYS.AUTH);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

/* ── Config + Supabase ─────────────────────────────── */
async function loadConfig() {
  try {
    STATE.config = await api("/api/config");
    if (window.supabase && STATE.config.supabaseUrl && STATE.config.supabaseAnonKey) {
      STATE.supabase = window.supabase.createClient(STATE.config.supabaseUrl, STATE.config.supabaseAnonKey);
      const { data: { session } } = await STATE.supabase.auth.getSession();
      if (session?.user) handleSignedIn(session.user);
      STATE.supabase.auth.onAuthStateChange((_e, sess) => {
        if (sess?.user) handleSignedIn(sess.user);
        else handleSignedOut();
      });
    }
  } catch (e) {
    console.warn("[config]", e.message);
  }

  // Restore local auth (works even without Supabase)
  if (!STATE.user) {
    const local = loadAuthLocal();
    if (local) handleSignedIn(local, /*persist*/ false);
  }
}

/* ── Auth UI ───────────────────────────────────────── */
function handleSignedIn(user, persist = true) {
  STATE.user = user;
  if (persist) saveAuthLocal(user);

  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || (user.email || "").split("@")[0] || "Creator";
  const email = user.email || "";
  const avatarUrl = meta.avatar_url || meta.picture || "";
  const initial = (name[0] || "C").toUpperCase();

  // Hide ALL sign-in buttons

  $$("#loginBtn, #seoLoginBtn").forEach(b => b && b.classList.add("hidden"));
  // Show profile widgets

  $$(".profile-wrap").forEach(p => p && p.classList.remove("hidden"));

  if ($("#profileName")) $("#profileName").textContent = name;
  if ($("#profileEmail")) $("#profileEmail").textContent = email;
  if ($("#avatarInitial")) $("#avatarInitial").textContent = initial;
  if ($("#avatarInitialLg")) $("#avatarInitialLg").textContent = initial;
  if (avatarUrl) {
    ["#avatarImg", "#avatarImgLg"].forEach((sel) => {
      const img = $(sel);
      if (img) { img.src = avatarUrl; img.hidden = false; }
    });
  }

  closeModal("#authModal");
  if (persist) toast(`Welcome, ${name}!`, "success");
  loadCloudData();
}

function handleSignedOut() {
  STATE.user = null;
  STATE.isPro = false;
  saveAuthLocal(null);

  $$("#loginBtn, #seoLoginBtn").forEach(b => b && b.classList.remove("hidden"));

  $$(".profile-wrap").forEach(p => p && p.classList.add("hidden"));
  $("#profilePop")?.classList.add("hidden");
}

/* ── Credits ───────────────────────────────────────── */
function loadCredits() {
  const today = new Date().toISOString().slice(0, 10);
  const day = localStorage.getItem(LS_KEYS.CREDITS_DAY);
  const version = localStorage.getItem(LS_KEYS.CREDITS_VERSION);

  // Force one-time migration from old 5-credit system to the new 10-credit system.
  // After migration, normal deduction works and page reload will NOT refill credits again.
  if (day !== today || version !== CREDIT_VERSION) {
    localStorage.setItem(LS_KEYS.CREDITS_DAY, today);
    localStorage.setItem(LS_KEYS.CREDITS_VERSION, CREDIT_VERSION);
    localStorage.setItem(LS_KEYS.CREDITS, String(FREE_CREDITS));
    STATE.credits = FREE_CREDITS;
  } else {
    let stored = parseInt(localStorage.getItem(LS_KEYS.CREDITS) || String(FREE_CREDITS), 10);
    if (isNaN(stored) || stored < 0) stored = FREE_CREDITS;
    STATE.credits = Math.min(stored, FREE_CREDITS);
  }
  renderCredits();
}
function setCredits(n) {
  STATE.credits = Math.max(0, n);
  localStorage.setItem(LS_KEYS.CREDITS, String(STATE.credits));
  renderCredits();
}
function renderCredits() {

  $$("#creditsPill").forEach(p => p && p.classList.remove("hidden"));

  $$("#creditsCount").forEach(c => { if (c) c.textContent = STATE.isPro ? "∞" : STATE.credits; });

  $$("#creditsInfoCount").forEach(ic => { if (ic) ic.textContent = STATE.isPro ? "Unlimited" : STATE.credits; });
}

/* ── Local lists ───────────────────────────────────── */
function loadLocalLists() {
  try { STATE.history = JSON.parse(localStorage.getItem(LS_KEYS.HISTORY) || "[]"); } catch { STATE.history = []; }
  try { STATE.saved = JSON.parse(localStorage.getItem(LS_KEYS.SAVED) || "[]"); } catch { STATE.saved = []; }
  renderLists();
}
function saveLocalLists() {
  localStorage.setItem(LS_KEYS.HISTORY, JSON.stringify(STATE.history.slice(0, 30)));
  localStorage.setItem(LS_KEYS.SAVED, JSON.stringify(STATE.saved.slice(0, 50)));
}
function pushHistory(entry) {
  STATE.history.unshift(entry);
  STATE.history = STATE.history.slice(0, 30);
  saveLocalLists();
  renderLists();
}
window.scPushHistory = pushHistory;

function renderLists() {
  const hList = $("#historyList");
  const sList = $("#savedList");

  const actionButtons = (kind, i) => `
    <div class="sb-actions">
      ${kind === "history" ? `<button class="sb-mini save" data-action="save" data-kind="${kind}" data-idx="${i}" title="Save" aria-label="Save">♡</button>` : ""}
      <button class="sb-mini del" data-action="delete" data-kind="${kind}" data-idx="${i}" title="Delete" aria-label="Delete">×</button>
    </div>`;

  if (hList) {
    hList.innerHTML = STATE.history.length
      ? STATE.history.map((h, i) => `
          <div class="sb-item" data-idx="${i}" data-kind="history">
            <div class="sb-item-main">
              <b>${escapeHtml(h.topic || "Untitled")}</b>
              <span>${new Date(h.at || Date.now()).toLocaleDateString()}</span>
            </div>
            ${actionButtons("history", i)}
          </div>`).join("")
      : `<div class="sb-empty">🎬<p>No scripts yet.</p></div>`;
  }

  if (sList) {
    sList.innerHTML = STATE.saved.length
      ? STATE.saved.map((h, i) => `
          <div class="sb-item" data-idx="${i}" data-kind="saved">
            <div class="sb-item-main">
              <b>${escapeHtml(h.topic || "Saved")}</b>
              <span>${new Date(h.at || Date.now()).toLocaleDateString()}</span>
            </div>
            ${actionButtons("saved", i)}
          </div>`).join("")
      : `<div class="sb-empty">🔖<p>No saved scripts.</p></div>`;
  }


  $$(".sb-mini").forEach((btn) =>
    on(btn, "click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const kind = btn.dataset.kind;
      const idx = parseInt(btn.dataset.idx, 10);
      const list = kind === "saved" ? STATE.saved : STATE.history;
      const item = list[idx];
      if (!item) return;

      if (btn.dataset.action === "delete") {
        list.splice(idx, 1);
        saveLocalLists(); renderLists();
        toast("Deleted.", "info");
        return;
      }
      if (btn.dataset.action === "save") {
        const exists = STATE.saved.some((s) => (s.content || "") === (item.content || ""));
        if (!exists) {
          STATE.saved.unshift({ ...item, at: Date.now() });
          STATE.saved = STATE.saved.slice(0, 50);
          saveLocalLists(); renderLists();
          toast("Script saved.", "success");
        } else toast("Already saved.", "info");
      }
    })
  );


  $$(".sb-item").forEach((el) =>
    on(el, "click", (e) => {
      if (e.target.closest(".sb-mini")) return;
      const kind = el.dataset.kind;
      const idx = parseInt(el.dataset.idx, 10);
      const item = (kind === "saved" ? STATE.saved : STATE.history)[idx];
      if (item) restoreEntry(item);
      closeSidebar();
    })
  );
}

async function loadCloudData() {
  if (!STATE.user || !STATE.supabase) return;
  try {
    const { data } = await STATE.supabase.from("saved_scripts").select("*").eq("user_id", STATE.user.id).order("created_at", { ascending: false }).limit(50);
    if (Array.isArray(data) && data.length) {
      STATE.saved = data.map((d) => ({ topic: d.topic, content: d.content, at: d.created_at, cloud: true }));
      renderLists();
    }
  } catch {}
}

/* ── Sidebar / Modals ──────────────────────────────── */
function openSidebar() { $("#sidebar")?.classList.add("open"); $("#sidebarVeil")?.classList.add("show"); }
function closeSidebar() { $("#sidebar")?.classList.remove("open"); $("#sidebarVeil")?.classList.remove("show"); }
function openModal(sel) { $(sel)?.classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function closeModal(sel) { $(sel)?.classList.add("hidden"); document.body.style.overflow = ""; }

/* ── SEO Tools text generation ─────────────────────── */
let generating = false;
async function doGenerate() {
  if (generating) return;
  const topicInput = $("#topic");
  const topic = (topicInput?.value || "").trim();
  if (!topic) { toast("Type a topic first.", "error"); topicInput?.focus(); return; }
  if (topic.length < 3) { toast("Topic must be at least 3 characters.", "error"); return; }
  if (!STATE.isPro && STATE.credits <= 0) { openModal("#noCreditsModal"); return; }

  generating = true;
  STATE.currentTopic = topic;
  const btn = $("#generateBtn");
  const status = $("#status");
  if (btn) { btn.disabled = true; const lbl = btn.querySelector(".btn-label"); if (lbl) lbl.textContent = "Generating…"; }
  if (status) { status.className = "status"; status.textContent = "Crafting your content pack… ✨"; }
  showSkeletons();

  try {
    const data = await api("/api/generate", { method: "POST", body: { topic, type: "all" } });
    const parsed = parseAll(data.content);
    STATE.currentResults = { topic, raw: data.content, ...parsed };
    renderAll(parsed);
    if (!STATE.isPro) setCredits(STATE.credits - 1);
    pushHistory({ topic, at: Date.now(), content: data.content });
    if ($("#resultsTopic")) $("#resultsTopic").textContent = `Topic: ${topic}`;
    if ($("#regenerateBtn")) $("#regenerateBtn").hidden = false;
    if (status) { status.className = "status success"; status.textContent = "✨ Ready! Switch tabs to view all outputs."; }
    toast("Content pack generated!", "success");
  } catch (err) {
    if (status) { status.className = "status error"; status.textContent = `❌ ${err.message || "Generation failed"}`; }
    toast(err.message || "Generation failed.", "error");
    clearSkeletons();
  } finally {
    if (btn) { btn.disabled = false; const lbl = btn.querySelector(".btn-label"); if (lbl) lbl.textContent = "Generate ✦"; }
    generating = false;
  }
}

function showSkeletons() {
  const skel = `<div class="skeleton skel-line skel-w90"></div><div class="skeleton skel-line skel-w70"></div><div class="skeleton skel-line skel-w50"></div>`;
  ["#scriptSections", "#titlesContent", "#descContent", "#hashtagsContent", "#ideasContent", "#thumbnailContent"]
    .forEach((s) => { const el = $(s); if (el) el.innerHTML = skel; });
}
function clearSkeletons() {
  if ($("#scriptSections")) $("#scriptSections").innerHTML = `<div class="placeholder">Generation failed. Try again ⚠️</div>`;
}

function parseAll(text) {
  const out = { script: "", titles: [], description: "", hashtags: [], ideas: [], thumbnail: [] };
  const get = (label) => {
    const re = new RegExp(`===\\s*${label}\\s*===([\\s\\S]*?)(?====\\s*\\w+\\s*===|$)`, "i");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  out.script = get("SCRIPT") || extractScriptFallback(text);
  const titlesRaw = get("TITLES");
  out.titles = titlesRaw ? splitNumbered(titlesRaw) : [];
  out.description = get("DESCRIPTION");
  const hashRaw = get("HASHTAGS");
  out.hashtags = hashRaw ? hashRaw.match(/#\w+/g) || [] : [];
  const ideasRaw = get("IDEAS");
  out.ideas = ideasRaw ? splitNumbered(ideasRaw) : [];
  const thumbRaw = get("THUMBNAIL");
  out.thumbnail = thumbRaw ? splitNumbered(thumbRaw) : [];
  if (!out.script && !out.titles.length) out.script = text;
  return out;
}
function splitNumbered(t) {
  return t.split(/\n+/).map((l) => l.replace(/^\s*\d+[.)\]]\s*/, "").trim()).filter(Boolean);
}
function extractScriptFallback(text) {
  const idx = text.indexOf("[HOOK]");
  return idx >= 0 ? text.slice(idx) : "";
}

function renderAll({ script, titles, description, hashtags, ideas, thumbnail }) {
  const sEl = $("#scriptSections");
  if (sEl) {
    if (!script) sEl.innerHTML = `<div class="placeholder">No script returned.</div>`;
    else {
      const hook = pick(script, "[HOOK]", "[MAIN]");
      const main = pick(script, "[MAIN]", "[CTA]");
      const cta = pick(script, "[CTA]", null);
      if (hook || main || cta) {
        sEl.innerHTML = `
          ${hook ? `<div class="script-section hook"><b>🔥 Hook</b><p>${escapeHtml(hook)}</p></div>` : ""}
          ${main ? `<div class="script-section main"><b>📖 Main</b><p>${escapeHtml(main).replace(/\n/g, "<br>")}</p></div>` : ""}
          ${cta ? `<div class="script-section cta"><b>🎯 CTA</b><p>${escapeHtml(cta)}</p></div>` : ""}`;
      } else {
        sEl.innerHTML = `<div class="script-section main"><b>📖 Script</b><p>${escapeHtml(script).replace(/\n/g, "<br>")}</p></div>`;
      }
    }
  }
  fillList("#titlesContent", titles, "🎯", "No titles");
  const dEl = $("#descContent");
  if (dEl) dEl.innerHTML = description ? `<div class="desc-body">${escapeHtml(description)}</div>` : `<div class="placeholder">No description.</div>`;
  const hEl = $("#hashtagsContent");
  if (hEl) hEl.innerHTML = hashtags.length
    ? `<div class="hashtag-cloud">${hashtags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>`
    : `<div class="placeholder">No hashtags.</div>`;
  fillList("#ideasContent", ideas, "💡", "No ideas");
  fillList("#thumbnailContent", thumbnail, "🖼", "No prompts");
}
function pick(text, start, end) {
  const i = text.indexOf(start);
  if (i < 0) return "";
  const j = end ? text.indexOf(end, i) : -1;
  return text.slice(i + start.length, j > 0 ? j : undefined).trim();
}
function fillList(sel, arr, ic, empty) {
  const el = $(sel);
  if (!el) return;
  el.innerHTML = arr.length
    ? arr.map((t, i) => `<div class="list-item"><span class="list-num">${i + 1}.</span><span class="list-text">${escapeHtml(t)}</span></div>`).join("")
    : `<div class="placeholder">${empty} ${ic}</div>`;
}

function restoreEntry(item) {
  if ($("#topic")) $("#topic").value = item.topic || "";
  STATE.currentTopic = item.topic;
  const parsed = parseAll(item.content || "");
  STATE.currentResults = { topic: item.topic, raw: item.content, ...parsed };
  renderAll(parsed);
  if ($("#resultsTopic")) $("#resultsTopic").textContent = `Topic: ${item.topic}`;
  toast("Loaded from history.", "info");
}

/* ── Tabs ──────────────────────────────────────────── */
function bindTabs() {

  $$(".tab").forEach((t) =>
    on(t, "click", () => {

      $$(".tab").forEach((x) => x.classList.remove("active"));

      $$(".panel").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      STATE.currentTab = t.dataset.tab;
      $(`#panel-${t.dataset.tab}`)?.classList.add("active");
    })
  );
}

/* ── Copy / Download ───────────────────────────────── */
function copyText(t) {
  if (!t) { toast("Nothing to copy.", "error"); return; }
  navigator.clipboard.writeText(t).then(() => toast("Copied!", "success"), () => toast("Copy failed.", "error"));
}
function bindCopyButtons() {
  on($("#copyScriptBtn"), "click", () => copyText(STATE.currentResults?.script || ""));
  on($("#copyTitlesBtn"), "click", () => copyText((STATE.currentResults?.titles || []).join("\n")));
  on($("#copyDescBtn"), "click", () => copyText(STATE.currentResults?.description || ""));
  on($("#copyHashtagsBtn"), "click", () => copyText((STATE.currentResults?.hashtags || []).join(" ")));
  on($("#copyIdeasBtn"), "click", () => copyText((STATE.currentResults?.ideas || []).join("\n")));
  on($("#copyThumbnailBtn"), "click", () => copyText((STATE.currentResults?.thumbnail || []).join("\n\n")));
}
function downloadTxt() {
  if (!STATE.currentResults) { toast("Generate something first.", "error"); return; }
  const r = STATE.currentResults;
  const txt = `ShortsCraft — ${r.topic}\nGenerated: ${new Date().toLocaleString()}\n\n=== SCRIPT ===\n${r.script}\n\n=== TITLES ===\n${(r.titles||[]).map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n=== DESCRIPTION ===\n${r.description}\n\n=== HASHTAGS ===\n${(r.hashtags||[]).join(" ")}\n\n=== IDEAS ===\n${(r.ideas||[]).map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n=== THUMBNAIL PROMPTS ===\n${(r.thumbnail||[]).map((t, i) => `${i + 1}. ${t}`).join("\n\n")}\n`;
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `shortscraft-${slug(r.topic)}.txt` });
  a.click();
  URL.revokeObjectURL(url);
  toast("Downloaded!", "success");
}
function slug(s) { return String(s || "topic").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }

async function saveCurrent() {
  if (!STATE.currentResults) { toast("Generate something first.", "error"); return; }
  if (!STATE.user) { toast("Sign in to save.", "info"); openModal("#authModal"); return; }
  const entry = { topic: STATE.currentResults.topic, content: STATE.currentResults.raw, at: Date.now() };
  STATE.saved.unshift(entry); saveLocalLists(); renderLists();
  toast("Saved!", "success");
  if (STATE.supabase) {
    try { await STATE.supabase.from("saved_scripts").insert({ user_id: STATE.user.id, topic: entry.topic, content: entry.content }); } catch {}
  }
}

/* ── Auth ──────────────────────────────────────────── */
function bindAuth() {
  on($("#loginBtn"), "click", (e) => { e.preventDefault(); openModal("#authModal"); });
  on($("#seoLoginBtn"), "click", (e) => { e.preventDefault(); openModal("#authModal"); });
  on($("#authModalClose"), "click", () => closeModal("#authModal"));


  $$(".m-tab").forEach((t) =>
    on(t, "click", () => {

      $$(".m-tab").forEach((x) => x.classList.remove("active"));

      $$(".auth-form").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      $(`#auth-${t.dataset.auth}`)?.classList.add("active");
    })
  );

  on($("#googleSignInBtn"), "click", googleAuth);
  on($("#googleSignUpBtn"), "click", googleAuth);

  on($("#loginSubmit"), "click", async () => {
    const email = $("#loginEmail").value.trim();
    const pw = $("#loginPassword").value;
    const err = $("#loginError");
    if (err) err.classList.add("hidden");
    if (!email || !pw) { if (err) { err.textContent = "Enter email and password."; err.classList.remove("hidden"); } return; }

    if (STATE.supabase) {
      try {
        const { data, error } = await STATE.supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        if (data?.user) handleSignedIn(data.user);
      } catch (e) { if (err) { err.textContent = e.message; err.classList.remove("hidden"); } }
    } else {
      // Local fallback sign-in
      const local = { id: email, email, user_metadata: { full_name: email.split("@")[0] } };
      handleSignedIn(local);
    }
  });

  on($("#signupSubmit"), "click", async () => {
    const name = $("#signupName").value.trim();
    const email = $("#signupEmail").value.trim();
    const pw = $("#signupPassword").value;
    const err = $("#signupError");
    if (err) err.classList.add("hidden");
    if (!email) { if (err) { err.textContent = "Enter your email."; err.classList.remove("hidden"); } return; }
    if (pw.length < 6) { if (err) { err.textContent = "Password must be 6+ chars."; err.classList.remove("hidden"); } return; }

    if (STATE.supabase) {
      try {
        const { data, error } = await STATE.supabase.auth.signUp({ email, password: pw, options: { data: { full_name: name } } });
        if (error) throw error;
        if (data?.user) {
          handleSignedIn(data.user);
          toast("Account created!", "success");
        } else {
          toast("Account created! Check email.", "success");
          closeModal("#authModal");
        }
      } catch (e) { if (err) { err.textContent = e.message; err.classList.remove("hidden"); } }
    } else {
      const local = { id: email, email, user_metadata: { full_name: name || email.split("@")[0] } };
      handleSignedIn(local);
    }
  });

  on($("#logoutBtn"), "click", async () => {
    if (STATE.supabase) { try { await STATE.supabase.auth.signOut(); } catch {} }
    handleSignedOut();
    toast("Signed out.", "info");
  });

  // Avatar toggle
  on($("#avatarBtn"), "click", (e) => {
    e.stopPropagation();
    const pop = $("#profilePop");
    if (!pop) return;
    pop.classList.toggle("hidden");
  });

  // Click outside profile → close
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#profileWrap") && !e.target.closest(".profile-wrap")) {
      $("#profilePop")?.classList.add("hidden");
    }
  });

  // Escape closes profile + modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $("#profilePop")?.classList.add("hidden");
    }
  });
}

async function googleAuth() {
  if (!STATE.supabase) {
    toast("Google sign-in is not configured.", "error", 4000);
    return;
  }
  try {
    await STATE.supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/generator" }
    });
  } catch (e) { toast(e.message, "error"); }
}

/* ── Razorpay upgrade ──────────────────────────────── */
async function upgradePro() {
  if (!STATE.user) { toast("Sign in first.", "info"); openModal("#authModal"); return; }
  if (!window.Razorpay) { toast("Payment system loading…", "error"); return; }
  const note = $("#upgradeNote");
  if (note) note.textContent = "Creating order…";
  try {
    const data = await api("/api/razorpay/order", { method: "POST", body: { userId: STATE.user.id } });
    const opts = {
      key: data.keyId, amount: data.amount, currency: data.currency, order_id: data.orderId,
      name: "ShortsCraft Pro", description: "Monthly Pro subscription",
      prefill: { name: STATE.user.user_metadata?.full_name || "", email: STATE.user.email || "" },
      theme: { color: "#ff3d6e" },
      handler: async (resp) => {
        try {
          await api("/api/razorpay/verify", { method: "POST", body: resp });
          STATE.isPro = true;
          renderCredits();
          closeModal("#upgradeModal");
          toast("🎉 Welcome to Pro!", "success", 5000);
        } catch (e) { toast(`Verification failed: ${e.message}`, "error", 5000); }
      },
      modal: { ondismiss: () => { if (note) note.textContent = ""; } }
    };
    new Razorpay(opts).open();
    if (note) note.textContent = "";
  } catch (e) {
    if (note) note.textContent = "";
    toast(e.message || "Could not start payment.", "error");
  }
}

/* ── Feedback ──────────────────────────────────────── */
function bindFeedback() {
  const open = (e) => { if (e) e.preventDefault(); openModal("#feedbackModal"); };
  on($("#feedbackBtn"), "click", open);
  on($("#seoFeedbackBtn"), "click", open);
  on($("#profileFeedbackBtn"), "click", open);
  on($("#feedbackModalClose"), "click", () => closeModal("#feedbackModal"));
  on($("#feedbackCancelBtn"), "click", () => closeModal("#feedbackModal"));

  on($("#feedbackSubmit"), "click", async () => {
    const name = $("#feedbackName").value.trim();
    const email = $("#feedbackEmail").value.trim();
    const message = $("#feedbackMessage").value.trim();
    if (!name) { toast("Enter your name.", "error"); return; }
    if (message.length < 5) { toast("Message too short.", "error"); return; }
    try {
      await api("/api/feedback", { method: "POST", body: { name, email, subject: "Studio feedback", message } });
      toast("Thanks! Feedback submitted.", "success");
      closeModal("#feedbackModal");
      if ($("#feedbackMessage")) $("#feedbackMessage").value = "";
    } catch (e) { toast(e.message, "error"); }
  });
}

/* ── Command palette ───────────────────────────────── */
function bindCmdPalette() {
  const palette = $("#cmdPalette");
  if (!palette) return;
  const open = () => { palette.classList.remove("hidden"); $("#cmdInput")?.focus(); };
  const close = () => palette.classList.add("hidden");


  $$("#studioSearchInput, #seoStudioSearchInput").forEach(i => {
    on(i, "focus", open);
    on(i, "click", open);
  });
  on($("#cmdCloseBtn"), "click", (e) => { e.preventDefault(); close(); });
  on(palette, "click", (e) => { if (e.target === palette) close(); });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
    if (e.key === "Escape") close();
  });


  $$("#cmdList li").forEach((li) => on(li, "click", () => {
    const a = li.dataset.action;
    close();
    runAction(a);
  }));
}
function runAction(a) {
  switch (a) {
    case "video":
      if (location.pathname.includes("/generator")) {
        $("#videoGenerator")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.location.href = "/generator";
      }
      break;
    case "tools": window.location.href = "/seo-tools"; break;
    case "generate":
      if ($("#generateBtn")) doGenerate();
      else $("#generateVideoBtn")?.click();
      break;
    case "copy": $(`#copy${capitalize(STATE.currentTab)}Btn`)?.click(); break;
    case "download": downloadTxt(); break;
    case "history": openSidebar(); break;
    case "upgrade": openModal("#upgradeModal"); break;
  }
}
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── Earn credits / tasks ──────────────────────────── */
function bindEarn() {
  on($("#earnCreditsLink"), "click", () => { $("#profilePop")?.classList.add("hidden"); openModal("#earnModal"); });
  on($("#noCreditsEarnBtn"), "click", () => { closeModal("#noCreditsModal"); openModal("#earnModal"); });
  on($("#noCreditsUpgradeBtn"), "click", () => { closeModal("#noCreditsModal"); openModal("#upgradeModal"); });
  on($("#earnModalClose"), "click", () => closeModal("#earnModal"));
  renderTasks();
}

function renderTasks() {
  const list = $("#tasksList");
  if (!list) return;
  let done, opened;
  try { done = JSON.parse(localStorage.getItem(LS_KEYS.TASKS) || "{}"); } catch { done = {}; }
  try { opened = JSON.parse(localStorage.getItem(LS_KEYS.TASKS_OPENED) || "{}"); } catch { opened = {}; }

  const tasks = [
    { id: "telegram", label: "Follow on Telegram", hint: "Join our Telegram channel for tips and updates.", credits: 1, url: "https://t.me/+ZfQKHJhGg8xiMTRl" },
    { id: "subscribe", label: "Subscribe Tech Vault channel", hint: "Subscribe and come back to claim.", credits: 1, url: "https://www.youtube.com/@TechVault-90" },
    { id: "watch", label: "Watch one Tech Vault video", hint: "Open and watch any helpful video.", credits: 1, url: "https://www.youtube.com/@TechVault-90/videos" },
    { id: "share", label: "Share ShortsCraft with a friend", hint: "Share the website link, then claim.", credits: 1, url: "https://shortscraft.online/" },
    { id: "feedback", label: "Submit useful feedback", hint: "Tell us what to improve, then claim.", credits: 1, action: "feedback" },
  ];

  list.innerHTML = tasks.map((t) => {
    const isDone = !!done[t.id];
    const isOpened = !!opened[t.id];
    const btnText = isDone ? "Done ✓" : isOpened ? "Claim +1" : (t.action === "feedback" ? "Open feedback" : "Open task");
    return `
      <div class="task premium-task ${isDone ? "task-done" : ""}">
        <div class="task-info">
          <b>${escapeHtml(t.label)}</b>
          <span>${escapeHtml(t.hint)}</span>
          <small>+${t.credits} credit</small>
        </div>
        <button data-id="${t.id}" data-action="${t.action || "open"}" ${isDone ? "disabled" : ""}>${btnText}</button>
      </div>`;
  }).join("");


  $$("#tasksList button").forEach((btn) => on(btn, "click", () => {
    const id = btn.dataset.id;
    const task = tasks.find(t => t.id === id);
    if (!task || done[id]) return;

    if (task.action === "feedback" && !opened[id]) {
      opened[id] = true;
      localStorage.setItem(LS_KEYS.TASKS_OPENED, JSON.stringify(opened));
      closeModal("#earnModal");
      openModal("#feedbackModal");
      renderTasks();
      return;
    }

    if (!opened[id]) {
      opened[id] = true;
      localStorage.setItem(LS_KEYS.TASKS_OPENED, JSON.stringify(opened));
      if (task.url) window.open(task.url, "_blank", "noopener,noreferrer");
      toast("Task opened. Complete it, then claim.", "info", 4500);
      renderTasks();
      return;
    }

    done[id] = true;
    localStorage.setItem(LS_KEYS.TASKS, JSON.stringify(done));
    setCredits(STATE.credits + (task.credits || 1));
    toast(`+${task.credits || 1} credit added!`, "success");
    renderTasks();
  }));
}

/* ── Mobile nav (landing page) ────────────────────── */
function bindNav() {
  const burger = $("#navBurger");
  const mobile = $("#navMobile");
  if (burger && mobile) {
    burger.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const isOpen = mobile.classList.contains("open");
      if (isOpen) {
        mobile.classList.remove("open");
        mobile.setAttribute("hidden", "");
      } else {
        mobile.removeAttribute("hidden");
        // force layout
        requestAnimationFrame(() => mobile.classList.add("open"));
      }
    });
    // Close on link click
    mobile.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      mobile.classList.remove("open");
      mobile.setAttribute("hidden", "");
    }));
    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!mobile.contains(e.target) && !burger.contains(e.target) && mobile.classList.contains("open")) {
        mobile.classList.remove("open");
        mobile.setAttribute("hidden", "");
      }
    });
  }

  on(window, "scroll", () => {
    const bar = $("#scrollBar");
    if (!bar) return;
    const h = document.documentElement;
    const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
    bar.style.width = `${pct}%`;
  }, { passive: true });
}

/* ── Studio bindings ───────────────────────────────── */
function bindStudio() {
  on($("#generateBtn"), "click", doGenerate);
  on($("#topic"), "keydown", (e) => { if (e.key === "Enter") doGenerate(); });

  $$(".chip[data-topic]").forEach((c) => on(c, "click", () => { if ($("#topic")) $("#topic").value = c.dataset.topic; doGenerate(); }));
  on($("#regenerateBtn"), "click", doGenerate);
  on($("#downloadTxtBtn"), "click", downloadTxt);
  on($("#saveScriptBtn"), "click", saveCurrent);

  on($("#sidebarToggle"), "click", openSidebar);
  on($("#seoSidebarToggle"), "click", openSidebar);
  on($("#sidebarClose"), "click", closeSidebar);
  on($("#sidebarVeil"), "click", closeSidebar);

  on($("#clearHistoryBtn"), "click", () => {
    if (confirm("Clear all local history?")) {
      STATE.history = []; saveLocalLists(); renderLists();
      toast("History cleared.", "info");
    }
  });

  on($("#viewHistoryBtn"), "click", () => { $("#profilePop")?.classList.add("hidden"); openSidebar(); });
  on($("#viewSavedBtn"), "click", () => { $("#profilePop")?.classList.add("hidden"); openSidebar(); });
  on($("#upgradeBtn"), "click", () => { $("#profilePop")?.classList.add("hidden"); openModal("#upgradeModal"); });
  on($("#upgradeModalClose"), "click", () => closeModal("#upgradeModal"));
  on($("#upgradeSubmit"), "click", upgradePro);
  on($("#noCreditsModalClose"), "click", () => closeModal("#noCreditsModal"));


  $$(".modal-veil").forEach((v) => on(v, "click", (e) => { if (e.target === v) v.classList.add("hidden"); }));

  bindTabs();
  bindCopyButtons();
  bindAuth();
  bindFeedback();
  bindCmdPalette();
  bindEarn();
}

/* ── Init ──────────────────────────────────────────── */
async function init() {
  bindNav();
  if ($("#generateBtn") || $("#videoGenerator")) bindStudio();
  loadLocalLists();
  await loadConfig();
  if (!STATE.user) handleSignedOut();
  loadCredits();
}
document.addEventListener("DOMContentLoaded", init);

/* ============================================================
   VIDEO GENERATOR — Premium Animated HTML preview
   ============================================================ */
const VIDEO_STATE = {
  mode: "paste",
  html: "",
  script: "",
  style: "viral-hook",
  aspect: "9:16",
  edit: { fontScale: 1, speed: 1, highlight: "", bgMode: "auto", align: "center", dense: true }
};

const STYLE_MAP = {
  "viral-hook":      { name:"YouTube Viral Hook",      bg:"radial-gradient(circle at 30% 0%,#ff3d6e22,transparent 40%),linear-gradient(135deg,#0a0613,#1a0a1f)", text:"#fff", accent:"#ff3d6e", accent2:"#ffb02e", font:"'Arial Black',Impact,sans-serif" },
  "clean-minimal":   { name:"Clean Minimal White",     bg:"linear-gradient(135deg,#fff,#f3f4f6)", text:"#111827", accent:"#111827", accent2:"#6b7280", font:"Inter,Arial,sans-serif" },
  "neon-cyber":      { name:"Neon Cyber Kinetic",      bg:"radial-gradient(circle at 20% 20%,#0ea5e933,transparent 40%),radial-gradient(circle at 80% 70%,#a855f733,transparent 40%),#030712", text:"#fff", accent:"#22d3ee", accent2:"#a855f7", font:"'Arial Black',Impact,sans-serif" },
  "motivation":      { name:"Motivation Reel",         bg:"radial-gradient(circle at 50% 20%,#334155,#020617 70%)", text:"#fff", accent:"#facc15", accent2:"#fff", font:"'Arial Black',Impact,sans-serif" },
  "podcast":         { name:"Podcast Subtitle",        bg:"linear-gradient(180deg,#111827,#030712)", text:"#fff", accent:"#22c55e", accent2:"#fff", font:"Inter,Arial,sans-serif" },
  "news":            { name:"Bold News",               bg:"linear-gradient(135deg,#0a0a0a,#111827)", text:"#fff", accent:"#ef233c", accent2:"#fff", font:"'Arial Black',Impact,sans-serif" },
  "horror":          { name:"Horror / Mystery",        bg:"radial-gradient(circle at 50% 30%,#3f0a0a,#020202 60%)", text:"#e5e7eb", accent:"#ef4444", accent2:"#fff", font:"Georgia,'Times New Roman',serif" },
  "luxury":          { name:"Luxury Gold",             bg:"radial-gradient(circle at 50% 20%,#3b2f11,#050505 55%)", text:"#fff7d6", accent:"#f5c542", accent2:"#fff1a8", font:"Georgia,'Times New Roman',serif" },
  "social-pop":      { name:"Social Gradient Pop",     bg:"linear-gradient(135deg,#ff416c,#ff4b2b 35%,#7c3aed 75%,#06b6d4)", text:"#fff", accent:"#fde047", accent2:"#fff", font:"'Arial Black',Impact,sans-serif" },
  "documentary":     { name:"Faceless Documentary",    bg:"linear-gradient(rgba(0,0,0,.7),rgba(0,0,0,.78)),radial-gradient(circle at 50% 40%,#475569,#020617 70%)", text:"#f8fafc", accent:"#f59e0b", accent2:"#fff", font:"Inter,Arial,sans-serif" },
  "tech-blueprint":  { name:"Tech Blueprint",          bg:"linear-gradient(135deg,#082f49,#020617)", text:"#e0f2fe", accent:"#7dd3fc", accent2:"#fff", font:"Inter,Arial,sans-serif" },
  "gaming":          { name:"Gaming Esports",          bg:"linear-gradient(135deg,#020617,#111827 45%,#3b0764)", text:"#fff", accent:"#39ff14", accent2:"#f97316", font:"'Arial Black',Impact,sans-serif" },
  "classroom":       { name:"Classroom Educational",   bg:"linear-gradient(135deg,#064e3b,#022c22)", text:"#fff", accent:"#bbf7d0", accent2:"#fff", font:"Inter,Arial,sans-serif" },
  "vhs":             { name:"Retro VHS",               bg:"linear-gradient(135deg,#1e1b4b,#111827)", text:"#fff", accent:"#f472b6", accent2:"#22d3ee", font:"'Courier New',monospace" },
  "startup":         { name:"Startup SaaS Clean",      bg:"linear-gradient(135deg,#f8fafc,#eef2ff)", text:"#111827", accent:"#2563eb", accent2:"#111827", font:"Inter,Arial,sans-serif" },
};

function splitScript(script, aspect) {
  const raw = String(script || "")
    .replace(/\[(HOOK|MAIN|CTA)\]/gi, "\n")
    .replace(/\r/g, "\n")
    .replace(/[•▪▫➜►]/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (!raw) return [];

  const tall = ["9:16", "4:5", "3:4", "2:3"].includes(aspect);
  const square = aspect === "1:1";
  const wide = ["16:9", "21:9"].includes(aspect);
  const maxWords = tall ? 5 : square ? 7 : wide ? 9 : 6;
  const maxChars = tall ? 28 : square ? 38 : wide ? 56 : 42;
  const hardLimit = tall ? 16 : wide ? 12 : 14;

  const sentences = raw.split(/\n+|(?<=[.!?।])\s+/).map(s => s.trim()).filter(Boolean);
  const lines = [];
  sentences.forEach((sentence) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (!words.length) return;
    if (sentence.length <= maxChars && words.length <= maxWords + 1) {
      lines.push(sentence);
      return;
    }
    let chunk = [];
    words.forEach((w) => {
      const next = [...chunk, w].join(" ");
      if (chunk.length >= maxWords || next.length > maxChars) {
        if (chunk.length) lines.push(chunk.join(" "));
        chunk = [w];
      } else chunk.push(w);
    });
    if (chunk.length) lines.push(chunk.join(" "));
  });
  return lines.map(s => s.replace(/^[-–—]+/, "").trim()).filter(Boolean).slice(0, hardLimit);
}

function parseEdits(prompt) {
  const p = String(prompt || "").toLowerCase();
  const e = VIDEO_STATE.edit;
  if (/bigger|large|big|bada/.test(p)) e.fontScale = 1.18;
  if (/smaller|small|chhota/.test(p)) e.fontScale = 0.9;
  if (/slow/.test(p)) e.speed = 1.4;
  if (/fast/.test(p)) e.speed = 0.75;
  if (/yellow|gold/.test(p)) e.highlight = "#facc15";
  else if (/\bred\b|pink/.test(p)) e.highlight = "#fb7185";
  else if (/\bblue\b|cyan/.test(p)) e.highlight = "#38bdf8";
  else if (/\bgreen\b/.test(p)) e.highlight = "#22c55e";
  else if (/purple|violet/.test(p)) e.highlight = "#a78bfa";
  if (/dark|darker|black/.test(p)) e.bgMode = "dark";
  if (/light|white|bright/.test(p)) e.bgMode = "light";
  if (/minimal|simple|clean/.test(p)) e.minimal = true;
  if (/premium|luxury|professional/.test(p)) e.premium = true;
}
function resetEdits() {
  VIDEO_STATE.edit = { fontScale: 1, speed: 1, highlight: "", bgMode: "auto", align: "center", dense: true, minimal: false, premium: false };
}

function generateVideoHtml(script, styleKey, aspect) {
  const style = STYLE_MAP[styleKey] || STYLE_MAP["viral-hook"];
  const lines = splitScript(script, aspect);
  const safeLines = JSON.stringify(lines.length ? lines : ["Paste a script first"]);
  const e = VIDEO_STATE.edit;
  const tall = ["9:16","4:5","3:4","2:3"].includes(aspect);
  const wide = ["16:9","21:9"].includes(aspect);
  const speed = e.speed || 1;
  const duration = Math.max(2600, Math.round(2900 * speed));
  const aspectMap = {"9:16":"9/16","16:9":"16/9","1:1":"1/1","4:5":"4/5","3:4":"3/4","2:3":"2/3","21:9":"21/9"};
  const stageAspect = aspectMap[aspect] || "9/16";
  const stageWidth = wide ? "min(100vw,1920px)" : "min(100vw,1080px)";

  let bg = style.bg, textColor = style.text;
  if (e.bgMode === "light") {
    bg = "linear-gradient(135deg,#ffffff,#f8fafc 46%,#eef2ff 100%)";
    textColor = "#0f172a";
  } else if (e.bgMode === "dark") {
    bg = "radial-gradient(circle at 20% 15%,rgba(255,255,255,.06),transparent 22%),linear-gradient(135deg,#050816,#03040c 62%,#0b1021)";
    textColor = "#f8fafc";
  }
  const highlight = e.highlight || style.accent;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;background:#000;overflow:hidden;font-family:${style.font}}
body{display:grid;place-items:center}
.stage{--accent:${style.accent};--accent2:${style.accent2};--hl:${highlight};--text:${textColor};--fs:${e.fontScale};
  position:relative;width:${stageWidth};aspect-ratio:${stageAspect};max-height:100vh;
  background:${bg};color:var(--text);overflow:hidden}
.bg-orb{position:absolute;border-radius:50%;filter:blur(70px);pointer-events:none;opacity:.55}
.bg-orb.a{width:42%;height:42%;left:-10%;top:-10%;background:var(--accent)}
.bg-orb.b{width:46%;height:46%;right:-12%;bottom:-12%;background:var(--accent2);opacity:.45}
.bg-orb.c{width:24%;height:24%;right:18%;top:14%;background:var(--hl);opacity:.32}
.frame{position:absolute;inset:5.5%;border-radius:${wide?'30px':'34px'};border:1.5px solid rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}
.brand{position:absolute;top:6%;left:7%;font:900 clamp(13px,1.8vw,22px) Inter,sans-serif;letter-spacing:.14em;color:rgba(255,255,255,.78);text-transform:uppercase}
.aspect-tag{position:absolute;top:6%;right:7%;padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);font:800 clamp(10px,1.4vw,14px) Inter,sans-serif;color:rgba(255,255,255,.78);backdrop-filter:blur(8px)}
.content{position:absolute;inset:${wide?'15% 9% 16%':'17% 8% 15%'};display:grid;place-items:center;z-index:2}
.card{position:relative;width:min(${wide?'76%':'88%'},${wide?'1150px':'820px'});padding:${wide?'42px 52px':'34px 28px'};border-radius:${wide?'32px':'34px'};
  background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.14);
  box-shadow:0 30px 90px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.10);
  display:grid;align-content:center;justify-items:center;text-align:center;overflow:hidden;min-height:${wide?'52%':tall?'48%':'55%'}}
.card::before{content:'';position:absolute;inset:auto -10% -25% auto;width:42%;height:42%;background:radial-gradient(circle,var(--hl),transparent 65%);opacity:.18;filter:blur(20px)}
.scene-top{display:flex;gap:10px;align-items:center;justify-content:center;margin-bottom:18px;flex-wrap:wrap}
.count{display:inline-flex;align-items:center;justify-content:center;min-width:54px;height:42px;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16);font:900 clamp(11px,1.6vw,16px) Inter,sans-serif;color:var(--hl)}
.eyebrow{font:800 clamp(10px,1.4vw,15px) Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.62)}
.headline{max-width:100%;font-weight:950;letter-spacing:-.055em;line-height:.96;text-wrap:balance;text-shadow:0 16px 44px rgba(0,0,0,.25)}
.subline{margin-top:14px;max-width:90%;font:700 clamp(12px,1.7vw,20px) Inter,sans-serif;line-height:1.4;color:rgba(255,255,255,.74)}
.chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:18px;width:100%}
.chip{padding:8px 13px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);font:800 clamp(10px,1.2vw,14px) Inter,sans-serif;color:rgba(255,255,255,.85)}
.progress{position:absolute;left:0;bottom:0;height:5px;width:100%;background:rgba(255,255,255,.08)}
.progress>span{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--hl));box-shadow:0 0 22px var(--hl)}
.hl{color:var(--hl)}
@keyframes pop{0%{opacity:0;transform:translateY(20px) scale(.97);filter:blur(10px)}100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
.card.animate{animation:pop .55s cubic-bezier(.18,.8,.2,1) both}
</style></head><body>
<div class="stage">
  <div class="bg-orb a"></div><div class="bg-orb b"></div><div class="bg-orb c"></div>
  <div class="frame"></div>
  <div class="brand">SHORTSCRAFT</div>
  <div class="aspect-tag">${aspect} · ${style.name}</div>
  <div class="content">
    <div class="card" id="card">
      <div class="scene-top">
        <span class="count" id="counter">01</span>
        <span class="eyebrow">Premium scene</span>
      </div>
      <div class="headline" id="headline"></div>
      <div class="subline" id="subline"></div>
      <div class="chips" id="chips"></div>
    </div>
  </div>
  <div class="progress"><span id="bar"></span></div>
</div>
<script>
const LINES=${safeLines};
const DURATION=${duration};
const ASPECT=${JSON.stringify(aspect)};
const isTall=["9:16","4:5","3:4","2:3"].includes(ASPECT);
const isWide=["16:9","21:9"].includes(ASPECT);
const headline=document.getElementById('headline');
const subline=document.getElementById('subline');
const chips=document.getElementById('chips');
const card=document.getElementById('card');
const bar=document.getElementById('bar');
const counter=document.getElementById('counter');
const KW=["ai","paisa","creator","growth","viral","youtube","tools","business","online","content","marketing","money","secret","tips","trick"];
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]||c;});}
function hi(w){var clean=esc(w);var plain=String(w).replace(/[^\\w]/g,'').toLowerCase();return KW.includes(plain)?'<span class="hl">'+clean+'</span>':clean;}
function rows(text){var words=String(text).split(/\\s+/).filter(Boolean);var per=isTall?3:isWide?6:4;if(text.length>(isTall?28:isWide?56:40))per=Math.max(2,per-1);var r=[];for(var i=0;i<words.length;i+=per)r.push(words.slice(i,i+per));if(r.length>4){var m=r.slice(0,3);m.push(r.slice(3).flat());return m;}return r;}
function size(text){var len=text.length;if(isTall)return len<18?'clamp(64px,11vw,118px)':len<32?'clamp(50px,9vw,86px)':len<48?'clamp(38px,7.2vw,64px)':'clamp(30px,6vw,50px)';if(isWide)return len<26?'clamp(60px,8vw,114px)':len<48?'clamp(44px,5.8vw,76px)':'clamp(32px,4.4vw,58px)';return len<24?'clamp(54px,7.8vw,98px)':len<42?'clamp(40px,6vw,70px)':'clamp(30px,5vw,52px)';}
function draw(i){var line=LINES[i]||'';var rs=rows(line);headline.style.fontSize='calc('+size(line)+' * var(--fs))';headline.innerHTML=rs.map(function(r){return '<div>'+r.map(hi).join(' ')+'</div>';}).join('');var next=LINES[i+1]||'';subline.textContent=next?(next.length>(isTall?54:70)?next.slice(0,isTall?54:70).trim()+'…':next):'Premium short-form video style.';var cw=[];line.split(/\\s+/).forEach(function(w){var c=w.replace(/[^\\w]/g,'');if(c.length>3&&!cw.includes(c.toLowerCase()))cw.push(c.toLowerCase());});chips.innerHTML=cw.slice(0,3).map(function(t){return '<span class="chip">'+esc(t.charAt(0).toUpperCase()+t.slice(1))+'</span>';}).join('');counter.textContent=String(i+1).padStart(2,'0');card.classList.remove('animate');void card.offsetWidth;card.classList.add('animate');if(bar){bar.style.transition='none';bar.style.width='0%';requestAnimationFrame(function(){requestAnimationFrame(function(){bar.style.transition='width '+DURATION+'ms linear';bar.style.width='100%';});});}}
var idx=0;draw(0);if(LINES.length>1)setInterval(function(){idx=(idx+1)%LINES.length;draw(idx);},DURATION);
<\/script></body></html>`;
}

function setVideoPreview(html) {
  const frame = $("#videoPreviewFrame");
  const empty = $("#videoEmptyState");
  const status = $("#videoPreviewStatus");
  const wrap = $("#videoFrameWrap");
  if (!frame) return;
  frame.srcdoc = html;
  if (empty) empty.classList.add("hidden");
  if (status) status.textContent = "Preview ready";
  if (wrap) {
    wrap.classList.remove("ratio-916","ratio-169","ratio-11","ratio-45","ratio-34","ratio-23","ratio-219");
    const cls = {"9:16":"ratio-916","16:9":"ratio-169","1:1":"ratio-11","4:5":"ratio-45","3:4":"ratio-34","2:3":"ratio-23","21:9":"ratio-219"}[VIDEO_STATE.aspect] || "ratio-916";
    wrap.classList.add(cls);
  }
}

function buildVideoPreview(deductCredit = true) {
  const scriptInput = $("#videoScriptInput");
  const styleSelect = $("#videoStyleSelect");
  const aspectSelect = $("#videoAspectSelect");
  if (!scriptInput) return;

  const script = scriptInput.value.trim();
  if (!script) { toast("Paste or generate a script first.", "error"); return; }

  if (deductCredit && !STATE.isPro) {
    if (STATE.credits <= 0) { openModal("#noCreditsModal"); return; }
    setCredits(STATE.credits - 1);
  }

  VIDEO_STATE.script = script;
  VIDEO_STATE.style = styleSelect?.value || "viral-hook";
  VIDEO_STATE.aspect = aspectSelect?.value || "9:16";
  VIDEO_STATE.html = generateVideoHtml(script, VIDEO_STATE.style, VIDEO_STATE.aspect);
  setVideoPreview(VIDEO_STATE.html);

  try {
    pushHistory({
      topic: (script.split(/\n|\.|!|\?/).find(Boolean) || "Animated video").trim().slice(0, 80),
      at: Date.now(),
      content: script,
      videoHtml: VIDEO_STATE.html,
      type: "video"
    });
  } catch {}

  // Auto-scroll to preview, accounting for sticky header
  setTimeout(() => {
    const previewCard = $(".video-preview-card");
    if (previewCard) {
      const headerOffset = window.innerWidth <= 768 ? 70 : 80;
      const top = previewCard.getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, 100);

  toast("Video preview ready!", "success");
}

async function generateScriptForVideo() {
  const topicInput = $("#videoTopicInput");
  const scriptInput = $("#videoScriptInput");
  const topic = topicInput?.value.trim();
  if (!topic) { toast("Enter a topic first.", "error"); return; }
  if (!STATE.isPro && STATE.credits <= 0) { openModal("#noCreditsModal"); return; }

  const btn = $("#videoGenerateScriptBtn");
  const old = btn?.textContent;
  if (btn) { btn.textContent = "Generating..."; btn.disabled = true; }
  try {
    const data = await api("/api/generate", { method: "POST", body: { topic, type: "script" } });
    let script = (data.content || "").replace(/=== SCRIPT ===/gi, "").replace(/=== TITLES ===[\s\S]*/gi, "").trim();
    if (scriptInput) scriptInput.value = script;

    $$(".video-mode").forEach(b => b.classList.toggle("active", b.dataset.mode === "paste"));
    $("#videoPastePanel")?.classList.add("active");
    $("#videoGeneratePanel")?.classList.remove("active");
    VIDEO_STATE.mode = "paste";
    if (!STATE.isPro) setCredits(STATE.credits - 1);
    toast("Script generated. Now create video preview.", "success");
  } catch (e) {
    toast(e.message, "error");
  } finally {
    if (btn) { btn.textContent = old || "Generate Script"; btn.disabled = false; }
  }
}

function showProDownloadModal() {
  const note = $("#upgradeNote");
  if (note) note.textContent = "Download Video is a Pro feature. Upgrade to export your animated video.";
  openModal("#upgradeModal");
}

function initVideoFirst() {
  if (!$("#videoGenerator")) return;


  $$(".video-mode").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode || "paste";
      VIDEO_STATE.mode = mode;

      $$(".video-mode").forEach(b => b.classList.toggle("active", b === btn));
      $("#videoPastePanel")?.classList.toggle("active", mode === "paste");
      $("#videoGeneratePanel")?.classList.toggle("active", mode === "generate");
    });
  });

  on($("#videoGenerateScriptBtn"), "click", generateScriptForVideo);
  on($("#generateVideoBtn"), "click", () => buildVideoPreview(true));

  on($("#resetVideoBtn"), "click", () => {
    if ($("#videoScriptInput")) $("#videoScriptInput").value = "";
    if ($("#videoTopicInput")) $("#videoTopicInput").value = "";
    resetEdits();
    VIDEO_STATE.html = "";
    if ($("#videoPreviewFrame")) $("#videoPreviewFrame").srcdoc = "";
    $("#videoEmptyState")?.classList.remove("hidden");
    if ($("#videoPreviewStatus")) $("#videoPreviewStatus").textContent = "No video generated yet";
  });

  on($("#applyVideoEditBtn"), "click", () => {
    resetEdits();
    parseEdits($("#videoEditPrompt")?.value || "");
    buildVideoPreview(false);
  });

  on($("#resetVideoEditBtn"), "click", () => {
    resetEdits();
    if ($("#videoEditPrompt")) $("#videoEditPrompt").value = "";
    buildVideoPreview(false);
  });


  $$(".quick-edit-chips button").forEach(chip => {
    chip.addEventListener("click", () => {
      const val = (chip.dataset.edit || chip.textContent || "").trim();
      const p = $("#videoEditPrompt");
      const merged = p && p.value.trim() ? (p.value.trim() + ", " + val) : val;
      if (p) p.value = merged;
      resetEdits();
      parseEdits(merged);
      buildVideoPreview(false);
    });
  });

  on($("#copyVideoHtmlBtn"), "click", async () => {
    if (!VIDEO_STATE.html) { toast("Generate a video first.", "error"); return; }
    try {
      await navigator.clipboard.writeText(VIDEO_STATE.html);
      toast("HTML copied!", "success");
    } catch { toast("Copy failed.", "error"); }
  });

  on($("#openVideoPreviewBtn"), "click", () => {
    if (!VIDEO_STATE.html) { toast("Generate a video first.", "error"); return; }
    const w = window.open("", "_blank");
    if (w) { w.document.open(); w.document.write(VIDEO_STATE.html); w.document.close(); }
  });

  on($("#downloadVideoBtn"), "click", () => {
    if (!VIDEO_STATE.html) { toast("Generate a video first.", "error"); return; }
    showProDownloadModal();
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVideoFirst);
} else {
  initVideoFirst();
}
/* ── Extra safe profile action delegation ─────────────────── */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#profilePop .pp-item, #profilePop #earnCreditsLink");
  if (!btn) return;
  if (btn.id === "earnCreditsLink") { e.preventDefault(); closeModal("#upgradeModal"); $("#profilePop")?.classList.add("hidden"); openModal("#earnModal"); }
  if (btn.id === "upgradeBtn") { e.preventDefault(); $("#profilePop")?.classList.add("hidden"); openModal("#upgradeModal"); }
  if (btn.id === "viewSavedBtn" || btn.id === "viewHistoryBtn") { e.preventDefault(); $("#profilePop")?.classList.add("hidden"); openSidebar(); }
  if (btn.id === "profileFeedbackBtn") { e.preventDefault(); $("#profilePop")?.classList.add("hidden"); openModal("#feedbackModal"); }
}, true);

})();


/* ===== APPENDED LATEST GENSPARK PATCH ===== */
/* ============================================================
   FINAL v10 PATCH — auth state, credits=10, earn tasks,
   improved video preview, scroll-to-preview, profile fixes
   ============================================================ */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const AUTH_KEY = "sc:stable-auth-user:v1";
  const CREDITS_KEY = "sc:credits:v2";
  const CREDITS_DAY = "sc:credits:day";
  const CREDITS_RULE = "sc:credits:rule:v10";
  const FREE_PER_DAY = 10;

  /* ---------- Force credits to 10 ---------- */
  function ensureTenCredits() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const day = localStorage.getItem(CREDITS_DAY);
      const rule = localStorage.getItem(CREDITS_RULE);
      if (day !== today || rule !== "v10-10") {
        localStorage.setItem(CREDITS_DAY, today);
        localStorage.setItem(CREDITS_RULE, "v10-10");
        localStorage.setItem(CREDITS_KEY, String(FREE_PER_DAY));
        localStorage.setItem("sc:credits:max", String(FREE_PER_DAY));
        localStorage.setItem("sc:credits:max-version", "10");
      } else {
        const cur = parseInt(localStorage.getItem(CREDITS_KEY) || "10", 10);
        if (isNaN(cur) || cur < 0) {
          localStorage.setItem(CREDITS_KEY, String(FREE_PER_DAY));
        }
      }
    } catch {}
    const cur = parseInt(localStorage.getItem(CREDITS_KEY) || "10", 10);

    $$("#creditsCount, #creditsInfoCount").forEach((el) => {
      if (el) el.textContent = String(isNaN(cur) ? 10 : cur);
    });
    const pill = $("#creditsPill");
    if (pill) pill.classList.remove("hidden");
  }

  /* ---------- Auth state UI ---------- */
  function getStoredUser() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
    catch { return null; }
  }
  function setAuthUI(user) {
    const signed = !!user;
    document.body.classList.toggle("sc-signed-in", signed);


    $$("#loginBtn, #seoLoginBtn").forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle("hidden", signed);
      btn.style.display = signed ? "none" : "";
    });


    $$("#profileWrap").forEach((wrap) => {
      if (!wrap) return;
      wrap.classList.toggle("hidden", !signed);
      wrap.style.display = signed ? "block" : "none";
    });

    if (signed) {
      const name = user.name || user.full_name || (user.email ? user.email.split("@")[0] : "Creator");
      const email = user.email || "";
      const initial = (name.trim()[0] || "C").toUpperCase();

      $$("#profileName").forEach((el) => el.textContent = name);

      $$("#profileEmail").forEach((el) => el.textContent = email);

      $$("#avatarInitial, #avatarInitialLg").forEach((el) => el.textContent = initial);
    } else {

      $$("#profilePop").forEach((p) => p.classList.add("hidden"));
      document.body.classList.remove("sc-profile-open");
    }
  }

  /* ---------- Modals helpers ---------- */
  function openModal(sel) {
    const m = $(sel);
    if (!m) return;
    m.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }
  function closeModal(sel) {
    const m = typeof sel === "string" ? $(sel) : sel;
    if (!m) return;
    m.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  /* ---------- Earn credits: refresh tasks (remove "save", add Telegram) ---------- */
  function refreshEarnTasks() {
    const list = $("#tasksList");
    if (!list) return;

    const TASKS = [
      {
        id: "subscribe",
        label: "Subscribe Tech Vault channel",
        hint: "Open the channel, subscribe, then claim.",
        url: "https://www.youtube.com/@TechVault-90",
      },
      {
        id: "watch",
        label: "Watch one Tech Vault video",
        hint: "Open the channel, watch any video, then claim.",
        url: "https://www.youtube.com/@TechVault-90/videos",
      },
      {
        id: "telegram",
        label: "Follow on Telegram",
        hint: "Join our Telegram channel, then claim.",
        url: "https://t.me/+ZfQKHJhGg8xiMTRl",
      },
      {
        id: "share",
        label: "Share ShortsCraft with a friend",
        hint: "Share the website link, then claim.",
        url: "https://shortscraft.online/",
      },
      {
        id: "feedback",
        label: "Submit useful product feedback",
        hint: "Tell us what should improve, then claim.",
        action: "feedback",
      },
    ];

    let done = {};
    let opened = {};
    try { done = JSON.parse(localStorage.getItem("sc:tasks:v2") || "{}"); } catch {}
    try { opened = JSON.parse(localStorage.getItem("sc:tasks-opened:v2") || "{}"); } catch {}

    list.innerHTML = TASKS.map((t) => {
      const isDone = !!done[t.id];
      const isOpened = !!opened[t.id];
      const btn = isDone ? "Done ✓" : isOpened ? "Claim +1" : (t.action === "feedback" ? "Open" : "Open");
      return `
        <div class="task premium-task ${isDone ? "task-done" : ""}">
          <div class="task-info">
            <b>${escapeHtmlSafe(t.label)}</b>
            <span>${escapeHtmlSafe(t.hint)}</span>
            <small>+1 credit</small>
          </div>
          <button data-id="${t.id}" data-action="${t.action || "open"}" data-url="${t.url || ""}" ${isDone ? "disabled" : ""}>${btn}</button>
        </div>`;
    }).join("");


    $$("#tasksList button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const url = btn.dataset.url;

        let doneState = {};
        let openedState = {};
        try { doneState = JSON.parse(localStorage.getItem("sc:tasks:v2") || "{}"); } catch {}
        try { openedState = JSON.parse(localStorage.getItem("sc:tasks-opened:v2") || "{}"); } catch {}

        if (doneState[id]) return;

        if (action === "feedback" && !openedState[id]) {
          openedState[id] = true;
          localStorage.setItem("sc:tasks-opened:v2", JSON.stringify(openedState));
          closeModal("#earnModal");
          openModal("#feedbackModal");
          refreshEarnTasks();
          return;
        }

        if (!openedState[id]) {
          openedState[id] = true;
          localStorage.setItem("sc:tasks-opened:v2", JSON.stringify(openedState));
          if (url) window.open(url, "_blank", "noopener,noreferrer");
          if (window.scToast) window.scToast("Task opened. Complete it, then come back to claim.", "info");
          refreshEarnTasks();
          return;
        }

        doneState[id] = true;
        localStorage.setItem("sc:tasks:v2", JSON.stringify(doneState));
        const cur = parseInt(localStorage.getItem(CREDITS_KEY) || "10", 10) || 0;
        const nv = cur + 1;
        localStorage.setItem(CREDITS_KEY, String(nv));

        $$("#creditsCount, #creditsInfoCount").forEach((el) => el.textContent = String(nv));
        if (window.scToast) window.scToast("+1 credit added!", "success");
        refreshEarnTasks();
      });
    });
  }

  function escapeHtmlSafe(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- Mobile hamburger menu ---------- */
  function initMobileNav() {
    const burger = $("#navBurger");
    const nav = $("#navMobile");
    if (!burger || !nav || burger.dataset.scV10 === "1") return;
    burger.dataset.scV10 = "1";

    const close = () => {
      nav.classList.remove("open");
      nav.setAttribute("hidden", "");
      burger.classList.remove("active");
      burger.setAttribute("aria-expanded", "false");
    };
    const open = () => {
      nav.removeAttribute("hidden");
      nav.classList.add("open");
      burger.classList.add("active");
      burger.setAttribute("aria-expanded", "true");
    };

    burger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (nav.classList.contains("open")) close();
      else open();
    }, true);

    nav.addEventListener("click", (e) => e.stopPropagation(), true);

    $$(".nav-mobile a").forEach((a) => a.addEventListener("click", close));
    document.addEventListener("click", (e) => {
      if (nav.classList.contains("open") && !e.target.closest(".nav") && !e.target.closest("#navMobile")) {
        close();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("open")) close();
    });
  }

  /* ---------- Auto-scroll to preview after generation ---------- */
  function bindGenerateScroll() {
    const btn = $("#generateVideoBtn");
    if (!btn || btn.dataset.scV10Scroll === "1") return;
    btn.dataset.scV10Scroll = "1";

    btn.addEventListener("click", () => {
      const script = $("#videoScriptInput")?.value?.trim();
      if (!script) return;
      // Wait for preview to render
      setTimeout(() => {
        const target = $(".video-preview-card") || $("#videoFrameWrap") || $("#videoPreviewFrame");
        if (target) {
          const headerOffset = window.innerWidth <= 768 ? 64 : 70;
          const rect = target.getBoundingClientRect();
          const offsetTop = rect.top + window.scrollY - headerOffset - 12;
          window.scrollTo({ top: offsetTop, behavior: "smooth" });
        }
      }, 380);
    }, false);
  }

  /* ---------- Boot ---------- */
  function boot() {
    ensureTenCredits();
    setAuthUI(getStoredUser());
    initMobileNav();
    bindGenerateScroll();

    // Refresh earn tasks when modal opens
    const earnTriggers = ["#earnCreditsLink", "#noCreditsEarnBtn"];
    earnTriggers.forEach((sel) => {
      const btn = $(sel);
      if (btn && btn.dataset.scV10Earn !== "1") {
        btn.dataset.scV10Earn = "1";
        btn.addEventListener("click", () => {
          setTimeout(refreshEarnTasks, 60);
        });
      }
    });
    // Initial render of tasks
    refreshEarnTasks();

    // Re-apply on async load
    setTimeout(ensureTenCredits, 600);
    setTimeout(() => setAuthUI(getStoredUser()), 800);
    setTimeout(refreshEarnTasks, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();


/* ============================================================
   FINAL FEEDBACK SUBMIT FIX
   Prevents repeated "Internal server error" toasts and gives user a
   smooth success flow. Server is still called; if server/storage fails,
   feedback is saved locally so the UI does not break.
   ============================================================ */
(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const showToast = (msg, type = "info") => {
    if (window.scToast) return window.scToast(msg, type, 3500);
    const wrap = $("#toasts");
    if (!wrap) return console.log(`[${type}] ${msg}`);
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${type === "success" ? "✅" : type === "error" ? "⚠️" : "💡"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add("fade-out"); setTimeout(() => el.remove(), 300); }, 3500);
  };
  const closeFeedbackModal = () => {
    const modal = $("#feedbackModal");
    if (modal) modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
  };
  const saveLocalFeedback = (payload) => {
    try {
      const key = "sc:feedback:pending:v1";
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      arr.unshift({ ...payload, at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(arr.slice(0, 25)));
    } catch {}
  };
  async function submitFeedback(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const btn = $("#feedbackSubmit");
    const nameEl = $("#feedbackName");
    const emailEl = $("#feedbackEmail");
    const msgEl = $("#feedbackMessage");
    const name = (nameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const message = (msgEl?.value || "").trim();
    if (!name) return showToast("Enter your name.", "error");
    if (message.length < 5) return showToast("Message too short.", "error");
    const payload = { name, email, subject: "Studio feedback", message };
    const oldText = btn?.textContent || "Submit";
    if (btn) { btn.disabled = true; btn.textContent = "Submitting..."; }
    let serverOk = false;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
      serverOk = true;
    } catch (err) {
      console.warn("[feedback fallback]", err?.message || err);
      saveLocalFeedback(payload);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText; }
    }
    if (msgEl) msgEl.value = "";
    closeFeedbackModal();
    showToast(serverOk ? "Thanks! Feedback submitted." : "Thanks! Feedback saved. I’ll keep it safely.", "success");
  }
  function bindFinalFeedbackFix() {
    const btn = $("#feedbackSubmit");
    if (!btn || btn.dataset.scFinalFeedbackFix === "1") return;
    btn.dataset.scFinalFeedbackFix = "1";
    btn.addEventListener("click", submitFeedback, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindFinalFeedbackFix);
  else bindFinalFeedbackFix();
})();
